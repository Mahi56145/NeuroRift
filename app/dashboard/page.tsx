"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Dataset {
  id: string;
  name: string;
  category: string;
  file_url: string;
  rows_count: number;
  columns_count: number;
  score: number;
  created_at: string;
}

function scoreColor(s: number) { return s > 80 ? "#22c55e" : s > 60 ? "#fbbf24" : "#ef4444"; }
function scoreBg(s: number)    { return s > 80 ? "rgba(34,197,94,0.12)" : s > 60 ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)"; }
function scoreBorder(s: number){ return s > 80 ? "rgba(34,197,94,0.25)" : s > 60 ? "rgba(251,191,36,0.25)" : "rgba(239,68,68,0.25)"; }

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fileTypeLabel(url: string): string {
  return url?.split("?")[0]?.split(".").pop()?.toUpperCase() ?? "–";
}

function fileTypeIcon(url: string): string {
  const ext = url?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv") return "⬡";
  if (ext === "pdf") return "◉";
  if (["png","jpg","jpeg","gif","webp"].includes(ext)) return "◈";
  return "◆";
}

function formatRows(n: number): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const saveRecent = (id: string) => {
  const existing = JSON.parse(localStorage.getItem("recent_datasets") || "[]");
  const updated = [id, ...existing.filter((i: string) => i !== id)].slice(0, 5);
  localStorage.setItem("recent_datasets", JSON.stringify(updated));
};

function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(16,10,30,0.7)", border: "1px solid rgba(124,58,237,0.12)",
      borderRadius: 14, padding: "20px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {[140, 90, 60].map((w, i) => (
        <div key={i} style={{
          height: 9, width: w, borderRadius: 4,
          background: "rgba(124,58,237,0.1)",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [activeNav, setActiveNav]     = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentDatasets, setRecentDatasets] = useState<Dataset[]>([]);
  const [loadingRecent, setLoadingRecent]   = useState(true);
  const [uploadCount, setUploadCount]       = useState(0);
  const [downloadCount, setDownloadCount]   = useState(0);
  const [lastActivity, setLastActivity]     = useState<string | null>(null);
  const [downloadingId, setDownloadingId]   = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [searchFocused, setSearchFocused]   = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const { count: uCount } = await supabase
        .from("datasets").select("*", { count: "exact", head: true });
      setUploadCount(uCount ?? 0);

      const { count: dCount } = await supabase
        .from("downloads").select("*", { count: "exact", head: true });
      setDownloadCount(dCount ?? 0);

      const { data: latest } = await supabase
        .from("downloads").select("downloaded_at")
        .order("downloaded_at", { ascending: false }).limit(1).single();
      if (latest?.downloaded_at) setLastActivity(latest.downloaded_at);
    } catch { /* silent */ }
  }, []);

  const fetchRecentDatasets = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const ids: string[] = JSON.parse(localStorage.getItem("recent_datasets") || "[]");
      if (ids.length === 0) { setRecentDatasets([]); return; }
      const { data, error } = await supabase.from("datasets").select("*").in("id", ids);
      if (error) throw error;
      const ordered = ids
        .map((id) => (data ?? []).find((d) => d.id === id))
        .filter(Boolean) as Dataset[];
      setRecentDatasets(ordered);
    } catch { setRecentDatasets([]); }
    finally { setLoadingRecent(false); }
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchRecentDatasets();
  }, [fetchCounts, fetchRecentDatasets]);

  const filteredRecent = recentDatasets.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q);
  });

  const handleDatasetClick = (dataset: Dataset) => {
    saveRecent(dataset.id);
    router.push(`/dataset/${dataset.id}`);
  };

  const handleDownload = async (dataset: Dataset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataset.file_url) { showToast("No file URL available.", "error"); return; }
    setDownloadingId(dataset.id);
    try {
      window.open(dataset.file_url, "_blank", "noopener,noreferrer");
      await supabase.from("downloads").insert({ dataset_id: dataset.id, downloaded_at: new Date().toISOString() });
      setDownloadCount((c) => c + 1);
      showToast(`Download started: ${dataset.name}`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Download log failed.", "error");
    } finally { setDownloadingId(null); }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const navItems = [
    { icon: "⬡", label: "Dashboard",        color: "#a78bfa", glow: "rgba(167,139,250,0.25)", action: () => setActiveNav("Dashboard") },
    { icon: "↑",  label: "Upload",           color: "#38bdf8", glow: "rgba(56,189,248,0.25)",  action: () => { setActiveNav("Upload"); router.push("/upload"); } },
    { icon: "◈",  label: "Datasets",         color: "#c4b5fd", glow: "rgba(196,181,253,0.25)", action: () => { setActiveNav("Datasets"); router.push("/datasets"); } },
    { icon: "⬟",  label: "Analyse Dataset",  color: "#4ade80", glow: "rgba(74,222,128,0.25)",  action: () => { setActiveNav("Analyse Dataset"); router.push("/analyse"); } },
    { icon: "◆",  label: "Compare Dataset",  color: "#fbbf24", glow: "rgba(251,191,36,0.25)",  action: () => { setActiveNav("Compare Dataset"); router.push("/compare"); } },
    { icon: "◇",  label: "Profile",          color: "#f472b6", glow: "rgba(244,114,182,0.25)", action: () => { setActiveNav("Profile"); router.push("/profile"); } },
  ];

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
        @keyframes pulse    { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn  { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes glowPulse{ 0%,100%{box-shadow:0 0 12px rgba(124,58,237,0.2)} 50%{box-shadow:0 0 28px rgba(124,58,237,0.45)} }
        @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes spin     { to{transform:rotate(360deg)} }

        .stat-card:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 32px rgba(124,58,237,0.25) !important;
          border-color: rgba(124,58,237,0.35) !important;
        }
        .nav-card:hover {
          transform: translateY(-4px) scale(1.03) !important;
          border-color: rgba(124,58,237,0.55) !important;
        }
        .recent-card:hover {
          transform: translateY(-3px) !important;
          border-color: rgba(124,58,237,0.45) !important;
          box-shadow: 0 8px 28px rgba(124,58,237,0.2) !important;
        }
        .dl-btn:hover {
          background: rgba(124,58,237,0.3) !important;
          box-shadow: 0 0 16px rgba(124,58,237,0.35) !important;
          color: #e2d9f3 !important;
        }
        .logout-btn:hover {
          background: rgba(239,68,68,0.2) !important;
          box-shadow: 0 0 14px rgba(239,68,68,0.25) !important;
        }
        .explore-btn:hover {
          background: rgba(56,189,248,0.18) !important;
          box-shadow: 0 0 16px rgba(56,189,248,0.25) !important;
          color: #7dd3fc !important;
        }
        .search-input:focus {
          border-color: rgba(124,58,237,0.5) !important;
          box-shadow: 0 0 14px rgba(124,58,237,0.15) !important;
        }
      `}</style>

      {/* Background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,51,180,0.2) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(168,85,247,0.14) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 55% 40%, rgba(56,189,248,0.05) 0%, transparent 60%)
        `,
      }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(124,58,237,0.035) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(124,58,237,0.035) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10,
          background: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: toast.type === "success" ? "#4ade80" : "#f87171",
          fontSize: 12, fontFamily: "inherit", fontWeight: 600,
          backdropFilter: "blur(16px)",
          animation: "toastIn 0.3s ease", maxWidth: 340,
        }}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>

        {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 0 0", gap: 16,
          animation: "fadeIn 0.3s ease both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 15, color: "#fff",
              boxShadow: "0 0 18px rgba(124,58,237,0.55)",
            }}>N</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.12em" }}>
              <span style={{ color: "#fff" }}>NEURO</span>
              <span style={{ color: "#38bdf8" }}>RIFT</span>
            </span>
          </div>

          {/* Search bar in topbar */}
          <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
            <span style={{
              position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
              fontSize: 13, color: searchFocused ? "#7c3aed" : "#6b7280",
              transition: "color 0.2s",
            }}>⌕</span>
            <input
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search recent datasets..."
              style={{
                width: "100%", padding: "9px 14px 9px 34px",
                background: "rgba(124,58,237,0.07)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 10, color: "#e2d9f3",
                fontSize: 12, fontFamily: "inherit", outline: "none",
                boxSizing: "border-box", transition: "all 0.2s",
                backdropFilter: "blur(8px)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Explore button */}
            <button
              className="explore-btn"
              onClick={() => router.push("/datasets")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 20px", borderRadius: 10,
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.22)",
                color: "#38bdf8", fontSize: 12,
                fontFamily: "inherit", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.08em",
                transition: "all 0.2s", backdropFilter: "blur(8px)",
              }}
            >
              <span style={{ fontSize: 14 }}>◎</span>
              EXPLORE
            </button>

            {/* Logout */}
            <button
              className="logout-btn"
              onClick={() => router.push("/auth")}
              style={{
                padding: "9px 20px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.22)",
                color: "#f87171", fontSize: 12,
                fontFamily: "inherit", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.08em",
                transition: "all 0.2s",
              }}
            >LOGOUT</button>
          </div>
        </header>

        {/* ── NAV CARDS ───────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          padding: "28px 0 0",
          animation: "fadeIn 0.4s ease both",
          animationDelay: "0.05s",
        }}>
          {navItems.map((item, i) => {
            const isActive = activeNav === item.label;
            return (
              <button
                key={item.label}
                className="nav-card"
                onClick={item.action}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 10, padding: "18px 12px",
                  background: isActive
                    ? `linear-gradient(145deg, rgba(124,58,237,0.22), rgba(16,10,30,0.85))`
                    : "rgba(16,10,30,0.75)",
                  border: isActive
                    ? `1px solid ${item.color}55`
                    : "1px solid rgba(124,58,237,0.14)",
                  borderRadius: 14,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                  backdropFilter: "blur(14px)",
                  boxShadow: isActive ? `0 0 24px ${item.glow}` : "none",
                  animation: `fadeIn 0.4s ease both`,
                  animationDelay: `${0.06 + i * 0.06}s`,
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Glow blob */}
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: isActive
                    ? `radial-gradient(ellipse 70% 70% at 50% 0%, ${item.glow}, transparent 70%)`
                    : "none",
                  transition: "all 0.3s",
                }} />
                {/* Icon box — matches stat card icon style */}
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: isActive
                    ? `linear-gradient(135deg, ${item.color}33, ${item.color}11)`
                    : "rgba(124,58,237,0.1)",
                  border: `1px solid ${isActive ? item.color + "55" : "rgba(124,58,237,0.18)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: isActive ? item.color : "#6b7280",
                  fontWeight: 700, flexShrink: 0,
                  transition: "all 0.22s",
                  boxShadow: isActive ? `0 0 16px ${item.glow}` : "none",
                }}>{item.icon}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: isActive ? item.color : "#6b7280",
                  letterSpacing: "0.08em",
                  textAlign: "center", lineHeight: 1.3,
                  transition: "color 0.2s",
                }}>{item.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 14, padding: "22px 0 0",
          animation: "fadeIn 0.45s ease both",
          animationDelay: "0.1s",
        }}>
          {[
            { icon: "↑", label: "Total Uploads",   value: String(uploadCount),   color: "#a78bfa", glow: "rgba(167,139,250,0.18)", borderActive: "rgba(167,139,250,0.3)" },
            { icon: "↓", label: "Total Downloads",  value: String(downloadCount), color: "#38bdf8", glow: "rgba(56,189,248,0.18)",  borderActive: "rgba(56,189,248,0.3)"  },
          ].map((s, i) => (
            <div
              key={i}
              className="stat-card"
              style={{
                background: "rgba(16,10,30,0.75)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 14, padding: "20px 24px",
                backdropFilter: "blur(14px)",
                display: "flex", alignItems: "center", gap: 18,
                animation: "fadeIn 0.4s ease both",
                animationDelay: `${0.1 + i * 0.08}s`,
                position: "relative", overflow: "hidden",
                transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                cursor: "default",
              }}
            >
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `radial-gradient(ellipse 55% 55% at 8% 50%, ${s.glow}, transparent 70%)`,
              }} />
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `linear-gradient(135deg, ${s.color}22, ${s.color}0a)`,
                border: `1px solid ${s.borderActive}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: s.color, fontWeight: 800, flexShrink: 0,
                boxShadow: `0 0 16px ${s.glow}`,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#f3f0ff", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, letterSpacing: "0.12em" }}>{s.label.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ACTIVITY STRIP ──────────────────────────────────────────────────── */}
        <div style={{
          margin: "14px 0 0",
          padding: "12px 22px",
          background: "rgba(16,10,30,0.55)",
          border: "1px solid rgba(124,58,237,0.11)",
          borderRadius: 10, backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "fadeIn 0.5s ease both", animationDelay: "0.14s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: "#a78bfa",
              boxShadow: "0 0 8px rgba(167,139,250,0.7)",
              animation: "glowPulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              You uploaded{" "}
              <span style={{ color: "#c4b5fd", fontWeight: 700 }}>{uploadCount}</span>
              {" "}dataset{uploadCount !== 1 ? "s" : ""}, downloaded{" "}
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>{downloadCount}</span>
              {" "}dataset{downloadCount !== 1 ? "s" : ""}
            </span>
          </div>
          {lastActivity && (
            <span style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.08em" }}>
              Last activity: {timeAgo(lastActivity)}
            </span>
          )}
        </div>

        {/* ── RECENTLY OPENED ─────────────────────────────────────────────────── */}
        <div style={{
          margin: "24px 0 0",
          background: "rgba(16,10,30,0.72)",
          border: "1px solid rgba(124,58,237,0.16)",
          borderRadius: 16, backdropFilter: "blur(14px)",
          overflow: "hidden",
          animation: "fadeIn 0.55s ease both", animationDelay: "0.18s",
        }}>
          <div style={{
            padding: "20px 26px",
            borderBottom: "1px solid rgba(124,58,237,0.1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.2em", fontWeight: 600 }}>// RECENT</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f3f0ff", marginTop: 3 }}>Recently Opened Datasets</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 10, color: "#4b5563", letterSpacing: "0.1em" }}>
                {recentDatasets.length} / 5 datasets
              </span>
              <button
                onClick={() => { localStorage.removeItem("recent_datasets"); setRecentDatasets([]); }}
                style={{
                  background: "transparent", border: "1px solid rgba(124,58,237,0.15)",
                  borderRadius: 6, padding: "4px 10px",
                  color: "#4b5563", fontSize: 9, fontFamily: "inherit",
                  cursor: "pointer", letterSpacing: "0.1em",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4b5563"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.15)"; }}
              >✕ CLEAR</button>
            </div>
          </div>

          <div style={{ padding: "20px 26px" }}>
            {loadingRecent && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {!loadingRecent && filteredRecent.length === 0 && (
              <div style={{
                padding: "52px 0", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.16)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, color: "#7c3aed",
                  animation: "glowPulse 3s ease-in-out infinite",
                }}>◈</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {searchQuery ? `No results for "${searchQuery}"` : "No recently opened datasets yet."}
                </div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>
                  {searchQuery ? "Try a different search." : "Browse datasets using the Explore button to get started."}
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => router.push("/datasets")}
                    style={{
                      marginTop: 6, padding: "9px 22px", borderRadius: 10,
                      background: "rgba(124,58,237,0.14)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#c4b5fd", fontSize: 11, fontFamily: "inherit",
                      fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.25)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(124,58,237,0.25)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.14)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                  >◎ BROWSE DATASETS →</button>
                )}
              </div>
            )}

            {!loadingRecent && filteredRecent.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
                {filteredRecent.map((d, i) => {
                  const safeScore = d.score ?? 0;
                  return (
                    <div
                      key={d.id}
                      className="recent-card"
                      onClick={() => handleDatasetClick(d)}
                      style={{
                        background: "rgba(124,58,237,0.07)",
                        border: "1px solid rgba(124,58,237,0.18)",
                        borderRadius: 13, padding: "16px 18px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
                        animation: "fadeUp 0.35s ease both",
                        animationDelay: `${i * 0.07}s`,
                        position: "relative", overflow: "hidden",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 0, right: 0, width: 50, height: 50,
                        background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)",
                      }} />

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: "rgba(124,58,237,0.12)",
                          border: "1px solid rgba(124,58,237,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, color: "#38bdf8",
                        }}>{fileTypeIcon(d.file_url)}</div>
                        <span style={{
                          fontSize: 9, padding: "3px 8px", borderRadius: 5, fontWeight: 700,
                          background: scoreBg(safeScore),
                          border: `1px solid ${scoreBorder(safeScore)}`,
                          color: scoreColor(safeScore),
                          letterSpacing: "0.06em",
                        }}>{safeScore}</span>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e2d9f3", lineHeight: 1.35, marginBottom: 8 }}>
                        {(d.name ?? "—").length > 24 ? (d.name ?? "—").slice(0, 24) + "…" : (d.name ?? "—")}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 9, padding: "2px 8px", borderRadius: 5, display: "inline-block",
                          background: "rgba(124,58,237,0.12)",
                          border: "1px solid rgba(124,58,237,0.2)",
                          color: "#a78bfa", letterSpacing: "0.06em",
                        }}>{d.category ?? "—"}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 5,
                          background: "rgba(56,189,248,0.08)",
                          border: "1px solid rgba(56,189,248,0.18)",
                          color: "#38bdf8", letterSpacing: "0.06em",
                        }}>{fileTypeLabel(d.file_url)}</span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 9, color: "#6b7280" }}>
                          {formatRows(d.rows_count ?? 0)} rows · {d.columns_count ?? 0} cols
                        </span>
                        <span style={{ fontSize: 9, color: "#4b5563" }}>{timeAgo(d.created_at)}</span>
                      </div>

                      <button
                        className="dl-btn"
                        onClick={(e) => handleDownload(d, e)}
                        disabled={downloadingId === d.id}
                        style={{
                          width: "100%", padding: "7px 0", borderRadius: 8,
                          background: downloadingId === d.id ? "rgba(124,58,237,0.06)" : "rgba(124,58,237,0.14)",
                          border: "1px solid rgba(124,58,237,0.28)",
                          color: downloadingId === d.id ? "#4b5563" : "#c4b5fd",
                          fontSize: 10, fontFamily: "inherit", fontWeight: 700,
                          cursor: downloadingId === d.id ? "not-allowed" : "pointer",
                          letterSpacing: "0.08em", transition: "all 0.18s",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        }}
                      >
                        {downloadingId === d.id ? "···" : "↓ DOWNLOAD"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: "#374151", padding: "28px 0 36px", letterSpacing: "0.12em" }}>
          © 2026 NEURORIFT · All systems nominal
        </div>

      </div>
    </div>
  );
}