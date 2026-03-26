export interface DatasetScoreInput {
  source?: "kaggle" | "upload";
  votes?: number | null;
  rows?: number | null;
  cols?: number | null;
  size?: string | null;
  name?: string | null;
  category?: string | null;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function parseSizeToBytes(size?: string | null): number | null {
  if (!size) return null;
  const normalized = size.trim().toLowerCase();
  const m = normalized.match(/([\d.]+)\s*(b|kb|mb|gb|tb)/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value)) return null;

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };
  return Math.round(value * (multipliers[unit] ?? 1));
}

function logNorm(value: number, maxForScale: number) {
  const safeValue = Math.max(0, value);
  const max = Math.max(1, maxForScale);
  return clamp(Math.log10(safeValue + 1) / Math.log10(max + 1), 0, 1);
}

function categorySpecificityBoost(category?: string | null) {
  if (!category) return 0;
  const c = category.toLowerCase();
  if (["general", "other", "csv dataset", "pdf document"].includes(c)) return 0;
  return 4;
}

function stableHashBoost(name?: string | null) {
  if (!name) return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 5) - 2;
}

export function computeDatasetScore(input: DatasetScoreInput): number {
  const votes = input.votes ?? 0;
  const rows = input.rows ?? 0;
  const cols = input.cols ?? 0;
  const sizeBytes = parseSizeToBytes(input.size) ?? 0;

  let score = 40;

  // Community trust signal (strong for Kaggle datasets).
  score += logNorm(votes, 50_000) * 28;

  // Data volume and dimensionality signal.
  score += logNorm(rows, 5_000_000) * 20;
  score += logNorm(cols, 2_000) * 8;

  // File size can proxy richness if row count is missing.
  score += logNorm(sizeBytes, 10 * 1024 ** 3) * 8;

  // Slight preference for curated public benchmark sources.
  if (input.source === "kaggle") score += 4;

  score += categorySpecificityBoost(input.category);
  score += stableHashBoost(input.name);

  return Math.round(clamp(score, 40, 98));
}
