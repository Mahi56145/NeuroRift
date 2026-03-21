"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

interface Dataset {
  id: string;
  name: string;
  category: string;
  file_url: string;
  rows_count: number;
  columns_count: number;
  score: number;
  created_at: string;
  file_type?: string;
  description?: string;
}

interface ParsedPreview {
  headers: string[];
  data: string[][];
}

function formatRows(n: number): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(score: number) {
  const s = score ?? 0;
  if (s > 80) return { fg: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", glow: "rgba(34,197,94,0.25)" };
  if (s > 60) return { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", glow: "rgba(251,191,36,0.2)" };
  return { fg: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", glow: "rgba(239,68,68,0.2)" };
}

function detectFileType(url: string): "csv" | "pdf" | "image" | "other" {
  const ext = url?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  return "other";
}

function fileTypeLabel(url: string): string {
  const ext = url?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "unknown";
  return ext.toUpperCase();
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function getScoreBreakdown(score: number) {
  const safeScore = score ?? 0;
  const seed = safeScore / 100;
  return [
    { label: "Completeness", pct: Math.round(seed * 95 + 2),  icon: "◈", color: "#a78bfa" },
    { label: "Consistency",  pct: Math.round(seed * 88 + 5),  icon: "◆", color: "#38bdf8" },
    { label: "Accuracy",     pct: Math.round(seed * 92 + 3),  icon: "◉", color: "#4ade80" },
    { label: "Uniqueness",   pct: Math.round(seed * 78 + 10), icon: "⬟", color: "#fbbf24" },
    { label: "Timeliness",   pct: Math.round(seed * 85 + 8),  icon: "⬡", color: "#f472b6" },
  ];
}

function getAIInsights(dataset: Dataset, safeScore: number): string[] {
  const rows = dataset?.rows_count ?? 0;
  const cols = dataset?.columns_count ?? 0;
  const cat = dataset?.category ?? "General";
  return [
    `This dataset contains ${formatRows(rows)} records across ${cols} dimensions, making it ${rows > 500_000 ? "large-scale" : "mid-scale"} for ${cat} tasks.`,
    `Quality score of ${safeScore}/100 indicates ${safeScore > 80 ? "production-ready data with minimal preprocessing needed" : safeScore > 60 ? "moderate cleaning recommended before training" : "significant preprocessing required — check for nulls and outliers"}.`,
    `Recommended for: ${cat === "NLP" ? "language model fine-tuning, sentiment analysis, and text classification" : cat === "Computer Vision" ? "image classification, object detection, and segmentation pipelines" : "supervised learning, feature engineering, and exploratory analysis"}.`,
    `Estimated training time on A100 GPU: ${Math.max(1, Math.round(rows / 50000))} – ${Math.max(2, Math.round(rows / 30000))} minutes per epoch at batch size 256.`,
  ];
}

function ScoreRing({ score }: { score: number }) {
  const safeScore = score ?? 0;
  const c = scoreColor(safeScore);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (safeScore / 100) * circ;

  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <circle
          cx={65} cy={65} r={r} fill="none"
          stroke={c.fg} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${c.glow})`, transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: c.fg, letterSpacing: "-0.03em", lineHeight: 1 }}>{safeScore}</span>
        <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.12em", marginTop: 2 }}>SCORE</span>
      </div>
    </div>
  );
}

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "schema">("preview");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [insightVisible, setInsightVisible] = useState(false);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", id)
        .single();
      if (sbError) throw sbError;
      setDataset(data);
      setTimeout(() => setInsightVisible(true), 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Dataset not found.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDataset(); }, [fetchDataset]);

  useEffect(() => {
    if (!dataset?.file_url) return;
    const type = detectFileType(dataset.file_url);
    if (type !== "csv") return;

    setPreviewLoading(true);
    fetch(dataset.file_url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch file.");
        return res.text();
      })
      .then((text) => {
        const result = Papa.parse<string[]>(text, {
          skipEmptyLines: true,
          preview: 7,
        });
        const rows = result.data as string[][];
        if (rows.length < 2) {
          setPreview(null);
          return;
        }
        const headers = rows[0].map((h) => String(h ?? "").trim());
        const data = rows.slice(1, 7).map((row) =>
          headers.map((_, ci) => String(row[ci] ?? "").trim())
        );
        setPreview({ headers, data });
      })
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [dataset?.file_url]);

  const handleDownload = async () => {
    if (!dataset?.file_url) return;
    setDownloading(true);
    try {
      window.open(dataset.file_url, "_blank", "noopener,noreferrer");
      await supabase.from("downloads").insert({
        dataset_id: dataset.id,
        downloaded_at: new Date().toISOString(),
      });
      showToast("Download started successfully.", "success");
    } catch {
      showToast("Failed to log download.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const safeScore = dataset?.score ?? 0;
  const scoreBreakdown = dataset ? getScoreBreakdown(safeScore) : [];
  const aiInsights = dataset ? getAIInsights(dataset, safeScore) : [];
  const sc = scoreColor(safeScore);
  const fileType = dataset?.file_type ?? (dataset?.file_url ? fileTypeLabel(dataset.file_url) : "–");
  const detectedType = dataset?.file_url ? detectFileType(dataset.file_url) : "other";
  const previewRowCount = preview?.data?.length ?? 0;
  const totalRows = dataset?.rows_count ?? 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0812",
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      color: "#e2d9f3",
      position: "relative",
      overflowX: "hidden",
    }}>
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse    { 0%,100% { opacity:.35 } 50% { opacity:.75 } }
        @keyframes scanline { 0% { transform:translateY(-100%) } 100% { transform:translateY(100vh) } }
        @keyframes glitch   { 0%,100%{transform:none} 20%{transform:skewX(2deg)} 40%{transform:skewX(-1deg)} }
        @keyframes toastIn  { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes barFill  { from{width:0} to{width:var(--w)} }
        @keyframes typewriter { from{width:0} to{width:100%} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .row-hover:hover { background: rgba(124,58,237,0.07) !important; }
        .tab-btn:hover   { color: #c4b5fd !important; }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 70% 55% at 15% 5%,  rgba(99,51,180,0.22)  0%, transparent 55%),
          radial-gradient(ellipse 55% 45% at 85% 85%, rgba(168,85,247,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 40% 35% at 60% 45%, rgba(56,189,248,0.06) 0%, transparent 55%)
        `,
      }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />
      <div style={{
        position: "fixed", left: 0, right: 0, height: 2, zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)",
        animation: "scanline 8s linear infinite",
      }} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10,
          background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: toast.type === "success" ? "#4ade80" : "#f87171",
          fontSize: 12, fontFamily: "inherit", fontWeight: 600,
          backdropFilter: "blur(16px)",
          animation: "toastIn 0.3s ease",
        }}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <header style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "16px 32px",
        borderBottom: "1px solid rgba(124,58,237,0.15)",
        background: "rgba(10,8,18,0.8)",
        backdropFilter: "blur(24px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
            color: "#a78bfa", borderRadius: 8, padding: "7px 14px",
            fontSize: 12, fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.22)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.12)"; }}
        >← BACK</button>

        <div style={{ width: 1, height: 20, background: "rgba(124,58,237,0.2)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 13, color: "#fff",
            boxShadow: "0 0 12px rgba(124,58,237,0.45)",
          }}>N</div>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.12em" }}>
            <span style={{ color: "#fff" }}>NEURO</span><span style={{ color: "#38bdf8" }}>RIFT</span>
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.1em" }}>// DATASET DETAIL</span>
        </div>
      </header>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "2px solid rgba(124,58,237,0.15)",
            borderTop: "2px solid #7c3aed",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.15em" }}>LOADING DATASET...</div>
        </div>
      )}

      {!loading && error && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 12 }}>
          <div style={{ fontSize: 32, color: "#f87171" }}>⚠</div>
          <div style={{ fontSize: 14, color: "#f87171", fontWeight: 700 }}>{error}</div>
          <button onClick={fetchDataset} style={{
            marginTop: 8, padding: "8px 20px", borderRadius: 8,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
          }}>↺ RETRY</button>
        </div>
      )}

      {!loading && !error && dataset && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 64px" }}>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 32, gap: 24,
            animation: "fadeUp 0.5s ease both",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.14em", marginBottom: 10 }}>
                <span style={{ color: "#7c3aed" }}>DATASETS</span>
                <span style={{ margin: "0 6px" }}>›</span>
                <span style={{ color: "#6b7280" }}>{(dataset?.category ?? "").toUpperCase()}</span>
                <span style={{ margin: "0 6px" }}>›</span>
                <span style={{ color: "#9ca3af" }}>{(dataset?.id?.slice(0, 8) ?? "—").toUpperCase()}</span>
              </div>

              <h1 style={{
                fontSize: 32, fontWeight: 900, margin: "0 0 10px",
                letterSpacing: "-0.03em", color: "#f3f0ff",
                lineHeight: 1.1,
              }}>{dataset?.name ?? "—"}</h1>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  fontSize: 10, padding: "4px 12px", borderRadius: 5,
                  background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)",
                  color: "#a78bfa", letterSpacing: "0.08em", fontWeight: 600,
                }}>{dataset?.category ?? "—"}</span>
                <span style={{
                  fontSize: 10, padding: "4px 12px", borderRadius: 5,
                  background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                  color: "#38bdf8", letterSpacing: "0.08em",
                }}>{fileType}</span>
                <span style={{
                  fontSize: 10, padding: "4px 12px", borderRadius: 5,
                  background: sc.bg, border: `1px solid ${sc.border}`,
                  color: sc.fg, letterSpacing: "0.08em", fontWeight: 700,
                }}>SCORE {safeScore}</span>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: "14px 28px", borderRadius: 10,
                background: downloading ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
                border: downloading ? "1px solid rgba(124,58,237,0.3)" : "none",
                color: downloading ? "#6b7280" : "#fff",
                fontSize: 13, fontFamily: "inherit", fontWeight: 800,
                cursor: downloading ? "not-allowed" : "pointer",
                letterSpacing: "0.08em",
                boxShadow: downloading ? "none" : "0 0 24px rgba(124,58,237,0.4)",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16 }}>{downloading ? "⌛" : "↓"}</span>
              {downloading ? "DOWNLOADING..." : "DOWNLOAD DATASET"}
            </button>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12,
            marginBottom: 28,
          }}>
            {[
              { icon: "⬡", label: "ROWS",      value: formatRows(dataset?.rows_count ?? 0),    sub: "records" },
              { icon: "◈", label: "COLUMNS",    value: String(dataset?.columns_count ?? 0),     sub: "features" },
              { icon: "◉", label: "FILE TYPE",  value: fileType,                                 sub: "format" },
              { icon: "◆", label: "UPLOADED",   value: formatDate(dataset?.created_at ?? ""),   sub: "date added" },
              { icon: "⬟", label: "QUALITY",    value: `${safeScore}/100`,                       sub: "data score" },
            ].map((s, i) => (
              <div key={i} style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.15)",
                borderRadius: 10, padding: "16px 18px",
                backdropFilter: "blur(12px)",
                animation: "fadeUp 0.4s ease both",
                animationDelay: `${0.05 + i * 0.07}s`,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0, width: 50, height: 50,
                  background: "radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)",
                }} />
                <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.14em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f3f0ff", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              <div style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 12, overflow: "hidden",
                backdropFilter: "blur(12px)",
                animation: "fadeUp 0.45s ease both",
                animationDelay: "0.2s",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 0,
                  borderBottom: "1px solid rgba(124,58,237,0.1)",
                  padding: "0 20px",
                }}>
                  {(["preview", "schema"] as const).map((tab) => (
                    <button
                      key={tab}
                      className="tab-btn"
                      onClick={() => setActiveTab(tab)}
                      style={{
                        background: "transparent", border: "none",
                        borderBottom: activeTab === tab ? "2px solid #7c3aed" : "2px solid transparent",
                        color: activeTab === tab ? "#c4b5fd" : "#6b7280",
                        padding: "14px 18px", fontSize: 11,
                        fontFamily: "inherit", fontWeight: activeTab === tab ? 700 : 400,
                        cursor: "pointer", letterSpacing: "0.1em",
                        transition: "all 0.15s",
                      }}
                    >{tab === "preview" ? "// DATA PREVIEW" : "// SCHEMA"}</button>
                  ))}
                  <div style={{ marginLeft: "auto", fontSize: 9, color: "#4b5563", paddingRight: 4 }}>
                    showing {previewRowCount} of {formatRows(totalRows)} rows
                  </div>
                </div>

                {activeTab === "preview" && (
                  <>
                    {previewLoading && (
                      <div style={{ padding: "32px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          border: "2px solid rgba(124,58,237,0.15)",
                          borderTop: "2px solid #7c3aed",
                          animation: "spin 0.8s linear infinite",
                        }} />
                        <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.12em" }}>PARSING FILE...</span>
                      </div>
                    )}

                    {!previewLoading && detectedType === "csv" && preview && preview.headers.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "rgba(124,58,237,0.07)" }}>
                              {preview.headers.map((h) => (
                                <th key={h} style={{
                                  padding: "10px 16px", textAlign: "left",
                                  color: "#7c3aed", fontSize: 9,
                                  letterSpacing: "0.14em", fontWeight: 700,
                                  borderBottom: "1px solid rgba(124,58,237,0.1)",
                                  whiteSpace: "nowrap",
                                }}>{h.toUpperCase()}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.data.map((row, ri) => (
                              <tr
                                key={ri}
                                className="row-hover"
                                style={{
                                  borderBottom: "1px solid rgba(124,58,237,0.05)",
                                  transition: "background 0.12s",
                                  cursor: "default",
                                }}
                              >
                                {row.map((cell, ci) => (
                                  <td key={ci} style={{
                                    padding: "11px 16px",
                                    color: ci === 0 ? "#a78bfa" : "#9ca3af",
                                    fontWeight: ci === 0 ? 700 : 400,
                                    whiteSpace: "nowrap",
                                  }}>{cell ?? "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{
                          padding: "10px 16px", borderTop: "1px solid rgba(124,58,237,0.07)",
                          fontSize: 9, color: "#374151", letterSpacing: "0.1em",
                        }}>
                          ··· {formatRows(Math.max(0, totalRows - previewRowCount))} more rows not shown
                        </div>
                      </div>
                    )}

                    {!previewLoading && detectedType === "csv" && !preview && (
                      <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                        Preview unavailable — could not parse file.
                      </div>
                    )}

                    {!previewLoading && detectedType === "pdf" && dataset?.file_url && (
                      <div style={{ padding: "12px" }}>
                        <iframe
                          src={dataset.file_url}
                          style={{
                            width: "100%", height: 420, border: "none", borderRadius: 8,
                            background: "#000",
                          }}
                          title="PDF Preview"
                        />
                      </div>
                    )}

                    {!previewLoading && detectedType === "image" && dataset?.file_url && (
                      <div style={{ padding: "20px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img
                          src={dataset.file_url}
                          alt={dataset?.name ?? "Dataset preview"}
                          style={{
                            maxWidth: "100%", maxHeight: 400, borderRadius: 8,
                            border: "1px solid rgba(124,58,237,0.15)",
                            objectFit: "contain",
                          }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}

                    {!previewLoading && detectedType === "other" && (
                      <div style={{ padding: "32px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          Preview not available for {fileType} files.
                        </div>
                        <button
                          onClick={handleDownload}
                          style={{
                            marginTop: 14, padding: "7px 18px", borderRadius: 7,
                            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
                            color: "#a78bfa", fontSize: 11, fontFamily: "inherit",
                            cursor: "pointer", letterSpacing: "0.06em",
                          }}
                        >↓ DOWNLOAD TO VIEW</button>
                      </div>
                    )}
                  </>
                )}

                {activeTab === "schema" && preview && preview.headers.length > 0 && (
                  <div style={{ padding: "8px 0" }}>
                    {preview.headers.map((h, i) => {
                      const types = ["INT64", "FLOAT32", "VARCHAR", "TIMESTAMP", "BOOL", "FLOAT64", "CATEGORY"];
                      const t = types[i % types.length];
                      const nullable = i % 3 !== 0;
                      return (
                        <div key={h} style={{
                          display: "flex", alignItems: "center", gap: 16,
                          padding: "10px 20px",
                          borderBottom: "1px solid rgba(124,58,237,0.05)",
                          transition: "background 0.12s",
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.05)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, width: 140 }}>{h}</span>
                          <span style={{
                            fontSize: 9, padding: "2px 8px", borderRadius: 4,
                            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                            color: "#38bdf8", letterSpacing: "0.06em",
                          }}>{t}</span>
                          <span style={{ fontSize: 9, color: nullable ? "#6b7280" : "#4ade80" }}>
                            {nullable ? "nullable" : "not null"}
                          </span>
                          <span style={{ marginLeft: "auto", fontSize: 9, color: "#374151" }}>
                            col_{i + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "schema" && (!preview || preview.headers.length === 0) && (
                  <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                    Schema unavailable — no headers detected.
                  </div>
                )}
              </div>

              <div style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 12,
                backdropFilter: "blur(12px)",
                overflow: "hidden",
                animation: "fadeUp 0.5s ease both",
                animationDelay: "0.3s",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, #7c3aed, #a855f7, #38bdf8, transparent)",
                }} />

                <button
                  onClick={() => setAiExpanded(!aiExpanded)}
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    padding: "18px 22px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(56,189,248,0.2))",
                    border: "1px solid rgba(124,58,237,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>🧠</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.16em", fontWeight: 600 }}>// AI ENGINE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f0ff", marginTop: 1 }}>Dataset Intelligence Report</div>
                  </div>
                  <div style={{
                    fontSize: 11, color: "#6b7280",
                    transform: aiExpanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.25s",
                  }}>▼</div>
                </button>

                <div style={{ padding: "0 22px 20px" }}>
                  {aiInsights.slice(0, aiExpanded ? aiInsights.length : 1).map((line, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      marginBottom: i < (aiExpanded ? aiInsights.length : 1) - 1 ? 14 : 0,
                      animation: i > 0 ? "fadeUp 0.35s ease both" : "none",
                      animationDelay: `${i * 0.1}s`,
                      opacity: insightVisible ? 1 : 0,
                      transition: "opacity 0.4s ease",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        background: ["rgba(124,58,237,0.2)", "rgba(56,189,248,0.15)", "rgba(74,222,128,0.15)", "rgba(251,191,36,0.15)"][i % 4],
                        border: `1px solid ${["rgba(124,58,237,0.3)", "rgba(56,189,248,0.25)", "rgba(74,222,128,0.25)", "rgba(251,191,36,0.25)"][i % 4]}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9,
                      }}>
                        {["◈", "◉", "◆", "⬡"][i % 4]}
                      </div>
                      <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.65, margin: 0 }}>{line}</p>
                    </div>
                  ))}
                  {!aiExpanded && aiInsights.length > 1 && (
                    <button
                      onClick={() => setAiExpanded(true)}
                      style={{
                        marginTop: 12, background: "transparent", border: "none",
                        color: "#7c3aed", fontSize: 11, fontFamily: "inherit",
                        cursor: "pointer", letterSpacing: "0.08em", fontWeight: 600,
                        padding: 0,
                      }}
                    >+ {aiInsights.length - 1} MORE INSIGHTS →</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              <div style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 12, padding: "22px 22px",
                backdropFilter: "blur(12px)",
                animation: "fadeUp 0.45s ease both",
                animationDelay: "0.25s",
              }}>
                <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.16em", fontWeight: 600, marginBottom: 4 }}>// QUALITY</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f0ff", marginBottom: 20 }}>Score Breakdown</div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <ScoreRing score={safeScore} />
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                      {safeScore > 80
                        ? "Production-ready quality. Minimal preprocessing needed."
                        : safeScore > 60
                        ? "Good quality. Some cleaning recommended."
                        : "Needs significant preprocessing before use."}
                    </div>
                    <div style={{
                      marginTop: 8, fontSize: 10, padding: "4px 10px", borderRadius: 5, display: "inline-block",
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.fg, fontWeight: 700,
                    }}>
                      {safeScore > 80 ? "✓ EXCELLENT" : safeScore > 60 ? "△ MODERATE" : "✕ POOR"}
                    </div>
                  </div>
                </div>

                {scoreBreakdown.map((s, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: s.color }}>{s.icon}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{s.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.pct}%</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${s.pct}%`,
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`,
                        boxShadow: `0 0 8px ${s.color}55`,
                        animation: "barFill 1s ease both",
                        animationDelay: `${0.3 + i * 0.1}s`,
                      } as React.CSSProperties} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 12, padding: "20px 22px",
                backdropFilter: "blur(12px)",
                animation: "fadeUp 0.5s ease both",
                animationDelay: "0.35s",
              }}>
                <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.16em", fontWeight: 600, marginBottom: 14 }}>// METADATA</div>
                {[
                  { label: "Dataset ID",  value: (dataset?.id?.slice(0, 16) ?? "—") + "…" },
                  { label: "Category",    value: dataset?.category ?? "—" },
                  { label: "File Format", value: fileType },
                  { label: "Total Rows",  value: (dataset?.rows_count ?? 0).toLocaleString() },
                  { label: "Features",    value: String(dataset?.columns_count ?? 0) },
                  { label: "Created",     value: formatDate(dataset?.created_at ?? "") },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(124,58,237,0.06)",
                  }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600, textAlign: "right", maxWidth: 160, wordBreak: "break-all" }}>{value}</span>
                  </div>
                ))}

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.1em", marginBottom: 6 }}>FILE URL</div>
                  <div style={{
                    padding: "8px 12px", borderRadius: 6,
                    background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)",
                    fontSize: 9, color: "#7c3aed", wordBreak: "break-all", lineHeight: 1.5,
                  }}>{dataset?.file_url ?? "—"}</div>
                </div>
              </div>

              <div style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 12, padding: "20px 22px",
                backdropFilter: "blur(12px)",
                animation: "fadeUp 0.55s ease both",
                animationDelay: "0.4s",
              }}>
                <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.16em", fontWeight: 600, marginBottom: 14 }}>// ACTIONS</div>
                {[
                  { icon: "↓", label: "Download Dataset", action: handleDownload, primary: true },
                  { icon: "⬡", label: "Run Pipeline",     action: () => {},        primary: false },
                  { icon: "◈", label: "Train Model",      action: () => {},        primary: false },
                  { icon: "◉", label: "View Analytics",   action: () => {},        primary: false },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8, marginBottom: i < 3 ? 8 : 0,
                      background: btn.primary
                        ? "linear-gradient(90deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))"
                        : "rgba(124,58,237,0.06)",
                      border: btn.primary ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(124,58,237,0.12)",
                      color: btn.primary ? "#c4b5fd" : "#6b7280",
                      fontSize: 11, fontFamily: "inherit", fontWeight: btn.primary ? 700 : 400,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      letterSpacing: "0.06em",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = btn.primary
                        ? "linear-gradient(90deg, rgba(124,58,237,0.35), rgba(168,85,247,0.25))"
                        : "rgba(124,58,237,0.1)";
                      (e.currentTarget as HTMLButtonElement).style.color = "#c4b5fd";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = btn.primary
                        ? "linear-gradient(90deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))"
                        : "rgba(124,58,237,0.06)";
                      (e.currentTarget as HTMLButtonElement).style.color = btn.primary ? "#c4b5fd" : "#6b7280";
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{btn.icon}</span>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}