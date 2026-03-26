"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Layers, ChevronLeft, Search, Trophy, Zap, Tag,
  CheckCircle, XCircle, TrendingUp, BarChart3, Database,
  Sparkles, ChevronDown, AlertTriangle, Shield, Cpu, Swords,
} from "lucide-react";

interface Dataset {
  id: string; name: string; category: string | null;
  rows_count: number | null; columns_count: number | null;
  score: number | null; size: string | null; created_at: string; votes?: number | null;
}
interface Enrichment {
  description: string; score: number; tags: string[]; use_cases: string[];
  difficulty?: string; preprocessingEffort?: string; recommendedModels?: string[];
  pros?: string[]; cons?: string[]; completeness?: number; biasWarnings?: string[];
  trainingReadiness?: string; businessValue?: string; statisticalProfile?: string;
}

// ─── Health Bar ───────────────────────────────────────────────────────────────
function HealthBar({ value, maxVal, color, label, suffix = "" }: { value: number; maxVal: number; color: string; label: string; suffix?: string }) {
  const pct = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.14em", fontWeight: 700 }}>{label.toUpperCase()}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{typeof value === "number" ? value.toLocaleString() : value}{suffix}</span>
      </div>
      <div style={{ height: 7, borderRadius: 7, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 7, background: `linear-gradient(90deg,${color}88,${color})`, boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  );
}

// ─── Dataset Picker ───────────────────────────────────────────────────────────
function DatasetPicker({ label, datasets, selected, onSelect, accentColor, disabled = false }: { label: string; datasets: Dataset[]; selected: Dataset | null; onSelect: (d: Dataset) => void; accentColor: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = datasets.filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.18em", fontWeight: 700, marginBottom: 7 }}>{label}</div>
      <div onClick={() => !disabled && setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: "rgba(8,4,18,0.9)", border: `1.5px solid ${open ? accentColor + "55" : "rgba(124,58,237,0.14)"}`, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: disabled ? 0.5 : 1, boxShadow: open ? `0 0 16px ${accentColor}18` : "none" }}>
        <Database size={12} color={accentColor} />
        <span style={{ flex: 1, fontSize: 11, color: selected ? "#e2d9f3" : "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? selected.name : "Select dataset…"}</span>
        <ChevronDown size={11} color="#6b7280" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scaleY: 0.9 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 300, background: "rgba(8,4,18,0.98)", border: `1px solid ${accentColor}20`, borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", maxHeight: 300 }}>
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${accentColor}10`, display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={10} color="#6b7280" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ flex: 1, background: "none", border: "none", color: "#e2d9f3", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
            </div>
            <div style={{ overflowY: "auto", maxHeight: 240 }}>
              {filtered.map((ds) => (
                <div key={ds.id} onClick={() => { onSelect(ds); setOpen(false); setQ(""); }}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderBottom: `1px solid ${accentColor}07`, background: ds.id === selected?.id ? `${accentColor}10` : "transparent", cursor: "pointer", transition: "background 0.14s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${accentColor}0a`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ds.id === selected?.id ? `${accentColor}10` : "transparent"; }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: ds.score != null ? (ds.score >= 80 ? "#4ade80" : ds.score >= 60 ? "#fbbf24" : "#f87171") : "#6b7280", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.name}</div>
                    <div style={{ fontSize: 8, color: "#6b7280" }}>{ds.category} · {ds.rows_count?.toLocaleString() ?? "?"} rows</div>
                  </div>
                  {ds.score != null && <span style={{ fontSize: 10, fontWeight: 800, color: ds.score >= 80 ? "#4ade80" : ds.score >= 60 ? "#fbbf24" : "#f87171" }}>{ds.score}</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dataset Battle Card ──────────────────────────────────────────────────────
function BattleCard({ ds, enrichment, accentColor, isWinner, loading }: { ds: Dataset; enrichment: Enrichment | null; accentColor: string; isWinner: boolean; loading: boolean }) {
  const diffColor = (d?: string) => d === "Easy" ? "#4ade80" : d === "Medium" ? "#fbbf24" : "#f87171";
  return (
    <motion.div initial={{ opacity: 0, x: accentColor === "#38bdf8" ? -24 : 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 200 }}
      style={{ background: "rgba(8,4,18,0.9)", border: `1.5px solid ${isWinner ? accentColor + "55" : "rgba(124,58,237,0.1)"}`, borderRadius: 22, padding: "24px", backdropFilter: "blur(16px)", position: "relative", overflow: "hidden", boxShadow: isWinner ? `0 0 44px ${accentColor}15` : "none", transition: "box-shadow 0.4s" }}>
      {isWinner && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ position: "absolute", top: 14, right: 14, display: "flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 20, background: `${accentColor}14`, border: `1px solid ${accentColor}35`, color: accentColor, fontSize: 8, fontWeight: 900, letterSpacing: "0.12em" }}>
          <Trophy size={10} /> WINNER
        </motion.div>
      )}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${accentColor}88,transparent)` }} />

      {/* Category + name */}
      <div style={{ marginBottom: 16, paddingRight: isWinner ? 80 : 0 }}>
        <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, background: accentColor + "10", border: `1px solid ${accentColor}22`, color: accentColor, fontSize: 8, fontWeight: 700, marginBottom: 7 }}>{ds.category ?? "Unknown"}</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f3f0ff", wordBreak: "break-word", lineHeight: 1.3 }}>{ds.name}</h3>
      </div>

      {/* Score ring + score */}
      {ds.score != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, padding: "13px 15px", background: `${accentColor}06`, border: `1px solid ${accentColor}14`, borderRadius: 14 }}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="19" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <motion.circle initial={{ strokeDasharray: "0 120" }} animate={{ strokeDasharray: `${(ds.score / 100) * 120} 120` }} transition={{ duration: 1.2 }}
              cx="25" cy="25" r="19" fill="none" stroke={accentColor} strokeWidth="4" strokeDashoffset="30" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }} />
            <text x="25" y="30" textAnchor="middle" fontSize="10" fontWeight="900" fill={accentColor}>{ds.score}</text>
          </svg>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: accentColor, lineHeight: 1 }}>{ds.score}/100</div>
            <div style={{ fontSize: 8, color: "#6b7280", marginTop: 4, letterSpacing: "0.12em" }}>QUALITY SCORE</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
        {[
          { l: "Rows", v: ds.rows_count?.toLocaleString() ?? "—", c: "#38bdf8" },
          { l: "Columns", v: ds.columns_count ?? "—", c: "#a78bfa" },
          { l: "Size", v: ds.size ?? "—", c: "#4ade80" },
          { l: "Votes", v: ds.votes ?? "—", c: "#fbbf24" },
        ].map((s) => (
          <div key={s.l} style={{ padding: "9px 11px", background: `${s.c}06`, border: `1px solid ${s.c}14`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 7, color: "#6b7280", marginTop: 3, letterSpacing: "0.1em" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "18px 0", color: "#6b7280", fontSize: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${accentColor}33`, borderTopColor: accentColor, animation: "spinR 0.8s linear infinite", margin: "0 auto 8px" }} />
          Groq AI analysing…
        </div>
      ) : enrichment ? (
        <>
          <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.75, marginBottom: 12 }}>{enrichment.description}</p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 11 }}>
            {enrichment.difficulty && <span style={{ padding: "2px 9px", borderRadius: 20, background: `${diffColor(enrichment.difficulty)}09`, border: `1px solid ${diffColor(enrichment.difficulty)}20`, fontSize: 8, color: diffColor(enrichment.difficulty), fontWeight: 700 }}>{enrichment.difficulty?.toUpperCase()} DIFFICULTY</span>}
            {enrichment.trainingReadiness && <span style={{ padding: "2px 9px", borderRadius: 20, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", fontSize: 8, color: "#4ade80", fontWeight: 700 }}>{enrichment.trainingReadiness?.toUpperCase()} READINESS</span>}
          </div>
          {/* Tags */}
          {enrichment.tags && enrichment.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 11 }}>
              {enrichment.tags.slice(0, 4).map((t) => <span key={t} style={{ padding: "2px 8px", background: `${accentColor}0c`, border: `1px solid ${accentColor}1e`, borderRadius: 20, fontSize: 8, color: accentColor, fontWeight: 700 }}>{t}</span>)}
            </div>
          )}
          {/* Pros/Cons brief */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(enrichment.pros ?? []).slice(0, 2).map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}><CheckCircle size={10} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: 10, color: "#9ca3af" }}>{p}</span></div>
            ))}
            {(enrichment.cons ?? []).slice(0, 2).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}><XCircle size={10} color="#f87171" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: 10, color: "#9ca3af" }}>{c}</span></div>
            ))}
          </div>
        </>
      ) : null}
    </motion.div>
  );
}

// ─── Inner ────────────────────────────────────────────────────────────────────
function CompareInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preA = params.get("a");

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dsA, setDsA] = useState<Dataset | null>(null);
  const [dsB, setDsB] = useState<Dataset | null>(null);
  const [enrichA, setEnrichA] = useState<Enrichment | null>(null);
  const [enrichB, setEnrichB] = useState<Enrichment | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [goingForVerdict, setGoingForVerdict] = useState(false);

  useEffect(() => {
    supabase.from("datasets").select("id,name,category,rows_count,columns_count,score,size,created_at,votes")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setDatasets(data as Dataset[]);
          if (preA) {
            const ds = (data as Dataset[]).find((d) => d.id === preA);
            if (ds) fetchEnrich(ds, "A");
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEnrich = async (ds: Dataset, side: "A" | "B") => {
    const setDs = side === "A" ? setDsA : setDsB;
    const setE = side === "A" ? setEnrichA : setEnrichB;
    const setL = side === "A" ? setLoadingA : setLoadingB;
    setDs(ds); setE(null); setL(true); setVerdict(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ds.name, category: ds.category, rows: ds.rows_count, cols: ds.columns_count, size: ds.size, votes: ds.votes, datasetId: ds.id }),
      });
      const data = await res.json();
      if (!data.error) setE(data);
    } catch { /* ignore */ }
    setL(false);
  };

  // Ask Groq for head-to-head verdict
  const generateVerdict = async () => {
    if (!dsA || !dsB || !enrichA || !enrichB) return;
    setGoingForVerdict(true); setVerdict(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compareMode: true,
          datasetA: { name: dsA.name, score: enrichA.score, rows: dsA.rows_count, cols: dsA.columns_count, difficulty: enrichA.difficulty, tags: enrichA.tags },
          datasetB: { name: dsB.name, score: enrichB.score, rows: dsB.rows_count, cols: dsB.columns_count, difficulty: enrichB.difficulty, tags: enrichB.tags },
        }),
      });
      const data = await res.json();
      if (data.verdict) setVerdict(data.verdict);
      else setVerdict(`${enrichA.score > enrichB.score ? dsA.name : dsB.name} outperforms with a higher quality score and better data completeness.`);
    } catch { setVerdict(`${enrichA.score > enrichB.score ? dsA.name : dsB.name} scores higher overall.`); }
    setGoingForVerdict(false);
  };

  const scoreA = enrichA?.score ?? dsA?.score ?? 0;
  const scoreB = enrichB?.score ?? dsB?.score ?? 0;
  const isReady = dsA && dsB && enrichA && enrichB && !loadingA && !loadingB;
  const winA = scoreA > scoreB, winB = scoreB > scoreA, tie = scoreA === scoreB && !!dsA && !!dsB;

  const comps = isReady ? [
    { label: "AI Score", a: scoreA, b: scoreB, max: 100, suffix: "/100" },
    { label: "Votes", a: dsA!.votes ?? 0, b: dsB!.votes ?? 0, max: Math.max(dsA!.votes ?? 1, dsB!.votes ?? 1) },
    { label: "Use Cases", a: enrichA!.use_cases?.length ?? 0, b: enrichB!.use_cases?.length ?? 0, max: Math.max(enrichA!.use_cases?.length ?? 1, enrichB!.use_cases?.length ?? 1) + 1 },
    { label: "Tags", a: enrichA!.tags?.length ?? 0, b: enrichB!.tags?.length ?? 0, max: Math.max(enrichA!.tags?.length ?? 1, enrichB!.tags?.length ?? 1) + 1 },
    { label: "Completeness", a: enrichA?.completeness ?? 70, b: enrichB?.completeness ?? 70, max: 100, suffix: "%" },
  ] : [];

  return (
    <div style={{ backgroundColor: "#05020c", color: "#e2d9f3", minHeight: "100vh", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700;900&display=swap');
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes spinR { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes winnerGlow { 0%,100%{box-shadow:0 0 20px rgba(251,191,36,0.2)} 50%{box-shadow:0 0 50px rgba(251,191,36,0.5)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:4px}
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.035) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "4%", left: "4%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07),transparent 70%)", filter: "blur(55px)", animation: "floatY 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "4%", right: "4%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(251,191,36,0.06),transparent 70%)", filter: "blur(55px)", animation: "floatY 10s ease-in-out 4s infinite" }} />
      </div>

      <div style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(5,2,12,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(251,191,36,0.1)" }}>
        <button onClick={() => router.push("/dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, padding: "7px 14px", color: "#9ca3af", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}><ChevronLeft size={12} /> Dashboard</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Swords size={14} color="#fbbf24" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#6b7280" }}>BATTLE ARENA</span>
          <span style={{ padding: "2px 10px", borderRadius: 20, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", fontSize: 8, color: "#fbbf24", fontWeight: 700 }}>HEAD-TO-HEAD</span>
        </div>
        <div style={{ width: 120 }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1340, margin: "0 auto", padding: "56px 40px 80px" }}>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 50, padding: "5px 16px", marginBottom: 16 }}>
            <Swords size={12} color="#fbbf24" />
            <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, letterSpacing: "0.2em" }}>BATTLE ARENA</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px,3.5vw,48px)", fontWeight: 900, margin: "0 0 10px", background: "linear-gradient(135deg,#fff,#fbbf24,#38bdf8)", backgroundSize: "200%", animation: "gradShift 4s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em" }}>
            Head-to-Head Battle
          </h1>
          <p style={{ color: "#6b7280", fontSize: 12 }}>Pick two datasets and let Groq AI deliver a full comparison with a definitive verdict.</p>
        </motion.div>

        {/* Pickers */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 18, alignItems: "center", marginBottom: 40, maxWidth: 920, margin: "0 auto 44px" }}>
          <DatasetPicker label="DATASET A · CHALLENGER" datasets={datasets} selected={dsA} onSelect={(ds) => fetchEnrich(ds, "A")} accentColor="#38bdf8" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Swords size={18} color="#a78bfa" />
            </motion.div>
            <span style={{ fontSize: 8, color: "#4b5563", letterSpacing: "0.1em" }}>VS</span>
          </div>
          <DatasetPicker label="DATASET B · DEFENDER" datasets={datasets} selected={dsB} onSelect={(ds) => fetchEnrich(ds, "B")} accentColor="#fbbf24" disabled={!dsA} />
        </motion.div>

        {/* Loading info */}
        {(loadingA || loadingB) && (dsA || dsB) && (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#6b7280", fontSize: 11 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(124,58,237,0.2)", borderTopColor: "#a78bfa", animation: "spinR 1s linear infinite", margin: "0 auto 10px" }} />
            Groq AI analysing {loadingA && loadingB ? "both datasets" : loadingA ? dsA?.name : dsB?.name}…
          </div>
        )}

        {/* Empty */}
        {!dsA && !dsB && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ textAlign: "center", padding: "80px 0", color: "#4b5563" }}>
            <Swords size={44} style={{ margin: "0 auto 14px", opacity: 0.2 }} />
            <p style={{ fontSize: 13 }}>Choose two datasets above to start the battle</p>
          </motion.div>
        )}

        {/* Battle cards */}
        {(dsA || dsB) && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
              {dsA ? (
                <BattleCard ds={dsA} enrichment={enrichA} accentColor="#38bdf8" isWinner={!!(isReady && winA)} loading={loadingA} />
              ) : (
                <div style={{ background: "rgba(8,4,18,0.5)", border: "2px dashed rgba(56,189,248,0.1)", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#4b5563", fontSize: 11 }}>Select Dataset A</div>
              )}
              {dsB ? (
                <BattleCard ds={dsB} enrichment={enrichB} accentColor="#fbbf24" isWinner={!!(isReady && winB)} loading={loadingB} />
              ) : (
                <div style={{ background: "rgba(8,4,18,0.5)", border: "2px dashed rgba(251,191,36,0.1)", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#4b5563", fontSize: 11 }}>Select Dataset B</div>
              )}
            </div>

            {/* Tie */}
            {tie && isReady && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 50, fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>
                  <Trophy size={14} /> It&apos;s a Tie! Both score {scoreA}/100
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Health bar comparison */}
        {isReady && comps.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 22, padding: "28px 32px", backdropFilter: "blur(16px)", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.2em", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={10} /> BATTLE STATS</div>
              <div style={{ display: "flex", gap: 16, fontSize: 9, fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 4, borderRadius: 2, background: "#38bdf8", display: "inline-block" }} />{dsA!.name.slice(0, 18)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 4, borderRadius: 2, background: "#fbbf24", display: "inline-block" }} />{dsB!.name.slice(0, 18)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
              <div>
                {comps.slice(0, 3).map((c) => <HealthBar key={c.label + "A"} value={c.a} maxVal={c.max} color="#38bdf8" label={c.label} suffix={c.suffix} />)}
              </div>
              <div>
                {comps.slice(0, 3).map((c) => <HealthBar key={c.label + "B"} value={c.b} maxVal={c.max} color="#fbbf24" label={c.label} suffix={c.suffix} />)}
              </div>
            </div>
          </motion.div>
        )}

        {/* Detail table */}
        {isReady && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.08)", borderRadius: 20, overflow: "hidden", marginBottom: 22 }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(124,58,237,0.06)", background: "rgba(124,58,237,0.03)" }}>
              <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.2em", fontWeight: 700 }}>DETAILED COMPARISON</div>
            </div>
            {[
              { l: "Category", a: dsA!.category ?? "—", b: dsB!.category ?? "—" },
              { l: "Rows", a: dsA!.rows_count?.toLocaleString() ?? "—", b: dsB!.rows_count?.toLocaleString() ?? "—" },
              { l: "Size", a: dsA!.size ?? "—", b: dsB!.size ?? "—" },
              { l: "AI Score", a: `${enrichA!.score}/100`, b: `${enrichB!.score}/100` },
              { l: "Difficulty", a: enrichA!.difficulty ?? "—", b: enrichB!.difficulty ?? "—" },
              { l: "Preprocessing", a: enrichA!.preprocessingEffort ?? "—", b: enrichB!.preprocessingEffort ?? "—" },
              { l: "Training Ready", a: enrichA!.trainingReadiness ?? "—", b: enrichB!.trainingReadiness ?? "—" },
            ].map((row, i) => (
              <div key={row.l} style={{ display: "grid", gridTemplateColumns: "130px 1fr 36px 1fr", gap: 8, padding: "12px 24px", borderBottom: i < 6 ? "1px solid rgba(124,58,237,0.04)" : "none", alignItems: "center" }}>
                <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.12em", fontWeight: 700 }}>{row.l.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: "#e2d9f3", fontWeight: 600 }}>{row.a}</div>
                <div style={{ fontSize: 9, color: "#374151", fontWeight: 700, textAlign: "center" }}>vs</div>
                <div style={{ fontSize: 11, color: "#e2d9f3", fontWeight: 600 }}>{row.b}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ML Models */}
        {isReady && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 22 }}>
            {[
              { ds: dsA!, enrich: enrichA!, color: "#38bdf8", side: "A" },
              { ds: dsB!, enrich: enrichB!, color: "#fbbf24", side: "B" },
            ].map(({ ds, enrich, color, side }) => (
              <div key={`${ds.id}-${side}`} style={{ background: "rgba(8,4,18,0.88)", border: `1px solid ${color}12`, borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
                <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <TrendingUp size={9} color={color} /> MODELS FOR {ds.name.slice(0, 16).toUpperCase()}
                </div>
                {(enrich.recommendedModels ?? []).map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: `${color}05`, borderRadius: 8, marginBottom: 6 }}>
                    <Zap size={9} color={color} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: color === "#38bdf8" ? "#93c5fd" : "#fde68a" }}>{m}</span>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}

        {/* AI Verdict button */}
        {isReady && !verdict && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }} style={{ textAlign: "center", marginBottom: 22 }}>
            <button onClick={generateVerdict} disabled={goingForVerdict}
              style={{ padding: "14px 40px", borderRadius: 50, backgroundColor: goingForVerdict ? "rgba(255,255,255,0.06)" : "transparent", backgroundImage: goingForVerdict ? "none" : "linear-gradient(135deg,#7c3aed,#a855f7,#fbbf24)", backgroundSize: "200%", animation: !goingForVerdict ? "gradShift 3s ease infinite" : "none", border: "none", color: goingForVerdict ? "#4b5563" : "#fff", fontSize: 12, fontWeight: 800, fontFamily: "inherit", letterSpacing: "0.1em", cursor: goingForVerdict ? "not-allowed" : "pointer", boxShadow: !goingForVerdict ? "0 0 30px rgba(124,58,237,0.4)" : "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {goingForVerdict ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spinR 0.8s linear infinite" }} /> Generating Verdict…</> : <><Cpu size={14} /> Get AI Verdict</>}
            </button>
          </motion.div>
        )}

        {/* Winner + Verdict */}
        {isReady && (winA || winB || verdict) && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: "spring", stiffness: 200 }}
            style={{ padding: "28px 36px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: 20, textAlign: "center", animation: "winnerGlow 2.5s ease-in-out infinite" }}>
            <Trophy size={32} color="#fbbf24" style={{ margin: "0 auto 12px" }} />
            {(winA || winB) && (
              <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#fbbf24" }}>
                {winA ? dsA!.name : dsB!.name} wins!
              </h3>
            )}
            {tie && <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900, color: "#a78bfa" }}>It&apos;s a draw!</h3>}
            {verdict && <p style={{ margin: "0 auto", fontSize: 12, color: "#d1d5db", lineHeight: 1.8, maxWidth: 600 }}>{verdict}</p>}
            {!verdict && <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Score: {winA ? scoreA : scoreB}/100 vs {winA ? scoreB : scoreA}/100 · Click &quot;Get AI Verdict&quot; for detailed reasoning</p>}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div style={{ background: "#05020c", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontFamily: "monospace" }}>Loading…</div>}>
      <CompareInner />
    </Suspense>
  );
}
