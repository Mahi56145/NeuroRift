import { supabase } from "@/lib/supabase";
import path from "path";
import fs from "fs";

const categoryMap = (name: string, slug?: string) => {
  const text = `${name ?? ""} ${slug ?? ""}`.toLowerCase();

  if (
    text.includes("medical") ||
    text.includes("cancer") ||
    text.includes("clinical") ||
    text.includes("health") ||
    text.includes("hospital") ||
    text.includes("patient") ||
    text.includes("diabetes") ||
    text.includes("cardio") ||
    text.includes("heart")
  ) {
    return "Healthcare";
  }

  if (
    text.includes("image") ||
    text.includes("vision") ||
    text.includes("mnist") ||
    text.includes("cifar") ||
    text.includes("coco") ||
    text.includes("object detection") ||
    text.includes("segmentation") ||
    text.includes("classification") ||
    text.includes("xray") ||
    text.includes("x-ray") ||
    text.includes("chest") ||
    text.includes("face") ||
    text.includes("facial") ||
    text.includes("ocr") ||
    text.includes("yolo") ||
    text.includes("satellite") ||
    text.includes("retina") ||
    text.includes("digit") ||
    text.includes("traffic sign")
  ) {
    return "Computer Vision";
  }

  if (
    text.includes("text") ||
    text.includes("nlp") ||
    text.includes("sentiment") ||
    text.includes("language") ||
    text.includes("tweet") ||
    text.includes("review") ||
    text.includes("corpus") ||
    text.includes("qa") ||
    text.includes("imdb") ||
    text.includes("spam") ||
    text.includes("news")
  ) {
    return "NLP";
  }

  if (
    text.includes("finance") ||
    text.includes("price") ||
    text.includes("stock") ||
    text.includes("trading") ||
    text.includes("loan") ||
    text.includes("credit") ||
    text.includes("fraud") ||
    text.includes("bank")
  ) {
    return "Finance";
  }

  if (
    text.includes("sales") ||
    text.includes("customer") ||
    text.includes("marketing") ||
    text.includes("retail") ||
    text.includes("ecommerce") ||
    text.includes("e-commerce") ||
    text.includes("churn")
  ) {
    return "Business";
  }

  return "General";
};

const generateScore = () => Math.floor(Math.random() * 60) + 40;

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "app/api/seed/datasets.json");

    const file = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(file);

    const mapped = data.map((d: any) => ({
      name: d.name,
      slug: d.slug,
      category: categoryMap(d.name, d.slug),
      size: d.size,
      votes: d.votes,
      kaggle_url: d.kaggle_url,
      score: generateScore(),
    }));

    const { data: existingRows, error: existingError } = await supabase
      .from("datasets")
      .select("slug");
    if (existingError) throw existingError;

    const existingSlugs = new Set((existingRows ?? []).map((r: any) => r.slug));
    const toInsert = mapped.filter((d: any) => !existingSlugs.has(d.slug));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("datasets").insert(toInsert);
      if (error) throw error;
    }

    const { count, error: countError } = await supabase
      .from("datasets")
      .select("*", { count: "exact", head: true });
    if (countError) throw countError;

    return new Response(JSON.stringify({
      message: "Seed success",
      inserted: toInsert.length,
      total: count ?? 0,
    }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Seed failed" }), {
      status: 500,
    });
  }
}