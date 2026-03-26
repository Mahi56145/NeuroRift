// app/api/analyze/route.ts
// POST /api/analyze
//
// Normal mode:   { name, category, rows?, cols?, size?, votes?, datasetId? }
//   → Returns full enrichment including rich Groq fields
//
// Compare mode:  { compareMode: true, datasetA: {...}, datasetB: {...} }
//   → Returns { verdict: string }

import { NextRequest, NextResponse } from "next/server";
import { analyzeDataset } from "@/lib/groq";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Groq from "groq-sdk";

// ─── Compare verdict via Groq ─────────────────────────────────────────────────
async function generateVerdict(
  a: { name: string; score: number; rows?: number | null; cols?: number | null; difficulty?: string; tags?: string[] },
  b: { name: string; score: number; rows?: number | null; cols?: number | null; difficulty?: string; tags?: string[] }
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    const winner = a.score >= b.score ? a.name : b.name;
    return `${winner} outperforms based on quality score (${a.score} vs ${b.score}).`;
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are a data science expert comparing two datasets head-to-head.

Dataset A: ${a.name}
- Quality Score: ${a.score}/100
- Rows: ${a.rows ?? "unknown"}, Columns: ${a.cols ?? "unknown"}
- Difficulty: ${a.difficulty ?? "unknown"}
- Tags: ${(a.tags ?? []).join(", ")}

Dataset B: ${b.name}
- Quality Score: ${b.score}/100
- Rows: ${b.rows ?? "unknown"}, Columns: ${b.cols ?? "unknown"}
- Difficulty: ${b.difficulty ?? "unknown"}
- Tags: ${(b.tags ?? []).join(", ")}

Write a 2-3 sentence verdict explaining which dataset is better and why. Be specific about the trade-offs. Start with which one wins (or say it's a tie) and give concrete reasons based on the data above.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a concise data science expert. Give a direct, informative verdict." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 200,
    });

    return completion.choices?.[0]?.message?.content?.trim() ?? `${a.score >= b.score ? a.name : b.name} scores higher overall.`;
  } catch (error) {
    console.error("[Groq] generateVerdict failed:", error);
    return `${a.score >= b.score ? a.name : b.name} outperforms with a score of ${Math.max(a.score, b.score)} vs ${Math.min(a.score, b.score)}.`;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Compare Mode ──────────────────────────────────────────────────────────
    if (body.compareMode) {
      const { datasetA, datasetB } = body;
      if (!datasetA || !datasetB) {
        return NextResponse.json({ error: "datasetA and datasetB required" }, { status: 400 });
      }
      const verdict = await generateVerdict(datasetA, datasetB);
      return NextResponse.json({ verdict });
    }

    // ── Normal Analysis Mode ──────────────────────────────────────────────────
    const { name, category, rows, cols, size, votes, datasetId } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    // Check Supabase cache first (fresh < 7 days)
    if (datasetId) {
      const { data: cached } = await supabaseAdmin
        .from("dataset_enrichment")
        .select("*")
        .eq("dataset_id", datasetId)
        .single();

      if (cached) {
        const ageDays = (Date.now() - new Date(cached.updated_at ?? cached.created_at).getTime()) / 86400000;
        if (ageDays < 7) {
          return NextResponse.json({
            description: cached.description,
            score: cached.score,
            tags: cached.tags,
            use_cases: cached.use_cases,
            difficulty: cached.difficulty,
            preprocessingEffort: cached.preprocessing_effort,
            recommendedModels: cached.recommended_models,
            pros: cached.pros,
            cons: cached.cons,
            // Rich fields — may be null in old cache rows, Groq will fill them fresh below if missing
            completeness: cached.completeness ?? null,
            biasWarnings: cached.bias_warnings ?? [],
            trainingReadiness: cached.training_readiness ?? null,
            businessValue: cached.business_value ?? null,
            statisticalProfile: cached.statistical_profile ?? null,
          });
        }
      }
    }

    // Call Groq for full rich analysis
    const analysis = await analyzeDataset({ name, category, rows, cols, size, votes });

    // Cache/update in Supabase if we have a datasetId
    if (datasetId) {
      try {
        await supabaseAdmin.from("dataset_enrichment").upsert({
          dataset_id: datasetId,
          description: analysis.description,
          score: analysis.score,
          tags: analysis.tags,
          use_cases: analysis.use_cases,
          difficulty: analysis.difficulty,
          preprocessing_effort: analysis.preprocessingEffort,
          recommended_models: analysis.recommendedModels,
          pros: analysis.pros,
          cons: analysis.cons,
          completeness: analysis.completeness,
          bias_warnings: analysis.biasWarnings,
          training_readiness: analysis.trainingReadiness,
          business_value: analysis.businessValue,
          statistical_profile: analysis.statisticalProfile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Also update the main datasets table score
        await supabaseAdmin
          .from("datasets")
          .update({ score: analysis.score })
          .eq("id", datasetId);
      } catch (dbErr) {
        console.error("Supabase cache update error:", dbErr);
      }
    }

    return NextResponse.json(analysis);
  } catch (err: unknown) {
    console.error("Analysis API Error:", err);
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}