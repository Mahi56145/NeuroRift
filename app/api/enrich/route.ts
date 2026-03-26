// app/api/enrich/route.ts
// GET /api/enrich
// Processes datasets missing description/tags in batches, calls Groq AI,
// updates Supabase with description, score, tags

import { NextResponse } from "next/server";
import { analyzeDataset } from "@/lib/groq";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BATCH = 10; // Process up to 10 datasets per call to avoid timeouts

export async function GET() {
  try {
    // Fetch datasets that need enrichment (missing description or score=0)
    const { data: datasets, error } = await supabaseAdmin
      .from("datasets")
      .select("id, name, category, rows_count, columns_count, size, votes, score, description")
      .or("description.is.null,score.is.null,score.eq.0")
      .limit(BATCH);

    if (error) throw error;
    if (!datasets || datasets.length === 0) {
      return NextResponse.json({ message: "All datasets already enriched", enriched: 0 });
    }

    const results: { id: string; status: "success" | "error"; name: string }[] = [];

    for (const d of datasets) {
      try {
        const analysis = await analyzeDataset({
          name:     d.name,
          category: d.category,
          rows:     d.rows_count,
          cols:     d.columns_count,
          size:     d.size,
          votes:    d.votes,
        });

        const { error: updateErr } = await supabaseAdmin
          .from("datasets")
          .update({
            description: analysis.description,
            score:       analysis.score,
            tags:        analysis.tags,
          })
          .eq("id", d.id);

        if (updateErr) throw updateErr;
        results.push({ id: d.id, status: "success", name: d.name });
      } catch {
        results.push({ id: d.id, status: "error", name: d.name });
      }
    }

    const succeeded = results.filter(r => r.status === "success").length;
    return NextResponse.json({
      message: `Enriched ${succeeded}/${datasets.length} datasets`,
      enriched: succeeded,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/enrich — enrich a single dataset by ID
export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: d, error } = await supabaseAdmin
      .from("datasets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !d) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const analysis = await analyzeDataset({
      name:     d.name,
      category: d.category,
      rows:     d.rows_count,
      cols:     d.columns_count,
      size:     d.size,
      votes:    d.votes,
    });

    const { error: updateErr } = await supabaseAdmin
      .from("datasets")
      .update({
        description: analysis.description,
        score:       analysis.score,
        tags:        analysis.tags,
      })
      .eq("id", id);

    if (updateErr) throw updateErr;
    return NextResponse.json({ success: true, ...analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}