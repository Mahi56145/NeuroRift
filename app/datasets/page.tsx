"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
}

const saveRecent = (id: string) => {
  const existing = JSON.parse(localStorage.getItem("recent_datasets") || "[]");
  const updated = [id, ...existing.filter((i: string) => i !== id)].slice(0, 5);
  localStorage.setItem("recent_datasets", JSON.stringify(updated));
};

function sc(s: number) { return s > 80 ? "#22c55e" : s > 60 ? "#fbbf24" : "#ef4444"; }
function sb(s: number) { return s > 80 ? "rgba(34,197,94,0.12)" : s > 60 ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)"; }
function sbr(s: number){ return s > 80 ? "rgba(34,197,94,0.3)"  : s > 60 ? "rgba(251,191,36,0.3)"  : "rgba(239,68,68,0.3)"; }

function fmtRows(n: number) {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string) {
  if (!iso) return "—";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fileExt(url: string) {
  return url?.split("?")[0]?.split(".").pop()?.toUpperCase() ?? "–";
}

function fileIcon(url: string) {
  const e = url?.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (e === "csv") return "⬡";
  if (e === "pdf") return "◉";
  if (["png","jpg","jpeg","gif","webp"].includes(e)) return "◈";
  return "◆";
}

const CATEGORIES = ["All", "CSV Dataset", "PDF Document", "General", "Other", "NLP", "Computer Vision", "Bioinformatics"];

const SPARK_POINTS = [
  [22, 38, 31, 55, 48, 62, 57, 74, 69, 82, 78, 91],
  [65, 58, 72, 68, 80, 75, 88, 83, 79, 92, 88, 95],
  [14, 28, 22, 36, 31, 45, 40, 52, 48, 61, 57, 70],
  [88, 82, 91, 85, 94, 89, 96, 91, 88, 97, 93, 99],
];

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data);
  const w = 80, h = 28;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`
  ).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none"
        stroke={`url(#sg-${color.replace("#","")})`}
        strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function ExplorePage() {
  const router = useRouter();

  const [datasets, setDatasets]       = useState<Dataset[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("All");
  const [sortBy, setSortBy]           = useState<"newest" | "score" | "name">("newest");
  const [downloadingId, setDlId]      = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("datasets").select("*").order("created_at", { ascending: false });
      if (e) throw e;
      setDatasets(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally { setLoading(false); }
  }, []);

  const fetchDownloads = useCallback(async () => {
    try {
      const { count } = await supabase.from("downloads").select("*", { count: "exact", head: true });
      setTotalDownloads(count ?? 0);
    } catch { /**/ }
  }, []);

  useEffect(() => { fetchDatasets(); fetchDownloads(); }, [fetchDatasets, fetchDownloads]);

  const visible = datasets
    .filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (d.name ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q);
      const matchCat = category === "All" || d.category === category;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "name")  return (a.name ?? "").localeCompare(b.name ?? "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const avgScore = datasets.length
    ? Math.round(datasets.reduce((s, d) => s + (d.score ?? 0), 0) / datasets.length)
    : 0;

  const handleClick = (d: Dataset) => {
    saveRecent(d.id);
    router.push(`/dataset/${d.id}`);
  };

  const handleDownload = async (d: Dataset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!d.file_url) { showToast("No file URL.", "error"); return; }
    setDlId(d.id);
    try {
      window.open(d.file_url, "_blank", "noopener,noreferrer");
      await supabase.from("downloads").insert({ dataset_id: d.id, downloaded_at: new Date().toISOString() });
      setTotalDownloads(c => c + 1);
      showToast(`Download started: ${d.name}`, "success");
    } catch { showToast("Download log failed.", "error"); }
    finally { setDlId(null); }
  };

  const showToast = (msg: string, type: "success"|"error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const trackerStats = [
    { label: "Total Datasets",   value: datasets.length, icon: "⬡", color: "#a78bfa", spark: SPARK_POINTS[0], delta: "+3 this week"    },
    { label: "Avg Quality Score", value: avgScore,        icon: "◉", color: "#4ade80", spark: SPARK_POINTS[1], delta: "across all data"  },
    { label: "Total Downloads",   value: totalDownloads,  icon: "↓", color: "#38bdf8", spark: SPARK_POINTS[2], delta: "all time"         },
    { label: "Top Score",         value: datasets.length ? Math.max(...datasets.map(d => d.score ?? 0)) : 0,
                                              icon: "◆", color: "#fbbf24", spark: SPARK_POINTS[3], delta: "highest quality"  },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0812",
      fontFamily: "'IBM Plex Mono','Fira Code',monospace",
      color: "#e2d9f3", position: "relative", overflowX: "hidden",
    }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes toastIn { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes scanline{ 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glow    { 0%,100%{box-shadow:0 0 10px rgba(124,58,237,0.2)} 50%{box-shadow:0 0 26px rgba(124,58,237,0.45)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes borderPulse { 0%,100%{border-color:rgba(124,58,237,0.18)} 50%{border-color:rgba(124,58,237,0.45)} }

        .tracker-card:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(124,58,237,0.4) !important;
          box-shadow: 0 10px 36px rgba(124,58,237,0.2) !important;
        }
        .dataset-card:hover {
          transform: translateY(-5px) !important;
          border-color: rgba(124,58,237,0.45) !important;
          box-shadow: 0 12px 40px rgba(124,58,237,0.22) !important;
          background: rgba(124,58,237,0.1) !important;
        }
        .dataset-card:hover .card-arrow { opacity:1 !important; transform:translateX(0) !important; }
        .dl-btn:hover  { background:rgba(124,58,237,0.3) !important; box-shadow:0 0 18px rgba(124,58,237,0.35) !important; color:#e2d9f3 !important; }
        .cat-btn:hover { background:rgba(124,58,237,0.18) !important; color:#c4b5fd !important; }
        .sort-btn:hover{ background:rgba(124,58,237,0.14) !important; color:#c4b5fd !important; }
        .back-btn:hover{ background:rgba(124,58,237,0.2) !important; box-shadow:0 0 14px rgba(124,58,237,0.25) !important; }
        .search-wrap:focus-within input { border-color:rgba(124,58,237,0.5) !important; box-shadow:0 0 18px rgba(124,58,237,0.15) !important; }
      `}</style>

      {/* Background */}
      <div style={{
        position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
        background:`
          radial-gradient(ellipse 75% 55% at 15% 8%,  rgba(99,51,180,0.22) 0%, transparent 58%),
          radial-gradient(ellipse 60% 50% at 85% 85%, rgba(168,85,247,0.14) 0%, transparent 58%),
          radial-gradient(ellipse 45% 40% at 60% 42%, rgba(56,189,248,0.06) 0%, transparent 55%)
        `,
      }} />
      <div style={{
        position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
        backgroundImage:`linear-gradient(rgba(124,58,237,0.035) 1px,transparent 1px),
                         linear-gradient(90deg,rgba(124,58,237,0.035) 1px,transparent 1px)`,
        backgroundSize:"40px 40px",
      }} />
      <div style={{
        position:"fixed",left:0,right:0,height:1,zIndex:1,pointerEvents:"none",
        background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.18),transparent)",
        animation:"scanline 10s linear infinite",
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed",bottom:28,right:28,zIndex:9999,
          padding:"12px 20px",borderRadius:10,
          background:toast.type==="success"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",
          border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.35)":"rgba(239,68,68,0.35)"}`,
          color:toast.type==="success"?"#4ade80":"#f87171",
          fontSize:12,fontFamily:"inherit",fontWeight:600,
          backdropFilter:"blur(16px)",animation:"toastIn 0.3s ease",maxWidth:340,
        }}>
          {toast.type==="success"?"✓ ":"✕ "}{toast.msg}
        </div>
      )}

      <div style={{ maxWidth:1180,margin:"0 auto",padding:"0 32px",position:"relative",zIndex:1 }}>

        {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
        <header style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"22px 0 0",gap:16,
          animation:"fadeIn 0.3s ease both",
        }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <button
              className="back-btn"
              onClick={() => router.back()}
              style={{
                display:"flex",alignItems:"center",gap:7,
                padding:"8px 16px",borderRadius:9,
                background:"rgba(124,58,237,0.1)",
                border:"1px solid rgba(124,58,237,0.22)",
                color:"#a78bfa",fontSize:11,fontFamily:"inherit",fontWeight:700,
                cursor:"pointer",letterSpacing:"0.08em",transition:"all 0.2s",
              }}
            >← BACK</button>
            <div style={{ width:1,height:20,background:"rgba(124,58,237,0.2)" }} />
            <div style={{ display:"flex",alignItems:"center",gap:9 }}>
              <div style={{
                width:32,height:32,borderRadius:9,
                background:"linear-gradient(135deg,#7c3aed,#a855f7)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:900,fontSize:14,color:"#fff",
                boxShadow:"0 0 16px rgba(124,58,237,0.55)",
              }}>N</div>
              <span style={{ fontWeight:800,fontSize:14,letterSpacing:"0.12em" }}>
                <span style={{ color:"#fff" }}>NEURO</span>
                <span style={{ color:"#38bdf8" }}>RIFT</span>
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="search-wrap" style={{ flex:1,maxWidth:460,position:"relative" }}>
            <span style={{
              position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",
              fontSize:14,color:searchFocused?"#7c3aed":"#6b7280",transition:"color 0.2s",
              pointerEvents:"none",
            }}>⌕</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search datasets by name or category..."
              style={{
                width:"100%",padding:"10px 16px 10px 38px",
                background:"rgba(124,58,237,0.07)",
                border:"1px solid rgba(124,58,237,0.2)",
                borderRadius:11,color:"#e2d9f3",
                fontSize:12,fontFamily:"inherit",outline:"none",
                boxSizing:"border-box",transition:"all 0.22s",
                backdropFilter:"blur(10px)",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"transparent",border:"none",color:"#6b7280",
                  cursor:"pointer",fontSize:14,padding:2,
                }}
              >✕</button>
            )}
          </div>

          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <div style={{
              padding:"8px 16px",borderRadius:9,
              background:"rgba(124,58,237,0.08)",
              border:"1px solid rgba(124,58,237,0.18)",
              color:"#6b7280",fontSize:11,letterSpacing:"0.08em",
            }}>
              <span style={{ color:"#a78bfa",fontWeight:700 }}>{visible.length}</span> results
            </div>
          </div>
        </header>

        {/* ── PAGE TITLE ──────────────────────────────────────────────────────── */}
        <div style={{ padding:"28px 0 0",animation:"fadeIn 0.4s ease both",animationDelay:"0.05s" }}>
          <div style={{ fontSize:10,color:"#7c3aed",letterSpacing:"0.22em",fontWeight:600,marginBottom:6 }}>
            // EXPLORE
          </div>
          <h1 style={{
            fontSize:34,fontWeight:900,margin:0,
            letterSpacing:"-0.03em",color:"#f3f0ff",lineHeight:1.1,
          }}>
            Dataset Library
          </h1>
          <p style={{ fontSize:12,color:"#6b7280",margin:"6px 0 0" }}>
            Browse, analyse and download datasets from the NeuroRift collection
          </p>
        </div>

        {/* ── TRACKER STATS ───────────────────────────────────────────────────── */}
        <div style={{
          display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,
          padding:"24px 0 0",
          animation:"fadeIn 0.45s ease both",animationDelay:"0.08s",
        }}>
          {trackerStats.map((t,i) => (
            <div
              key={i}
              className="tracker-card"
              style={{
                background:"rgba(16,10,30,0.78)",
                border:"1px solid rgba(124,58,237,0.16)",
                borderRadius:14,padding:"18px 20px",
                backdropFilter:"blur(14px)",
                transition:"all 0.22s cubic-bezier(.4,0,.2,1)",
                position:"relative",overflow:"hidden",
                animation:"fadeIn 0.4s ease both",
                animationDelay:`${0.08 + i * 0.07}s`,
                cursor:"default",
              }}
            >
              <div style={{
                position:"absolute",inset:0,pointerEvents:"none",
                background:`radial-gradient(ellipse 60% 55% at 90% 10%, ${t.color}18, transparent 65%)`,
              }} />
              <div style={{
                display:"flex",alignItems:"flex-start",
                justifyContent:"space-between",marginBottom:12,
              }}>
                <div style={{
                  width:38,height:38,borderRadius:10,
                  background:`linear-gradient(135deg,${t.color}28,${t.color}0a)`,
                  border:`1px solid ${t.color}44`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:17,color:t.color,fontWeight:700,
                  boxShadow:`0 0 14px ${t.color}33`,
                }}>{t.icon}</div>
                <MiniSpark data={t.spark} color={t.color} />
              </div>
              <div style={{ fontSize:30,fontWeight:900,color:"#f3f0ff",letterSpacing:"-0.03em",lineHeight:1 }}>
                {loading ? "–" : t.value}
              </div>
              <div style={{ fontSize:10,color:"#6b7280",marginTop:4,letterSpacing:"0.1em" }}>
                {t.label.toUpperCase()}
              </div>
              <div style={{ fontSize:9,color:t.color,marginTop:5,fontWeight:600,letterSpacing:"0.06em" }}>
                {t.delta}
              </div>
            </div>
          ))}
        </div>

        {/* ── SCORE TREND BANNER ──────────────────────────────────────────────── */}
        <div style={{
          margin:"16px 0 0",
          padding:"14px 22px",
          background:"rgba(16,10,30,0.6)",
          border:"1px solid rgba(124,58,237,0.12)",
          borderRadius:11,backdropFilter:"blur(12px)",
          display:"flex",alignItems:"center",gap:20,
          animation:"fadeIn 0.5s ease both",animationDelay:"0.14s",
          overflow:"hidden",position:"relative",
        }}>
          <div style={{
            position:"absolute",inset:0,pointerEvents:"none",
            background:"linear-gradient(90deg, rgba(124,58,237,0.06), transparent 60%)",
          }} />
          <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
            <div style={{
              width:6,height:6,borderRadius:"50%",background:"#a78bfa",
              boxShadow:"0 0 10px rgba(167,139,250,0.8)",
              animation:"glow 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize:10,color:"#7c3aed",fontWeight:700,letterSpacing:"0.16em" }}>QUALITY TREND</span>
          </div>
          {/* Inline sparklines for each category */}
          <div style={{ display:"flex",alignItems:"center",gap:18,flex:1,overflow:"hidden" }}>
            {[
              { label:"CSV",   color:"#a78bfa", data:[40,55,48,72,60,85,78,92,88,95,82,98] },
              { label:"Score", color:"#4ade80", data:[65,58,72,68,80,75,88,83,79,92,88,95] },
              { label:"Downloads", color:"#38bdf8", data:[14,28,22,36,31,45,40,52,48,61,57,70] },
            ].map((item,i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:9,color:item.color,letterSpacing:"0.1em",fontWeight:600 }}>{item.label}</span>
                <MiniSpark data={item.data} color={item.color} />
              </div>
            ))}
          </div>
          <div style={{ flexShrink:0,display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontSize:11,color:"#9ca3af" }}>Avg score</span>
            <span style={{
              fontSize:14,fontWeight:900,color:"#4ade80",letterSpacing:"-0.02em",
            }}>{loading ? "–" : avgScore}</span>
            <span style={{
              fontSize:9,padding:"2px 8px",borderRadius:5,fontWeight:700,
              background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",
              color:"#4ade80",letterSpacing:"0.06em",
            }}>
              {avgScore > 80 ? "EXCELLENT" : avgScore > 60 ? "GOOD" : "NEEDS WORK"}
            </span>
          </div>
        </div>

        {/* ── FILTERS ─────────────────────────────────────────────────────────── */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"20px 0 0",gap:12,flexWrap:"wrap",
          animation:"fadeIn 0.5s ease both",animationDelay:"0.16s",
        }}>
          {/* Category filters */}
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className="cat-btn"
                onClick={() => setCategory(cat)}
                style={{
                  padding:"6px 14px",borderRadius:20,
                  background:category===cat?"rgba(124,58,237,0.22)":"rgba(16,10,30,0.7)",
                  border:category===cat?"1px solid rgba(124,58,237,0.5)":"1px solid rgba(124,58,237,0.14)",
                  color:category===cat?"#c4b5fd":"#6b7280",
                  fontSize:10,fontFamily:"inherit",fontWeight:category===cat?700:400,
                  cursor:"pointer",letterSpacing:"0.08em",transition:"all 0.18s",
                  backdropFilter:"blur(8px)",
                  boxShadow:category===cat?"0 0 14px rgba(124,58,237,0.2)":"none",
                }}
              >{cat}</button>
            ))}
          </div>

          {/* Sort buttons */}
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            <span style={{ fontSize:9,color:"#4b5563",letterSpacing:"0.12em" }}>SORT:</span>
            {(["newest","score","name"] as const).map((s) => (
              <button
                key={s}
                className="sort-btn"
                onClick={() => setSortBy(s)}
                style={{
                  padding:"5px 12px",borderRadius:7,
                  background:sortBy===s?"rgba(124,58,237,0.2)":"transparent",
                  border:sortBy===s?"1px solid rgba(124,58,237,0.4)":"1px solid rgba(124,58,237,0.12)",
                  color:sortBy===s?"#c4b5fd":"#6b7280",
                  fontSize:9,fontFamily:"inherit",fontWeight:sortBy===s?700:400,
                  cursor:"pointer",letterSpacing:"0.1em",transition:"all 0.15s",
                }}
              >{s.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* ── DATASET GRID ────────────────────────────────────────────────────── */}
        <div style={{ padding:"20px 0 0" }}>

          {/* Loading */}
          {loading && (
            <div style={{
              display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16,
            }}>
              {Array.from({length:8}).map((_,i) => (
                <div key={i} style={{
                  background:"rgba(16,10,30,0.7)",
                  border:"1px solid rgba(124,58,237,0.1)",
                  borderRadius:14,padding:"22px",
                  display:"flex",flexDirection:"column",gap:12,
                  animation:"pulse 1.5s ease-in-out infinite",
                  animationDelay:`${i*0.1}s`,
                }}>
                  {[150,100,70,50].map((w,j) => (
                    <div key={j} style={{
                      height:10,width:w,borderRadius:4,
                      background:"rgba(124,58,237,0.1)",
                    }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{
              padding:"64px 0",textAlign:"center",
              display:"flex",flexDirection:"column",alignItems:"center",gap:14,
            }}>
              <div style={{ fontSize:32,color:"#f87171" }}>⚠</div>
              <div style={{ fontSize:14,color:"#f87171",fontWeight:700 }}>Failed to load datasets</div>
              <div style={{ fontSize:11,color:"#6b7280",maxWidth:380 }}>{error}</div>
              <button
                onClick={fetchDatasets}
                style={{
                  marginTop:6,padding:"9px 22px",borderRadius:9,
                  background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",
                  color:"#f87171",fontSize:11,fontFamily:"inherit",cursor:"pointer",
                }}
              >↺ RETRY</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && visible.length === 0 && (
            <div style={{
              padding:"64px 0",textAlign:"center",
              display:"flex",flexDirection:"column",alignItems:"center",gap:14,
            }}>
              <div style={{
                width:60,height:60,borderRadius:"50%",
                background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.18)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:24,color:"#7c3aed",
              }}>◈</div>
              <div style={{ fontSize:14,color:"#c4b5fd",fontWeight:700 }}>
                {search ? `No results for "${search}"` : "No datasets in this category"}
              </div>
              <div style={{ fontSize:11,color:"#6b7280" }}>
                {search ? "Try a different keyword." : "Try selecting a different category."}
              </div>
            </div>
          )}

          {/* Cards */}
          {!loading && !error && visible.length > 0 && (
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",
              gap:16,
            }}>
              {visible.map((d,i) => {
                const s = d.score ?? 0;
                return (
                  <div
                    key={d.id}
                    className="dataset-card"
                    onClick={() => handleClick(d)}
                    style={{
                      background:"rgba(16,10,30,0.78)",
                      border:"1px solid rgba(124,58,237,0.16)",
                      borderRadius:14,padding:"20px",
                      cursor:"pointer",
                      transition:"all 0.22s cubic-bezier(.4,0,.2,1)",
                      animation:"fadeUp 0.4s ease both",
                      animationDelay:`${i * 0.05}s`,
                      position:"relative",overflow:"hidden",
                      backdropFilter:"blur(14px)",
                    }}
                  >
                    {/* Top glow */}
                    <div style={{
                      position:"absolute",top:0,left:0,right:0,height:1,
                      background:`linear-gradient(90deg,transparent,${sc(s)}44,transparent)`,
                    }} />
                    <div style={{
                      position:"absolute",top:0,right:0,width:60,height:60,
                      background:"radial-gradient(circle,rgba(124,58,237,0.1),transparent 70%)",
                    }} />

                    {/* Header row */}
                    <div style={{
                      display:"flex",alignItems:"flex-start",
                      justifyContent:"space-between",marginBottom:14,
                    }}>
                      <div style={{
                        width:40,height:40,borderRadius:10,
                        background:"rgba(124,58,237,0.12)",
                        border:"1px solid rgba(124,58,237,0.22)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:18,color:"#38bdf8",
                      }}>{fileIcon(d.file_url)}</div>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{
                          fontSize:9,padding:"3px 9px",borderRadius:5,fontWeight:700,
                          background:sb(s),border:`1px solid ${sbr(s)}`,color:sc(s),
                          letterSpacing:"0.08em",
                        }}>{s}</span>
                        <span className="card-arrow" style={{
                          fontSize:12,color:"#7c3aed",
                          opacity:0,transform:"translateX(-6px)",
                          transition:"all 0.18s",
                        }}>→</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{
                      fontSize:13,fontWeight:700,color:"#f3f0ff",
                      lineHeight:1.35,marginBottom:6,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    }}>{d.name ?? "—"}</div>
                    <div style={{ fontSize:9,color:"#4b5563",marginBottom:12,letterSpacing:"0.06em" }}>
                      {(d.id?.slice(0,8) ?? "—").toUpperCase()}
                    </div>

                    {/* Tags */}
                    <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
                      <span style={{
                        fontSize:9,padding:"3px 9px",borderRadius:5,
                        background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.22)",
                        color:"#a78bfa",letterSpacing:"0.06em",
                      }}>{d.category ?? "—"}</span>
                      <span style={{
                        fontSize:9,padding:"3px 9px",borderRadius:5,
                        background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",
                        color:"#38bdf8",letterSpacing:"0.06em",
                      }}>{fileExt(d.file_url)}</span>
                    </div>

                    {/* Stats row */}
                    <div style={{
                      display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                      gap:8,marginBottom:14,
                    }}>
                      {[
                        { label:"ROWS",  value:fmtRows(d.rows_count ?? 0) },
                        { label:"COLS",  value:String(d.columns_count ?? 0) },
                        { label:"ADDED", value:timeAgo(d.created_at) },
                      ].map((stat,j) => (
                        <div key={j} style={{
                          background:"rgba(124,58,237,0.06)",
                          border:"1px solid rgba(124,58,237,0.1)",
                          borderRadius:7,padding:"7px 8px",textAlign:"center",
                        }}>
                          <div style={{ fontSize:11,fontWeight:700,color:"#e2d9f3",lineHeight:1 }}>{stat.value}</div>
                          <div style={{ fontSize:8,color:"#4b5563",marginTop:3,letterSpacing:"0.1em" }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Score bar */}
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                        <span style={{ fontSize:8,color:"#6b7280",letterSpacing:"0.1em" }}>QUALITY SCORE</span>
                        <span style={{ fontSize:8,color:sc(s),fontWeight:700 }}>{s}/100</span>
                      </div>
                      <div style={{ height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden" }}>
                        <div style={{
                          height:"100%",width:`${s}%`,borderRadius:2,
                          background:`linear-gradient(90deg,${sc(s)}88,${sc(s)})`,
                          boxShadow:`0 0 8px ${sc(s)}55`,
                          transition:"width 1.2s ease",
                        }} />
                      </div>
                    </div>

                    {/* Download button */}
                    <button
                      className="dl-btn"
                      onClick={(e) => handleDownload(d,e)}
                      disabled={downloadingId === d.id}
                      style={{
                        width:"100%",padding:"9px 0",borderRadius:9,
                        background:downloadingId===d.id?"rgba(124,58,237,0.06)":"rgba(124,58,237,0.14)",
                        border:"1px solid rgba(124,58,237,0.28)",
                        color:downloadingId===d.id?"#4b5563":"#c4b5fd",
                        fontSize:11,fontFamily:"inherit",fontWeight:700,
                        cursor:downloadingId===d.id?"not-allowed":"pointer",
                        letterSpacing:"0.08em",transition:"all 0.18s",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      }}
                    >
                      {downloadingId===d.id ? (
                        <span style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{
                            width:10,height:10,borderRadius:"50%",
                            border:"2px solid rgba(124,58,237,0.2)",
                            borderTop:"2px solid #7c3aed",
                            animation:"spin 0.7s linear infinite",
                            display:"inline-block",
                          }} />
                          DOWNLOADING
                        </span>
                      ) : (
                        <><span>↓</span> DOWNLOAD</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign:"center",fontSize:10,color:"#374151",
          padding:"32px 0 40px",letterSpacing:"0.12em",
        }}>
          © 2026 NEURORIFT · {datasets.length} datasets indexed
        </div>

      </div>
    </div>
  );
}