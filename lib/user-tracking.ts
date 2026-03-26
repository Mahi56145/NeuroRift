// lib/user-tracking.ts
// Client-side user behavior tracking (localStorage-based)

const RECENT_DATASETS_KEY = "neurorif_recent_datasets";
const MAX_RECENT = 10;

export function trackRecentDataset(datasetId: string, datasetName: string) {
  if (typeof window === "undefined") return;

  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_DATASETS_KEY) || "[]") as Array<{
      id: string;
      name: string;
      viewed_at: string;
    }>;

    const filtered = existing.filter((d) => d.id !== datasetId);
    const updated = [
      { id: datasetId, name: datasetName, viewed_at: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT);

    localStorage.setItem(RECENT_DATASETS_KEY, JSON.stringify(updated));
  } catch {
    // Silent fail — tracking is best-effort
  }
}

export function getRecentDatasets(): Array<{ id: string; name: string; viewed_at: string }> {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(RECENT_DATASETS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearRecentDatasets() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RECENT_DATASETS_KEY);
}
