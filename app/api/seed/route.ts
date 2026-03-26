// app/api/seed/route.ts
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeDatasetScore } from "@/lib/dataset-score";
import path from "path";
import fs from "fs";

type SeedDataset = {
  name: string;
  slug?: string;
  size?: string | number;
  votes?: number;
  kaggle_url?: string;
};

function bytesToHuman(size?: string | number): string | null {
  if (size === undefined || size === null) return null;
  if (typeof size === "string") return size;
  if (!Number.isFinite(size) || size <= 0) return null;

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIdx = 0;

  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }

  const rounded = value >= 10 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[unitIdx]}`;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

const categoryMap = (name: string, slug?: string) => {
  const text = `${name ?? ""} ${slug ?? ""}`.toLowerCase();

  if (
    text.includes("medical") || text.includes("cancer") || text.includes("clinical") ||
    text.includes("health") || text.includes("hospital") || text.includes("patient") ||
    text.includes("diabetes") || text.includes("cardio") || text.includes("heart") ||
    text.includes("covid") || text.includes("disease") || text.includes("drug") ||
    text.includes("brain") || text.includes("tumor") || text.includes("blood")
  ) return "Healthcare";

  if (
    text.includes("image") || text.includes("vision") || text.includes("mnist") ||
    text.includes("cifar") || text.includes("coco") || text.includes("object detection") ||
    text.includes("segmentation") || text.includes("classification") || text.includes("xray") ||
    text.includes("x-ray") || text.includes("chest") || text.includes("face") ||
    text.includes("facial") || text.includes("ocr") || text.includes("yolo") ||
    text.includes("satellite") || text.includes("retina") || text.includes("digit") ||
    text.includes("traffic sign") || text.includes("photo") || text.includes("picture") ||
    text.includes("pixel") || text.includes("visual")
  ) return "Computer Vision";

  if (
    text.includes("text") || text.includes("nlp") || text.includes("sentiment") ||
    text.includes("language") || text.includes("tweet") || text.includes("review") ||
    text.includes("corpus") || text.includes("qa") || text.includes("imdb") ||
    text.includes("spam") || text.includes("news") || text.includes("article") ||
    text.includes("chat") || text.includes("dialogue") || text.includes("word") ||
    text.includes("book") || text.includes("document") || text.includes("summary")
  ) return "NLP";

  if (
    text.includes("finance") || text.includes("price") || text.includes("stock") ||
    text.includes("trading") || text.includes("loan") || text.includes("credit") ||
    text.includes("fraud") || text.includes("bank") || text.includes("bitcoin") ||
    text.includes("crypto") || text.includes("market") || text.includes("economic") ||
    text.includes("revenue") || text.includes("tax") || text.includes("insurance")
  ) return "Finance";

  if (
    text.includes("sales") || text.includes("customer") || text.includes("marketing") ||
    text.includes("retail") || text.includes("ecommerce") || text.includes("e-commerce") ||
    text.includes("churn") || text.includes("product") || text.includes("survey") ||
    text.includes("user") || text.includes("behavior") || text.includes("recommendation")
  ) return "Business";

  return "General";
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "app/api/seed/datasets.json");
    const file = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(file) as SeedDataset[];

    // Remove duplicate slugs inside the seed file itself before DB checks.
    const unique = new Map<string, SeedDataset>();
    for (const entry of data) {
      if (!entry?.slug) continue;
      if (!unique.has(entry.slug)) unique.set(entry.slug, entry);
    }
    const normalized = Array.from(unique.values());

    const mapped = normalized.map((d) => ({
      name:       d.name,
      slug:       d.slug,
      category:   categoryMap(d.name, d.slug),
      size:       bytesToHuman(d.size),
      votes:      d.votes,
      kaggle_url: d.kaggle_url,
      score:      computeDatasetScore({
        source: "kaggle",
        votes: d.votes,
        size: bytesToHuman(d.size),
        name: d.name,
        category: categoryMap(d.name, d.slug),
      }),
    })).filter((d) => d.slug);

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("datasets")
      .select("slug");
    if (existingError) throw existingError;

    const existingSlugs = new Set((existingRows ?? []).map((r: { slug: string }) => r.slug));
    const toInsert = mapped.filter(
      (d): d is (typeof mapped)[number] & { slug: string } =>
        typeof d.slug === "string" && d.slug.length > 0 && !existingSlugs.has(d.slug)
    );

    let inserted = 0;
    if (toInsert.length > 0) {
      // Insert in batches to avoid payload/statement limits when seeding 500+ rows.
      const batches = chunkArray(toInsert, 200);
      for (const batch of batches) {
        const { error } = await supabaseAdmin.from("datasets").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }
    }

    const { count, error: countError } = await supabaseAdmin
      .from("datasets")
      .select("*", { count: "exact", head: true });
    if (countError) throw countError;

    return new Response(JSON.stringify({
      message: "Seed success",
      inserted,
      total: count ?? 0,
      sourceRows: data.length,
      uniqueSourceRows: normalized.length,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}