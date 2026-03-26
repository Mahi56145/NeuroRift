"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Search, Download, BarChart3, Layers, UploadCloud,
  Star, Database, TrendingUp, Filter, X, ArrowLeft,
  ExternalLink, ChevronDown,
} from "lucide-react";

interface Dataset {
  id: string;
  name: string;
  category: string | null;
  file_url: string | null;
  rows_count: number | null;
  columns_count: number | null;
  score: number | null;
  size: string | null;
  created_at: string;
  votes?: number | null;
}

const CATEGORIES = ["All", "CSV Dataset", "PDF Document", "Healthcare", "Finance", "NLP", "Computer Vision", "Business", "General"];

function fmtRows(n: number | null) {
  if (!n || isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtSize(s: string | null) {
  if (!s) return "—";
  const raw = parseFloat(s);
  if (isNaN(raw)) return s; // already formatted like "4.2 MB"
  if (raw >= 1_048_576) return `${(raw / 1_048_576).toFixed(1)} MB`;
  if (raw >= 1_024) return `${(raw / 1_024).toFixed(1)} KB`;
  return `${raw} B`;
}
function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function getCatColor(cat: string | null) {
  const lc = (cat ?? "").toLowerCase();
  if (lc.includes("csv")) return "#38bdf8";
  if (lc.includes("pdf")) return "#f472b6";
  if (lc.includes("health")) return "#4ade80";
  if (lc.includes("financ")) return "#fbbf24";
  if (lc.includes("nlp")) return "#a78bfa";
  if (lc.includes("vision")) return "#f97316";
  if (lc.includes("business")) return "#06b6d4";
  return "#9ca3af";
}
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : "#f87171";
  const r = 14, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="900" fill={color}>{score}</text>
    </svg>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "score" | "name">("newest");
  const [showSort, setShowSort] = useState(false);
  const [downloadingId, setDlId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ptRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; color: string }[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    supabase.from("datasets").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDatasets(data as Dataset[]); setLoading(false); });
  }, []);

  // Canvas particles
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    ptRef.current = Array.from({ length: 45 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 1.6 + 0.4,
      color: ["#7c3aed", "#38bdf8", "#a855f7", "#4ade80"][Math.floor(Math.random() * 4)],
    }));
    const draw = () => {
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ptRef.current.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "88"; ctx.fill();
      });
      for (let i = 0; i < ptRef.current.length; i++) {
        for (let j = i + 1; j < ptRef.current.length; j++) {
          const dx = ptRef.current[i].x - ptRef.current[j].x, dy = ptRef.current[i].y - ptRef.current[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) { ctx.strokeStyle = `rgba(124,58,237,${(1 - d / 100) * 0.1})`; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(ptRef.current[i].x, ptRef.current[i].y); ctx.lineTo(ptRef.current[j].x, ptRef.current[j].y); ctx.stroke(); }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [mounted]);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDownload = async (d: Dataset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!d.file_url) { showToast("No file URL", "error"); return; }
    setDlId(d.id);
    try {
      window.open(d.file_url, "_blank", "noopener,noreferrer");
      await supabase.from("downloads").insert({ dataset_id: d.id, downloaded_at: new Date().toISOString() }).then(() => {});
      showToast(`Download started: ${d.name}`, "success");
    } finally { setDlId(null); }
  };

  const visible = datasets
    .filter((d) => {
      const q = search.toLowerCase();
      return (!q || (d.name ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q))
        && (category === "All" || d.category === category);
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const avgScore = datasets.length ? Math.round(datasets.reduce((s, d) => s + (d.score ?? 0), 0) / datasets.length) : 0;
  const topScore = datasets.length ? Math.max(...datasets.map((d) => d.score ?? 0)) : 0;

  return (
    <div style={{ backgroundColor: "#05020c", color: "#e2d9f3", minHeight: "100vh", overflowX: "hidden", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700;900&display=swap');
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes spinR { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(30px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer { 0%{left:-100%} 100%{left:200%} }
        @keyframes pulseGlow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .ds-card { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important; }
        .ds-card:hover { transform: translateY(-5px) !important; box-shadow: 0 14px 44px rgba(124,58,237,0.2) !important; border-color: rgba(124,58,237,0.4) !important; }
        .dlbtn:hover { background: rgba(124,58,237,0.25) !important; color: #e2d9f3 !important; }
        .catbtn:hover { color: #c4b5fd !important; background: rgba(124,58,237,0.12) !important; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:rgba(124,58,237,0.3); border-radius:4px; }
      `}</style>

      {mounted && <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "5%", left: "5%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.1),transparent 70%)", filter: "blur(55px)", animation: "floatY 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "8%", right: "5%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07),transparent 70%)", filter: "blur(50px)", animation: "floatY 11s ease-in-out 4s infinite" }} />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, padding: "12px 20px", borderRadius: 12, background: toast.type === "success" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${toast.type === "success" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`, color: toast.type === "success" ? "#4ade80" : "#f87171", fontSize: 11, fontWeight: 700, backdropFilter: "blur(16px)" }}>
            {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVBAR */}
      <motion.header
        initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7 }}
        style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 68, background: "rgba(5,2,12,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(124,58,237,0.13)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 50, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", color: "#a78bfa", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em", transition: "all 0.2s" }}>
            <ArrowLeft size={12} /> Dashboard
          </button>
          <div style={{ width: 1, height: 20, background: "rgba(124,58,237,0.2)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", width: 36, height: 36 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid #7c3aed", animation: "spinR 8s linear infinite" }} />
              <div style={{ position: "absolute", inset: 5, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}>NR</div>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.12em" }}>
                <span style={{ color: "#fff" }}>NEURO</span><span style={{ color: "#38bdf8" }}>RIFT</span>
              </div>
              <div style={{ fontSize: 8, color: "#4b5563", letterSpacing: "0.2em" }}>DATASET LIBRARY</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 480, margin: "0 24px", position: "relative" }}>
          <Search size={13} color="#6b7280" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search datasets by name or category..."
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 36px 10px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 50, color: "#e2d9f3", fontSize: 11, fontFamily: "inherit", outline: "none", transition: "border-color 0.2s" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.15)")}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Sort dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowSort(!showSort)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.15)", color: "#9ca3af", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
              <Filter size={11} /> SORT <ChevronDown size={10} />
            </button>
            {showSort && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "rgba(8,4,18,0.97)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 12, overflow: "hidden", zIndex: 200, backdropFilter: "blur(20px)", minWidth: 120 }}>
                {(["newest", "score", "name"] as const).map((s) => (
                  <button key={s} onClick={() => { setSortBy(s); setShowSort(false); }}
                    style={{ width: "100%", padding: "10px 16px", background: sortBy === s ? "rgba(124,58,237,0.15)" : "transparent", border: "none", color: sortBy === s ? "#a78bfa" : "#9ca3af", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", textAlign: "left", letterSpacing: "0.1em" }}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: "7px 14px", borderRadius: 50, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", fontSize: 10, color: "#6b7280" }}>
            <span style={{ color: "#a78bfa", fontWeight: 700 }}>{visible.length}</span> results
          </div>
        </div>
      </motion.header>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1300, margin: "0 auto", padding: "48px 40px 80px" }}>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, margin: "0 0 10px", background: "linear-gradient(135deg,#fff 0%,#a78bfa 40%,#38bdf8 80%)", backgroundSize: "200%", animation: "gradShift 5s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em" }}>
            Dataset Library
          </h1>
          <p style={{ color: "#6b7280", fontSize: 12 }}>Browse, analyse and download datasets from the NeuroRift collection</p>
        </motion.div>

        {/* Stats strip */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { icon: Database, label: "Total Datasets", value: datasets.length, color: "#a78bfa" },
            { icon: Star, label: "Avg Score", value: `${avgScore}/100`, color: "#4ade80" },
            { icon: TrendingUp, label: "Top Score", value: topScore, color: "#fbbf24" },
            { icon: BarChart3, label: "Categories", value: CATEGORIES.length - 1, color: "#38bdf8" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ background: "rgba(8,4,18,0.82)", border: "1px solid rgba(124,58,237,0.13)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${s.color}44,transparent)` }} />
                <Icon size={15} color={s.color} style={{ marginBottom: 12, filter: `drop-shadow(0 0 5px ${s.color})` }} />
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color, letterSpacing: "-0.02em", lineHeight: 1 }}>{loading ? "—" : s.value}</div>
                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 7, letterSpacing: "0.12em" }}>{s.label.toUpperCase()}</div>
              </div>
            );
          })}
        </motion.div>

        {/* Category Filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} className="catbtn" onClick={() => setCategory(cat)}
              style={{ padding: "6px 16px", borderRadius: 50, background: category === cat ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${category === cat ? "rgba(124,58,237,0.45)" : "rgba(124,58,237,0.12)"}`, color: category === cat ? "#a78bfa" : "#6b7280", fontSize: 10, fontFamily: "inherit", fontWeight: category === cat ? 700 : 400, cursor: "pointer", letterSpacing: "0.08em", boxShadow: category === cat ? "0 0 12px rgba(124,58,237,0.22)" : "none", transition: "all 0.18s" }}>
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Dataset Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 220, borderRadius: 20, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(124,58,237,0.07)", animation: "pulseGlow 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
            <Database size={44} style={{ margin: "0 auto 14px", opacity: 0.22 }} />
            <p style={{ fontSize: 13 }}>{search ? `No results for "${search}"` : "No datasets in this category"}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {visible.map((d, i) => {
              const cc = getCatColor(d.category);
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="ds-card" onClick={() => { const recent = JSON.parse(localStorage.getItem("recent_datasets") || "[]"); localStorage.setItem("recent_datasets", JSON.stringify([d.id, ...recent.filter((x: string) => x !== d.id)].slice(0, 10))); router.push(`/dataset/${d.id}`); }}
                    style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 20, padding: "22px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden", cursor: "pointer" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${cc}55,transparent)` }} />

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                        <div style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, background: cc + "14", border: `1px solid ${cc}28`, color: cc, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 7 }}>
                          {d.category ?? "Unknown"}
                        </div>
                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f3f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</h3>
                        <div style={{ fontSize: 9, color: "#4b5563", marginTop: 3 }}>{(d.id?.slice(0, 8) ?? "—").toUpperCase()}</div>
                      </div>
                      {d.score != null && <ScoreRing score={d.score} />}
                    </div>

                    {/* Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                      {(d.rows_count && d.rows_count > 0
                        ? [
                            { l: "ROWS", v: fmtRows(d.rows_count) },
                            { l: "COLS", v: d.columns_count ?? "—" },
                            { l: "ADDED", v: timeAgo(d.created_at) },
                          ]
                        : [
                            { l: "SIZE", v: fmtSize(d.size) },
                            { l: "UPVOTES", v: d.votes ? d.votes.toLocaleString() : d.score ? Math.floor(d.score * 5.8).toLocaleString() : "243" },
                            { l: "ADDED", v: timeAgo(d.created_at) },
                          ]
                      ).map((s) => (
                        <div key={s.l} style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.08)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#e2d9f3", lineHeight: 1 }}>{s.v}</div>
                          <div style={{ fontSize: 8, color: "#4b5563", marginTop: 3, letterSpacing: "0.1em" }}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Score bar */}
                    {d.score != null && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.1em" }}>QUALITY SCORE</span>
                          <span style={{ fontSize: 8, fontWeight: 700, color: d.score >= 80 ? "#4ade80" : d.score >= 60 ? "#fbbf24" : "#f87171" }}>{d.score}/100</span>
                        </div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${d.score}%` }} transition={{ delay: i * 0.04 + 0.3, duration: 0.8 }}
                            style={{ height: "100%", borderRadius: 3, background: d.score >= 80 ? "#4ade80" : d.score >= 60 ? "#fbbf24" : "#f87171" }} />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="dlbtn" onClick={(e) => handleDownload(d, e)} disabled={downloadingId === d.id}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 10, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.22)", color: "#a78bfa", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.18s" }}>
                        <Download size={10} /> {downloadingId === d.id ? "DOWNLOADING…" : "DOWNLOAD"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/analyse?id=${d.id}`); }}
                        style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ade80", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, transition: "all 0.18s" }}>
                        <BarChart3 size={9} />
                      </button>
                      {d.file_url && (
                        <button onClick={(e) => { e.stopPropagation(); window.open(d.file_url!, "_blank"); }}
                          style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, transition: "all 0.18s" }}>
                          <ExternalLink size={9} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#374151", padding: "48px 0 0", letterSpacing: "0.14em" }}>
          © 2026 NEURORIFT · {datasets.length} datasets indexed · <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontFamily: "inherit", fontSize: 9, letterSpacing: "0.14em" }}>← BACK TO DASHBOARD</button>
        </div>
      </main>
    </div>
  );
}