"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  BarChart3, ChevronLeft, Search, Loader2, Sparkles, Tag,
  Zap, CheckCircle, XCircle, AlertTriangle, Database,
  TrendingUp, Shield, Trophy, Star, ChevronDown, Cpu,
  Activity, Info,
} from "lucide-react";

interface Dataset {
  id: string; name: string; category: string | null;
  rows_count: number | null; columns_count: number | null;
  score: number | null; size: string | null; created_at: string; votes?: number | null;
}
interface Enrichment {
  description: string; score: number; tags: string[]; use_cases: string[];
  difficulty?: string; preprocessingEffort?: string; recommendedModels?: string[];
  pros?: string[]; cons?: string[];
  // Rich fields from Groq
  completeness?: number; biasWarnings?: string[]; columnInsights?: string[];
  trainingReadiness?: string; dataQualityInsights?: string;
  statisticalProfile?: string; businessValue?: string;
}

// ─── XP / Level for datasets ─────────────────────────────────────────────────
function getDatasetLevel(score: number) {
  if (score >= 90) return { level: "S", label: "Elite Dataset", color: "#fbbf24", glow: "rgba(251,191,36,0.5)" };
  if (score >= 80) return { level: "A", label: "High Quality", color: "#4ade80", glow: "rgba(74,222,128,0.5)" };
  if (score >= 65) return { level: "B", label: "Good Quality", color: "#38bdf8", glow: "rgba(56,189,248,0.5)" };
  if (score >= 50) return { level: "C", label: "Average", color: "#a78bfa", glow: "rgba(167,139,250,0.5)" };
  return { level: "D", label: "Needs Work", color: "#f87171", glow: "rgba(248,113,113,0.5)" };
}

// ─── Radar (SVG) ──────────────────────────────────────────────────────────────
function RadarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const cx = 160, cy = 160, r = 110;
  const n = data.length;
  const angles = data.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2);
  const pts = (scale: number) => data.map(({ value }, i) => {
    const a = angles[i], v = (value / 100) * scale;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as [number, number];
  });
  const toPath = (points: [number, number][]) => points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 320, overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={pts(g).map((p) => p.join(",")).join(" ")} fill="none" stroke={`rgba(124,58,237,${0.05 + g * 0.07})`} strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = [cx + Math.cos(angles[i]) * r, cy + Math.sin(angles[i]) * r];
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(124,58,237,0.1)" strokeWidth="1" />;
      })}
      <motion.path initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} style={{ transformOrigin: `${cx}px ${cy}px` }}
        d={toPath(pts(1))} fill="url(#rg)" stroke="rgba(167,139,250,0.75)" strokeWidth="1.5" />
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(167,139,250,0.35)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0.08)" />
        </radialGradient>
      </defs>
      {pts(1).map(([px, py], i) => (
        <motion.circle key={i} initial={{ r: 0 }} animate={{ r: 4 }} transition={{ delay: 0.6 + i * 0.08 }}
          cx={px} cy={py} fill={data[i].color} style={{ filter: `drop-shadow(0 0 6px ${data[i].color})` }} />
      ))}
      {data.map(({ label, value }, i) => {
        const lx = cx + Math.cos(angles[i]) * (r + 26);
        const ly = cy + Math.sin(angles[i]) * (r + 26);
        return (
          <g key={i}>
            <text x={lx} y={ly} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#9ca3af" fontFamily="monospace">{label}</text>
            <text x={lx} y={ly + 11} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={data[i].color} fontFamily="monospace">{value}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimNum({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0, total = 40;
    const step = () => { frame++; setDisplay(Math.round((frame / total) * value)); if (frame < total) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display}{suffix}</>;
}

function AnalyseInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preId = searchParams.get("id");

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [achievement, setAchievement] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("datasets").select("id,name,category,rows_count,columns_count,score,size,created_at,votes")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDatasets(data as Dataset[]); setLoadingList(false); });
  }, []);

  useEffect(() => {
    if (preId && datasets.length > 0) {
      const ds = datasets.find((d) => d.id === preId);
      if (ds) handleSelect(ds);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, preId]);

  const handleSelect = async (ds: Dataset) => {
    setSelected(ds); setShowDrop(false); setSearchQ(""); setEnrichment(null); setLoading(true);
    // Increment analyses count in localStorage
    const cur = parseInt(localStorage.getItem("nr_analyses") || "0");
    localStorage.setItem("nr_analyses", String(cur + 1));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ds.name, category: ds.category, rows: ds.rows_count, cols: ds.columns_count, size: ds.size, votes: ds.votes, datasetId: ds.id }),
      });
      const data = await res.json();
      if (!data.error) {
        setEnrichment(data);
        // Achievement popup
        if ((data.score ?? 0) >= 80) setAchievement("🏆 High Quality Dataset Detected!");
        else if ((data.score ?? 0) >= 65) setAchievement("✨ Good Dataset - Ready for Training!");
        setTimeout(() => setAchievement(null), 3500);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const filtered = datasets.filter((d) => !searchQ || d.name.toLowerCase().includes(searchQ.toLowerCase()) || (d.category ?? "").toLowerCase().includes(searchQ.toLowerCase()));

  const radarData = enrichment && selected ? [
    { label: "Quality", value: enrichment.score ?? 0, color: "#a78bfa" },
    { label: "Scale", value: Math.min(100, Math.round(((selected.rows_count ?? 0) / 100000) * 100)), color: "#38bdf8" },
    { label: "Features", value: Math.min(100, Math.round(((selected.columns_count ?? 0) / 50) * 100)), color: "#4ade80" },
    { label: "Usability", value: enrichment.difficulty === "Easy" ? 90 : enrichment.difficulty === "Medium" ? 62 : 35, color: "#fbbf24" },
    { label: "Coverage", value: Math.min(100, 35 + (enrichment.use_cases?.length ?? 0) * 14), color: "#f472b6" },
    { label: "Complete", value: enrichment.completeness ?? Math.min(100, 50 + (enrichment.score ?? 0) * 0.4), color: "#f97316" },
  ] : null;

  const dsLevel = enrichment ? getDatasetLevel(enrichment.score) : null;
  const diffColor = (d?: string) => d === "Easy" ? "#4ade80" : d === "Medium" ? "#fbbf24" : "#f87171";

  return (
    <div style={{ backgroundColor: "#05020c", color: "#e2d9f3", minHeight: "100vh", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700;900&display=swap');
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes spinR { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes achievePop { 0%{opacity:0;transform:translateY(-20px) scale(0.9)} 20%{opacity:1;transform:translateY(0) scale(1)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-10px)} }
        @keyframes levelGlow { 0%,100%{box-shadow:0 0 20px var(--c)} 50%{box-shadow:0 0 40px var(--c), 0 0 80px var(--c)} }
        @keyframes scanBar { 0%{left:-100%} 100%{left:200%} }
        .ds-opt:hover { background:rgba(124,58,237,0.1) !important; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:4px}
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.035) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "3%", left: "3%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle,rgba(74,222,128,0.07),transparent 70%)", filter: "blur(55px)", animation: "floatY 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "5%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.09),transparent 70%)", filter: "blur(50px)", animation: "floatY 9s ease-in-out 4s infinite" }} />
      </div>

      {/* Achievement popup */}
      <AnimatePresence>
        {achievement && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 500, padding: "12px 28px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 50, fontSize: 12, fontWeight: 700, color: "#fbbf24", backdropFilter: "blur(20px)", boxShadow: "0 0 30px rgba(251,191,36,0.3)", whiteSpace: "nowrap" }}>
            {achievement}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(5,2,12,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
        <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, padding: "7px 14px", color: "#9ca3af", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}><ChevronLeft size={12} /> Dashboard</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={14} color="#4ade80" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#6b7280" }}>DEEP ANALYSE ENGINE</span>
          <span style={{ padding: "2px 10px", borderRadius: 20, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", fontSize: 8, color: "#4ade80", fontWeight: 700 }}>v2 · GROQ POWERED</span>
        </div>
        <div style={{ width: 120 }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1260, margin: "0 auto", padding: "56px 40px 80px" }}>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 50, padding: "5px 16px", marginBottom: 16 }}>
            <Trophy size={12} color="#4ade80" />
            <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, letterSpacing: "0.2em" }}>DEEP ANALYSE ENGINE</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px,3.5vw,48px)", fontWeight: 900, margin: "0 0 10px", background: "linear-gradient(135deg,#fff,#4ade80,#38bdf8)", backgroundSize: "200%", animation: "gradShift 4s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em" }}>
            Dissect Your Dataset
          </h1>
          <p style={{ color: "#6b7280", fontSize: 12 }}>AI-powered full intelligence breakdown · quality score · bias detection · training readiness</p>
        </motion.div>

        {/* Dataset Selector */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ maxWidth: 620, margin: "0 auto 48px", position: "relative" }}>
          <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.18em", fontWeight: 700, marginBottom: 8 }}>SELECT DATASET TO ANALYSE</div>
          <div onClick={() => setShowDrop(!showDrop)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderRadius: 16, background: "rgba(8,4,18,0.88)", backdropFilter: "blur(16px)", border: `1px solid ${showDrop ? "rgba(74,222,128,0.45)" : "rgba(74,222,128,0.15)"}`, cursor: "pointer", boxShadow: showDrop ? "0 0 18px rgba(74,222,128,0.12)" : "none", transition: "all 0.2s" }}>
            <Database size={13} color="#4ade80" />
            <span style={{ flex: 1, fontSize: 12, color: selected ? "#e2d9f3" : "#6b7280" }}>{selected ? selected.name : (loadingList ? "Loading…" : "Choose a dataset…")}</span>
            <ChevronDown size={13} color="#6b7280" style={{ transform: showDrop ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
          </div>
          <AnimatePresence>
            {showDrop && (
              <motion.div initial={{ opacity: 0, y: -8, scaleY: 0.9 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0 }}
                style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200, background: "rgba(8,4,18,0.98)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", maxHeight: 320 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderBottom: "1px solid rgba(74,222,128,0.07)" }}>
                  <Search size={11} color="#6b7280" />
                  <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search…" style={{ flex: 1, background: "none", border: "none", color: "#e2d9f3", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div style={{ overflowY: "auto", maxHeight: 260 }}>
                  {filtered.map((ds) => (
                    <div key={ds.id} className="ds-opt" onClick={() => handleSelect(ds)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid rgba(74,222,128,0.04)", background: ds.id === selected?.id ? "rgba(74,222,128,0.08)" : "transparent", cursor: "pointer", transition: "background 0.14s" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: ds.score != null ? (ds.score >= 80 ? "#4ade80" : ds.score >= 60 ? "#fbbf24" : "#f87171") : "#6b7280", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.name}</div>
                        <div style={{ fontSize: 9, color: "#6b7280" }}>{ds.category} · {ds.rows_count?.toLocaleString() ?? "?"} rows</div>
                      </div>
                      {ds.score != null && <span style={{ fontSize: 11, fontWeight: 800, color: ds.score >= 80 ? "#4ade80" : ds.score >= 60 ? "#fbbf24" : "#f87171" }}>{ds.score}</span>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#4ade80", animation: "spinR 1s linear infinite" }} />
              <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#a78bfa", animation: "spinR 0.7s linear infinite reverse" }} />
              <Cpu size={24} color="#4ade80" style={{ position: "absolute", inset: 0, margin: "auto" }} />
            </div>
            <p style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.1em" }}>Groq AI is running a full intelligence scan…</p>
            <div style={{ width: 200, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, margin: "14px auto 0", overflow: "hidden" }}>
              <motion.div animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} style={{ height: "100%", width: "60%", background: "linear-gradient(90deg,transparent,#4ade80,transparent)", borderRadius: 2 }} />
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {enrichment && selected && !loading && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 160 }}>
              {/* Dataset + level header */}
              {dsLevel && (
                <div style={{ textAlign: "center", marginBottom: 36 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 36px", background: "rgba(8,4,18,0.9)", border: `1px solid ${dsLevel.color}30`, borderRadius: 50, backdropFilter: "blur(16px)" }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: `${dsLevel.color}12`, border: `2px solid ${dsLevel.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: dsLevel.color, boxShadow: `0 0 24px ${dsLevel.glow}` }}>
                      {dsLevel.level}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 11, color: dsLevel.color, fontWeight: 700, letterSpacing: "0.12em" }}>{dsLevel.label.toUpperCase()}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#f3f0ff" }}>{selected.name}</div>
                    </div>
                    <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      {selected.category && <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 9, color: "#38bdf8", fontWeight: 700 }}>{selected.category}</span>}
                      {enrichment.difficulty && <span style={{ padding: "3px 10px", borderRadius: 20, background: `${diffColor(enrichment.difficulty)}10`, border: `1px solid ${diffColor(enrichment.difficulty)}25`, fontSize: 9, color: diffColor(enrichment.difficulty), fontWeight: 700 }}>{enrichment.difficulty.toUpperCase()}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* TOP GRID: Radar + Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, marginBottom: 20 }}>
                {/* Radar */}
                <div style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 20, padding: "24px 16px", backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.18em", fontWeight: 700, marginBottom: 14 }}>6-AXIS INTELLIGENCE RADAR</div>
                  {radarData && <RadarChart data={radarData} />}
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Score strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "AI Score", value: enrichment.score, suffix: "/100", color: "#a78bfa" },
                      { label: "Rows", value: selected.rows_count ?? 0, color: "#38bdf8" },
                      { label: "Columns", value: selected.columns_count ?? 0, color: "#4ade80" },
                      { label: "Completeness", value: enrichment.completeness ?? 0, suffix: "%", color: "#fbbf24" },
                    ].map((s) => (
                      <div key={s.label} style={{ padding: "16px 16px", background: `${s.color}07`, border: `1px solid ${s.color}18`, borderRadius: 14 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: "-0.02em", lineHeight: 1, textShadow: `0 0 16px ${s.color}55` }}>
                          <AnimNum value={typeof s.value === "number" ? s.value : 0} suffix={s.suffix} />
                        </div>
                        <div style={{ fontSize: 8, color: "#6b7280", marginTop: 6, letterSpacing: "0.12em" }}>{s.label.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Description */}
                  <div style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 16, padding: "18px", backdropFilter: "blur(12px)", flex: 1 }}>
                    <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Sparkles size={9} color="#a78bfa" /> GROQ AI INTELLIGENCE REPORT</div>
                    <p style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.85, margin: 0 }}>{enrichment.description}</p>
                  </div>

                  {/* Readiness + Prep */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ padding: "14px 16px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 12 }}>
                      <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.12em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Shield size={8} color="#4ade80" /> TRAINING READINESS</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{enrichment.trainingReadiness ?? "Good"}</div>
                    </div>
                    <div style={{ padding: "14px 16px", background: `${diffColor(enrichment.preprocessingEffort)}07`, border: `1px solid ${diffColor(enrichment.preprocessingEffort)}18`, borderRadius: 12 }}>
                      <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.12em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Activity size={8} color={diffColor(enrichment.preprocessingEffort)} /> PREPROCESSING EFFORT</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: diffColor(enrichment.preprocessingEffort) }}>{enrichment.preprocessingEffort ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {enrichment.tags && enrichment.tags.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.08)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(12px)", marginBottom: 18 }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><Tag size={9} /> AI INTELLIGENCE TAGS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {enrichment.tags.map((t) => <span key={t} style={{ padding: "4px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 20, fontSize: 10, color: "#c4b5fd", fontWeight: 700 }}>{t}</span>)}
                  </div>
                </motion.div>
              )}

              {/* Stats insights */}
              {enrichment.statisticalProfile && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(12px)", marginBottom: 18 }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Info size={9} color="#38bdf8" /> STATISTICAL PROFILE</div>
                  <p style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.75, margin: 0 }}>{enrichment.statisticalProfile}</p>
                </motion.div>
              )}

              {/* Bias Warnings */}
              {enrichment.biasWarnings && enrichment.biasWarnings.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(12px)", marginBottom: 18 }}>
                  <div style={{ fontSize: 8, color: "#fbbf24", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>⚠ BIAS & FAIRNESS WARNINGS</div>
                  {enrichment.biasWarnings.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                      <AlertTriangle size={11} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#fcd34d", lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Bottom 3-col grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
                {/* Use cases */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><Zap size={9} color="#38bdf8" /> USE CASES</div>
                  {(enrichment.use_cases ?? []).map((u, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 7 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8", marginTop: 4, flexShrink: 0, boxShadow: "0 0 6px #38bdf8" }} />
                      <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{u}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Pros */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><CheckCircle size={9} color="#4ade80" /> STRENGTHS</div>
                  {(enrichment.pros ?? []).map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 7 }}>
                      <CheckCircle size={10} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{p}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Cons */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(248,113,113,0.1)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><XCircle size={9} color="#f87171" /> LIMITATIONS</div>
                  {(enrichment.cons ?? []).length === 0
                    ? <p style={{ fontSize: 10, color: "#4b5563" }}>No significant limitations detected</p>
                    : (enrichment.cons ?? []).map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 7 }}>
                        <XCircle size={10} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{c}</span>
                      </div>
                    ))
                  }
                </motion.div>
              </div>

              {/* Business value */}
              {enrichment.businessValue && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 18, padding: "18px 22px", backdropFilter: "blur(12px)", marginBottom: 18 }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><Star size={9} color="#a78bfa" /> BUSINESS VALUE ASSESSMENT</div>
                  <p style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.75, margin: 0 }}>{enrichment.businessValue}</p>
                </motion.div>
              )}

              {/* Recommended models */}
              {enrichment.recommendedModels && enrichment.recommendedModels.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 18, padding: "20px 22px", backdropFilter: "blur(12px)", marginBottom: 20 }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}><TrendingUp size={9} /> RECOMMENDED ML MODELS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
                    {enrichment.recommendedModels.map((m, i) => (
                      <div key={i} style={{ padding: "10px 14px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.12)", borderRadius: 10, display: "flex", alignItems: "center", gap: 7 }}>
                        <TrendingUp size={11} color="#a78bfa" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "#c4b5fd" }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => router.push(`/dashboard/compare?a=${selected.id}`)}
                  style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", color: "#fbbf24", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  Compare with Another →
                </button>
                <button onClick={() => { setSelected(null); setEnrichment(null); }}
                  style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  Analyse Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty */}
        {!loading && !selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
            <BarChart3 size={44} style={{ margin: "0 auto 14px", opacity: 0.2 }} />
            <p style={{ fontSize: 13 }}>Select a dataset above to begin the intelligence scan</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function AnalysePage() {
  return (
    <Suspense fallback={<div style={{ background: "#05020c", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontFamily: "monospace" }}>Loading…</div>}>
      <AnalyseInner />
    </Suspense>
  );
}
