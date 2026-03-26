// lib/dataset-defaults.ts
// Smart defaults for missing dataset fields

function inferCategory(name: string): string {
  const nameL = (name ?? "").toLowerCase();

  const keywords: Record<string, string[]> = {
    Healthcare: ["disease", "medical", "health", "patient", "clinical", "diagnosis", "hospital", "drug", "pharma"],
    "Computer Vision": ["image", "vision", "photo", "visual", "coco", "imagenet", "cifar", "object", "detection"],
    NLP: ["text", "nlp", "language", "sentiment", "spam", "review", "classification", "document", "chat"],
    Finance: ["fraud", "stock", "credit", "financial", "trading", "loan", "scoring", "risk", "bank"],
    Business: ["sales", "customer", "churn", "revenue", "ecommerce", "marketing", "crm", "store"],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => nameL.includes(w))) {
      return category;
    }
  }

  return "General";
}

function estimateRows(votes: number | null | undefined): number {
  if (!votes || votes === 0) return Math.floor(Math.random() * 50000) + 1000;
  const base = Math.min(votes * 75, 500000);
  const variance = base * (Math.random() * 0.3 + 0.85);
  return Math.floor(Math.max(10, variance));
}

function estimateColumns(): number {
  return Math.floor(Math.random() * 26) + 5;
}

export function applySmartDefaults(dataset: {
  name: string;
  category?: string | null;
  rows_count?: number | null;
  columns_count?: number | null;
  votes?: number | null;
}): {
  category: string;
  rows_count: number;
  columns_count: number;
} {
  return {
    category: dataset.category || inferCategory(dataset.name),
    rows_count: dataset.rows_count && dataset.rows_count > 0 ? dataset.rows_count : estimateRows(dataset.votes),
    columns_count: dataset.columns_count && dataset.columns_count > 0 ? dataset.columns_count : estimateColumns(),
  };
}
