// app/api/ai/generate-metadata/route.ts
// POST { filename, size, type } → Groq returns { name, category, description, tags, suggestedUseCases }

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { filename, size, type } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      // Return a sensible fallback without Groq
      const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      return NextResponse.json({
        name: base.charAt(0).toUpperCase() + base.slice(1),
        category: "General",
        description: `A dataset derived from the file "${filename}".`,
        tags: ["dataset", "data", "ml"],
        suggestedUseCases: ["Data analysis", "Machine learning", "Exploratory research"],
      });
    }

    const prompt = `You are a data science expert. Given a file being uploaded to a dataset platform, generate intelligent metadata for it.

File info:
- Filename: ${filename}
- Size: ${size ?? "unknown"}
- File type / extension: ${type ?? filename.split(".").pop() ?? "unknown"}

Return ONLY valid JSON with this exact shape (no markdown, no code blocks, no extra text):
{
  "name": "clean human-friendly dataset name derived from the filename",
  "category": "one of: CSV Dataset, PDF Document, Healthcare, Finance, NLP, Computer Vision, Business, General",
  "description": "2-3 sentences describing what this dataset likely contains based on the filename and what ML/data tasks it would be useful for",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "suggestedUseCases": ["specific use case 1", "specific use case 2", "specific use case 3"]
}

Rules:
- name: clean Title Case, not a raw filename (remove extensions, underscores, hyphens)
- category: pick the most specific match possible
- description: be specific based on the filename clues — avoid generic wording
- tags: lowercase keywords relevant to the data domain
- suggestedUseCases: concrete ML/AI/analytics tasks this dataset enables`;

    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a data science expert. Always respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 500,
    });

    const raw: string = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON substring
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = {}; }
      }
    }

    const cleanName = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    const fallbackName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    return NextResponse.json({
      name: typeof parsed.name === "string" && parsed.name.length > 0 ? parsed.name : fallbackName,
      category: typeof parsed.category === "string" ? parsed.category : "General",
      description: typeof parsed.description === "string" && parsed.description.length > 10 ? parsed.description : `Dataset from ${filename}.`,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : ["dataset", "ml"],
      suggestedUseCases: Array.isArray(parsed.suggestedUseCases) ? parsed.suggestedUseCases.slice(0, 3).map(String) : ["Data analysis", "Machine learning"],
    });
  } catch (err) {
    console.error("[generate-metadata]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
