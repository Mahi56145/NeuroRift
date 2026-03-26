// app/api/seed/route.ts
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeDatasetScore } from "@/lib/dataset-score";
import path from "path";
import fs from "fs";

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
    const data = JSON.parse(file);

    const mapped = data.map((d: {
      name: string; slug?: string; size?: string;
      votes?: number; kaggle_url?: string;
    }) => ({
      name:       d.name,
      slug:       d.slug,
      category:   categoryMap(d.name, d.slug),
      size:       d.size,
      votes:      d.votes,
      kaggle_url: d.kaggle_url,
      score:      computeDatasetScore({
        source: "kaggle",
        votes: d.votes,
        size: d.size,
        name: d.name,
        category: categoryMap(d.name, d.slug),
      }),
      source:     "kaggle" as const,
    }));

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("datasets")
      .select("slug");
    if (existingError) throw existingError;

    const existingSlugs = new Set((existingRows ?? []).map((r: { slug: string }) => r.slug));
    const toInsert = mapped.filter((d: { slug: string }) => !existingSlugs.has(d.slug));

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("datasets").insert(toInsert);
      if (error) throw error;
    }

    const { count, error: countError } = await supabaseAdmin
      .from("datasets")
      .select("*", { count: "exact", head: true });
    if (countError) throw countError;

    return new Response(JSON.stringify({
      message: "Seed success",
      inserted: toInsert.length,
      total: count ?? 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}