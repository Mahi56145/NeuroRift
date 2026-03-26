import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeDatasetScore } from "@/lib/dataset-score";
import { applySmartDefaults } from "@/lib/dataset-defaults";
import { enrichDataset } from "@/lib/ai/enrichDataset";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const useAI = formData.get("useAI") === "true"; // New option: get AI insights

  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file uploaded" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const fileBuffer = await file.arrayBuffer();
  const fileName = `${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("datasets")
    .upload(fileName, fileBuffer, {
      contentType: file.type,
    });

  if (uploadError) {
    console.error(uploadError);
    return new Response(
      JSON.stringify({ error: "Storage upload failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("datasets")
    .getPublicUrl(fileName);

  const file_url = publicUrlData.publicUrl;
  const nameOverride = formData.get("nameOverride") as string | null;
  const catOverride = formData.get("category") as string | null;
  const descOverride = formData.get("description") as string | null;
  const userId = formData.get("userId") as string | null;

  const lowerName = file.name.toLowerCase();
  const isCSV = file.type.includes("csv") || lowerName.endsWith(".csv");
  const isPDF = file.type.includes("pdf") || lowerName.endsWith(".pdf");

  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];

  if (isCSV) {
    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    rows = parsed.data as Record<string, unknown>[];
    columns = Object.keys(rows[0] || {});
  }

  const category = catOverride || (isCSV ? "CSV Dataset" : isPDF ? "PDF Document" : "Other");
  const finalName = nameOverride || file.name;
  const fileSizeKb = `${Math.max(1, Math.round(file.size / 1024))} KB`;

  if (userId) {
    const { data: existing } = await supabaseAdmin.from("datasets").select("id").eq("name", finalName).eq("created_by", userId).limit(1);
    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Duplicate dataset detected. You have already contributed this identical dataset." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const defaults = applySmartDefaults({
    name: finalName,
    category,
    rows_count: rows.length || null,
    columns_count: columns.length || null,
  });

  const score = computeDatasetScore({
    source: "upload",
    rows: defaults.rows_count,
    cols: defaults.columns_count,
    size: fileSizeKb,
    name: finalName,
    category: defaults.category,
  });

  const { data: dbData, error: dbError } = await supabaseAdmin
    .from("datasets")
    .insert([
      {
        name: finalName,
        category: defaults.category,
        file_url,
        rows_count: defaults.rows_count,
        columns_count: defaults.columns_count,
        size: fileSizeKb,
        score,
        created_by: userId || null,
      },
    ])
    .select();

  if (dbError) {
    console.error("DB Upload Error:", dbError);
    return new Response(
      JSON.stringify({ error: `DB error: ${dbError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let enrichment = null;
  if (useAI && dbData && dbData[0]) {
    const dataset = dbData[0];
    
    // First, let's pre-populate the description if the user or AI provided one via the frontend
    if (descOverride) {
      try {
        await supabaseAdmin.from("dataset_enrichment").upsert({
          dataset_id: dataset.id,
          description: descOverride,
          score,
          tags: [defaults.category.toLowerCase().replace(" ", "-"), "dataset"],
          use_cases: ["Machine learning", "Data analysis"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error("Enrichment upsert failed:", err);
      }
    }
    
    // Then call enrichDataset to get the remaining insights from Groq
    enrichment = await enrichDataset(dataset.id, {
      name: dataset.name,
      category: dataset.category,
      rows: dataset.rows_count,
      cols: dataset.columns_count,
      size: dataset.size ?? fileSizeKb,
    });
  }

  return new Response(
    JSON.stringify({
      message: "Uploaded successfully",
      file_url,
      dbData,
      enrichment: useAI ? enrichment : null,
      preview: rows.slice(0, 5),
      type: isCSV ? "csv" : isPDF ? "pdf" : "other",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
