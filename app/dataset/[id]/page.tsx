"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

interface Dataset {
  id: string;
  name: string;
  slug?: string;
  category: string;
  size?: string;
  votes?: number;
  file_url?: string;
  kaggle_url?: string;
  rows_count?: number;
  columns_count?: number;
  score: number;
  created_at: string;
  file_type?: string;
  description?: string;
}

function sc(s: number) {
  if (s > 80) return { fg: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", glow: "rgba(34,197,94,0.25)" };
  if (s > 60) return { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", glow: "rgba(251,191,36,0.2)" };
  return { fg: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", glow: "rgba(239,68,68,0.2)" };
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getBreakdown(score: number) {
  const seed = (score ?? 0) / 100;
  return [
    { label: "Completeness", pct: Math.round(seed * 95 + 2),  icon: "◈", color: "#a78bfa" },
    { label: "Consistency",  pct: Math.round(seed * 88 + 5),  icon: "◆", color: "#38bdf8" },
    { label: "Accuracy",     pct: Math.round(seed * 92 + 3),  icon: "◉", color: "#4ade80" },
    { label: "Uniqueness",   pct: Math.round(seed * 78 + 10), icon: "⬟", color: "#fbbf24" },
    { label: "Timeliness",   pct: Math.round(seed * 85 + 8),  icon: "⬡", color: "#f472b6" },
  ];
}

const USE_CASES: Record<string, string[]> = {
  Healthcare:      ["Disease Prediction", "Clinical NLP", "Medical Imaging", "Patient Outcome Modeling", "Drug Discovery"],
  "Computer Vision": ["Object Detection", "Image Classification", "Segmentation", "Visual Q&A", "Anomaly Detection"],
  NLP:             ["Sentiment Analysis", "Text Classification", "LLM Fine-tuning", "Named Entity Recognition", "Summarization"],
  Finance:         ["Fraud Detection", "Stock Forecasting", "Credit Scoring", "Risk Modeling", "Algorithmic Trading"],
  Business:        ["Churn Prediction", "Customer Segmentation", "Sales Forecasting", "Marketing Attribution"],
  General:         ["Supervised Learning", "Feature Engineering", "Exploratory Analysis", "Regression", "Classification"],
};

const ALSO_EXPLORE: Record<string, string[]> = {
  Healthcare:      ["WHO Disease Stats", "NIH Clinical Trials", "MIMIC-III", "PhysioNet ECG"],
  "Computer Vision": ["COCO 2017", "ImageNet-1K", "Open Images V7", "CIFAR-100"],
  NLP:             ["Common Crawl", "WikiText-103", "SQuAD 2.0", "IMDB Reviews"],
  Finance:         ["S&P 500 Historical", "Kaggle Credit Risk", "FRED Economics"],
  Business:        ["Superstore Sales", "E-Commerce Reviews", "Customer LTV"],
  General:         ["UCI ML Repository", "OpenML Datasets", "Hugging Face"],
};

function ScoreRing({ score }: { score: number }) {
  const s = score ?? 0;
  const c = sc(s);
  const r = 52, circ = 2 * Math.PI * r, dash = (s / 100) * circ;
  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={c.fg} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${c.glow})`, transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: c.fg, letterSpacing: "-0.03em", lineHeight: 1 }}>{s}</span>
        <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.12em", marginTop: 2 }}>SCORE</span>
      </div>
    </div>
  );
}

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [dataset,         setDataset]         = useState<Dataset | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [downloading,     setDownloading]     = useState(false);
  const [activeTab,       setActiveTab]       = useState<"overview" | "quality" | "similar">("overview");
  const [toast,           setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [insightVisible,  setInsightVisible]  = useState(false);
  const [dlCount,         setDlCount]         = useState(0);
  const [related,         setRelated]         = useState<Dataset[]>([]);

  const fetchDataset = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase.from("datasets").select("*").eq("id", id).single();
      if (e) throw e;
      setDataset(data);
      setTimeout(() => setInsightVisible(true), 400);
      const { count } = await supabase.from("downloads").select("*", { count: "exact", head: true }).eq("dataset_id", id);
      setDlCount(count ?? 0);
      if (data?.category) {
        const { data: rel } = await supabase.from("datasets").select("*")
          .eq("category", data.category).neq("id", id).limit(6).order("score", { ascending: false });
        setRelated(rel ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Dataset not found.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchDataset(); }, [fetchDataset]);

  const handleDownload = async () => {
    const link = dataset?.file_url || dataset?.kaggle_url;
    if (!link) { showToast("No download URL available.", "error"); return; }
    setDownloading(true);
    try {
      window.open(link, "_blank", "noopener,noreferrer");
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("downloads").insert({ dataset_id: dataset!.id, downloaded_at: new Date().toISOString(), user_id: session?.user?.id ?? null });
      setDlCount(c => c + 1);
      showToast("Download started successfully.", "success");
    } catch { showToast("Failed to log download.", "error"); }
    finally { setDownloading(false); }
  };

  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const score     = dataset?.score ?? 0;
  const c         = sc(score);
  const breakdown = dataset ? getBreakdown(score) : [];
  const useCases  = USE_CASES[dataset?.category ?? "General"] ?? USE_CASES.General;
  const alsoExpl  = ALSO_EXPLORE[dataset?.category ?? "General"] ?? ALSO_EXPLORE.General;
  const activeUrl = dataset?.file_url || dataset?.kaggle_url || "";
  const isKaggle  = !dataset?.file_url && !!dataset?.kaggle_url;

  const insights = dataset ? [
    { icon: "🧠", title: "Quality Assessment", color: c.fg, bg: c.bg, border: c.border,
      text: score > 80 ? `Score ${score}/100 — production-ready. Minimal preprocessing needed.`
          : score > 60 ? `Score ${score}/100 — moderate cleaning recommended. Handle nulls and outliers before training.`
          : `Score ${score}/100 — significant preprocessing required. Validate schema and remove noise.` },
    { icon: "📊", title: "Data Profile", color: "#a78bfa", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.25)",
      text: `Categorized under ${dataset.category}.${dataset.votes ? ` Voted by ${dataset.votes.toLocaleString()} Kaggle community members.` : ""}${dataset.size ? ` Dataset size: ${dataset.size}.` : ""} Best for ${useCases.slice(0,2).join(" and ")}.` },
    { icon: "⚡", title: "Pipeline Compatibility", color: "#38bdf8", bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)",
      text: `Compatible with scikit-learn, PyTorch, TensorFlow, and Hugging Face. ${dataset.category === "NLP" ? "Tokenization preprocessing required." : dataset.category === "Computer Vision" ? "GPU acceleration strongly recommended." : "Standard tabular pipelines apply."}` },
    { icon: "🔗", title: "Access Method", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.25)",
      text: isKaggle
        ? `Hosted on Kaggle. CLI: kaggle datasets download -d ${dataset.slug ?? "owner/dataset"}. Kaggle account and API token required.`
        : `Direct HTTP download available. Integrate the file URL directly into your data pipeline or ETL workflow.` },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0812", fontFamily: "'IBM Plex Mono','Fira Code',monospace", color: "#e2d9f3", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes pulse    { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes toastIn  { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes barFill  { from{width:0} to{width:var(--w)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes orb1     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-40px) scale(1.07)} }
        @keyframes orb2     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-45px,35px) scale(0.94)} }
        .tab-item:hover     { color:#c4b5fd !important; background:rgba(124,58,237,0.1) !important; }
        .dl-btn:hover       { box-shadow:0 0 42px rgba(124,58,237,0.7) !important; transform:translateY(-2px) !important; }
        .back-btn:hover     { background:rgba(124,58,237,0.22) !important; color:#c4b5fd !important; }
        .rel-card:hover     { transform:translateY(-4px) !important; border-color:rgba(124,58,237,0.42) !important; box-shadow:0 8px 30px rgba(124,58,237,0.22) !important; }
        .stat-tile:hover    { transform:translateY(-3px) !important; border-color:rgba(124,58,237,0.35) !important; }
        .insight-card:hover { transform:translateY(-2px) !important; }
        .use-tag:hover      { background:rgba(124,58,237,0.22) !important; color:#c4b5fd !important; }
        .also-tag:hover     { background:rgba(124,58,237,0.18) !important; }
      `}</style>

      {/* Animated orbs */}
      <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:"2%",left:"6%",width:480,height:480,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.22) 0%,transparent 70%)",filter:"blur(55px)",animation:"orb1 22s ease-in-out infinite" }} />
        <div style={{ position:"absolute",top:"18%",right:"4%",width:360,height:360,borderRadius:"50%",background:"radial-gradient(circle,rgba(56,189,248,0.16) 0%,transparent 70%)",filter:"blur(60px)",animation:"orb2 28s ease-in-out infinite 6s" }} />
        <div style={{ position:"absolute",bottom:"8%",left:"22%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.14) 0%,transparent 70%)",filter:"blur(65px)",animation:"orb1 32s ease-in-out infinite 12s" }} />
        <div style={{ position:"absolute",bottom:"4%",right:"12%",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,0.1) 0%,transparent 70%)",filter:"blur(50px)",animation:"orb2 24s ease-in-out infinite 4s" }} />
      </div>
      <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
      <div style={{ position:"fixed",left:0,right:0,height:1,zIndex:1,pointerEvents:"none",background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(56,189,248,0.15),transparent)",animation:"scanline 10s linear infinite" }} />

      {/* Toast */}
      {toast && <div style={{ position:"fixed",bottom:28,right:28,zIndex:9999,padding:"12px 20px",borderRadius:10,background:toast.type==="success"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.35)":"rgba(239,68,68,0.35)"}`,color:toast.type==="success"?"#4ade80":"#f87171",fontSize:12,fontFamily:"inherit",fontWeight:600,backdropFilter:"blur(16px)",animation:"toastIn 0.3s ease" }}>{toast.type==="success"?"✓ ":"✕ "}{toast.msg}</div>}

      {/* Header */}
      <header style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 32px",borderBottom:"1px solid rgba(124,58,237,0.15)",background:"rgba(8,5,18,0.9)",backdropFilter:"blur(24px)",position:"sticky",top:0,zIndex:50 }}>
        <button className="back-btn" onClick={() => router.back()} style={{ background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.22)",color:"#a78bfa",borderRadius:8,padding:"7px 14px",fontSize:12,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.15s" }}>← Back</button>
        <div style={{ width:1,height:20,background:"rgba(124,58,237,0.2)" }} />
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#7c3aed,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:"#fff",boxShadow:"0 0 14px rgba(124,58,237,0.5)" }}>N</div>
          <span style={{ fontWeight:800,fontSize:13,letterSpacing:"0.12em" }}><span style={{ color:"#fff" }}>NEURO</span><span style={{ color:"#38bdf8" }}>RIFT</span></span>
        </div>
        {dataset && <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:11,color:"#6b7280" }}>{dataset.category}</span>
          <span style={{ width:4,height:4,borderRadius:"50%",background:"rgba(124,58,237,0.5)" }} />
          <span style={{ fontSize:11,padding:"3px 10px",borderRadius:5,background:c.bg,border:`1px solid ${c.border}`,color:c.fg,fontWeight:700 }}>{score}/100</span>
        </div>}
      </header>

      {/* Loading */}
      {loading && <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:16 }}>
        <div style={{ width:48,height:48,borderRadius:"50%",border:"2px solid rgba(124,58,237,0.15)",borderTop:"2px solid #7c3aed",animation:"spin 0.8s linear infinite" }} />
        <div style={{ fontSize:11,color:"#6b7280",letterSpacing:"0.15em" }}>Loading Dataset...</div>
      </div>}

      {/* Error */}
      {!loading && error && <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:12 }}>
        <div style={{ fontSize:32,color:"#f87171" }}>⚠</div>
        <div style={{ fontSize:14,color:"#f87171",fontWeight:700 }}>{error}</div>
        <button onClick={fetchDataset} style={{ marginTop:8,padding:"8px 20px",borderRadius:8,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#f87171",fontSize:12,fontFamily:"inherit",cursor:"pointer" }}>↺ Retry</button>
      </div>}

      {/* Main content */}
      {!loading && !error && dataset && (
        <div style={{ maxWidth:1280,margin:"0 auto",padding:"36px 32px 80px",position:"relative",zIndex:2 }}>

          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <div style={{ marginBottom:32,animation:"fadeUp 0.5s ease both" }}>
            {/* Breadcrumb */}
            <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:16,fontSize:11,color:"#4b5563" }}>
              <span style={{ color:"#7c3aed",cursor:"pointer" }} onClick={() => router.push("/datasets")}>Datasets</span>
              <span>›</span><span style={{ color:"#6b7280" }}>{dataset.category}</span>
              <span>›</span><span style={{ color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200 }}>{dataset.slug ?? dataset.name}</span>
            </div>

            {/* Hero card */}
            <div style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.15) 0%,rgba(56,189,248,0.07) 50%,rgba(168,85,247,0.1) 100%)",border:"1px solid rgba(124,58,237,0.28)",borderRadius:20,padding:"32px 36px",position:"relative",overflow:"hidden",backdropFilter:"blur(20px)" }}>
              <div style={{ position:"absolute",top:-50,right:-50,width:220,height:220,borderRadius:"50%",background:`radial-gradient(circle,${c.glow},transparent 70%)`,pointerEvents:"none" }} />
              <div style={{ position:"absolute",bottom:-30,left:"35%",width:160,height:160,borderRadius:"50%",background:"radial-gradient(circle,rgba(56,189,248,0.12),transparent 70%)",pointerEvents:"none" }} />

              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:28,flexWrap:"wrap" }}>
                <div style={{ flex:1,minWidth:280 }}>
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
                    <span style={{ fontSize:10,padding:"4px 12px",borderRadius:20,background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.35)",color:"#a78bfa",fontWeight:700 }}>{dataset.category}</span>
                    {isKaggle && <span style={{ fontSize:10,padding:"4px 12px",borderRadius:20,background:"rgba(32,168,68,0.15)",border:"1px solid rgba(32,168,68,0.3)",color:"#4ade80",fontWeight:600 }}>Kaggle</span>}
                    {dataset.file_url && <span style={{ fontSize:10,padding:"4px 12px",borderRadius:20,background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.25)",color:"#38bdf8",fontWeight:600 }}>Direct Download</span>}
                    <span style={{ fontSize:10,padding:"4px 12px",borderRadius:20,background:c.bg,border:`1px solid ${c.border}`,color:c.fg,fontWeight:700 }}>Score {score}/100</span>
                  </div>
                  <h1 style={{ fontSize:32,fontWeight:900,margin:"0 0 12px",letterSpacing:"-0.03em",color:"#f3f0ff",lineHeight:1.1 }}>{dataset.name}</h1>
                  <p style={{ fontSize:13,color:"#9ca3af",lineHeight:1.75,margin:"0 0 20px",maxWidth:580 }}>
                    {dataset.description || `A ${dataset.category.toLowerCase()} dataset${dataset.votes ? ` with ${dataset.votes.toLocaleString()} community votes on Kaggle` : ""}${dataset.size ? `, size ${dataset.size}` : ""}. Suitable for ${useCases.slice(0,2).join(" and ")} tasks.`}
                  </p>
                  <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                    {[
                      { icon:"▲", label:"Votes",     value:dataset.votes?.toLocaleString() ?? "—", color:"#fbbf24" },
                      { icon:"📦", label:"Size",      value:dataset.size ?? "—",                    color:"#a78bfa" },
                      { icon:"↓",  label:"Downloads", value:dlCount.toLocaleString(),               color:"#38bdf8" },
                      { icon:"📅", label:"Added",     value:fmtDate(dataset.created_at),            color:"#f472b6" },
                    ].map((s,i) => (
                      <div key={i} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(124,58,237,0.14)" }}>
                        <span style={{ fontSize:12 }}>{s.icon}</span>
                        <span style={{ fontSize:11,color:"#9ca3af" }}>{s.label}:</span>
                        <span style={{ fontSize:11,color:"#e2d9f3",fontWeight:700 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score + CTA */}
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:14,flexShrink:0 }}>
                  <ScoreRing score={score} />
                  <button className="dl-btn" onClick={handleDownload} disabled={downloading} style={{ padding:"13px 28px",borderRadius:12,background:downloading?"rgba(124,58,237,0.2)":"linear-gradient(135deg,#7c3aed,#a855f7,#38bdf8)",border:downloading?"1px solid rgba(124,58,237,0.3)":"none",color:downloading?"#6b7280":"#fff",fontSize:13,fontFamily:"inherit",fontWeight:800,cursor:downloading?"not-allowed":"pointer",boxShadow:downloading?"none":"0 0 32px rgba(124,58,237,0.5)",transition:"all 0.2s",display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:16 }}>{downloading?"⌛":"↓"}</span>
                    {downloading?"Opening…":isKaggle?"Open on Kaggle":"Download Dataset"}
                  </button>
                  {activeUrl && <div style={{ fontSize:9,color:"#4b5563",textAlign:"center",maxWidth:200,wordBreak:"break-all",lineHeight:1.5 }}>{activeUrl.length>55?activeUrl.slice(0,55)+"…":activeUrl}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ── TAB NAV ──────────────────────────────────────────────────── */}
          <div style={{ display:"flex",gap:4,marginBottom:28,padding:"4px",background:"rgba(16,10,30,0.7)",borderRadius:12,border:"1px solid rgba(124,58,237,0.15)",backdropFilter:"blur(12px)",width:"fit-content" }}>
            {([
              { id:"overview", label:"Overview",       icon:"⬡" },
              { id:"quality",  label:"Quality Report", icon:"◆" },
              { id:"similar",  label:"Similar",        icon:"◈" },
            ] as const).map(tab => (
              <button key={tab.id} className="tab-item" onClick={() => setActiveTab(tab.id)} style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 20px",borderRadius:9,border:"none",fontFamily:"inherit",background:activeTab===tab.id?"linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))":"transparent",color:activeTab===tab.id?"#c4b5fd":"#6b7280",fontSize:12,fontWeight:activeTab===tab.id?700:400,cursor:"pointer",transition:"all 0.18s",boxShadow:activeTab===tab.id?"0 0 16px rgba(124,58,237,0.2)":"none",letterSpacing:"0.04em" }}>
                <span style={{ fontSize:13 }}>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab==="overview" && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:22,animation:"fadeIn 0.3s ease both" }}>
              {/* Left */}
              <div style={{ display:"flex",flexDirection:"column",gap:22 }}>

                {/* Intelligence cards */}
                <div>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:14 }}>Dataset Intelligence</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                    {insights.map((ins,i) => (
                      <div key={i} className="insight-card" style={{ background:`linear-gradient(135deg,${ins.bg},rgba(16,10,30,0.7))`,border:`1px solid ${ins.border}`,borderRadius:14,padding:"18px 20px",backdropFilter:"blur(14px)",animation:"fadeUp 0.4s ease both",animationDelay:`${i*0.08}s`,transition:"all 0.2s",opacity:insightVisible?1:0 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                          <span style={{ fontSize:20 }}>{ins.icon}</span>
                          <span style={{ fontSize:12,fontWeight:700,color:"#f3f0ff" }}>{ins.title}</span>
                        </div>
                        <p style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7,margin:0 }}>{ins.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Use Cases */}
                <div style={{ background:"rgba(16,10,30,0.75)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"22px 24px",backdropFilter:"blur(14px)",animation:"fadeUp 0.45s ease both",animationDelay:"0.18s" }}>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:14 }}>Recommended Use Cases</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginBottom:14 }}>
                    {useCases.map((u,i) => <span key={i} className="use-tag" style={{ fontSize:12,padding:"7px 16px",borderRadius:20,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.22)",color:"#a78bfa",cursor:"default",transition:"all 0.15s" }}>{u}</span>)}
                  </div>
                  <div style={{ height:1,background:"rgba(124,58,237,0.1)",margin:"14px 0" }} />
                  <div style={{ fontSize:12,color:"#6b7280",marginBottom:10 }}>Compatible frameworks</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                    {["Python / pandas","PyTorch","scikit-learn","TensorFlow","HuggingFace","Apache Spark"].map((f,i) => <span key={i} style={{ fontSize:11,padding:"5px 12px",borderRadius:20,background:"rgba(56,189,248,0.07)",border:"1px solid rgba(56,189,248,0.18)",color:"#38bdf8" }}>{f}</span>)}
                  </div>
                </div>

                {/* Access section */}
                <div style={{ background:isKaggle?"linear-gradient(135deg,rgba(32,168,68,0.1),rgba(16,10,30,0.7))":"linear-gradient(135deg,rgba(56,189,248,0.1),rgba(16,10,30,0.7))",border:isKaggle?"1px solid rgba(32,168,68,0.25)":"1px solid rgba(56,189,248,0.22)",borderRadius:14,padding:"22px 24px",backdropFilter:"blur(14px)",animation:"fadeUp 0.5s ease both",animationDelay:"0.25s" }}>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:14 }}>{isKaggle?"Kaggle Access":"Download Options"}</div>
                  {isKaggle ? (
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      <p style={{ fontSize:12,color:"#9ca3af",lineHeight:1.7,margin:"0 0 6px" }}>Access via Kaggle web interface or programmatically using the Kaggle CLI / Python API.</p>
                      {[
                        { label:"Web Interface", cmd:dataset.kaggle_url ?? "—" },
                        { label:"Kaggle CLI",    cmd:`kaggle datasets download -d ${dataset.slug ?? "owner/dataset"}` },
                      ].map((item,i) => (
                        <div key={i} style={{ padding:"10px 14px",borderRadius:8,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(124,58,237,0.12)" }}>
                          <div style={{ fontSize:9,color:"#6b7280",marginBottom:4,letterSpacing:"0.1em" }}>{item.label.toUpperCase()}</div>
                          <code style={{ fontSize:11,color:"#4ade80",wordBreak:"break-all",lineHeight:1.6 }}>{item.cmd}</code>
                        </div>
                      ))}
                      <button onClick={handleDownload} style={{ alignSelf:"flex-start",padding:"10px 22px",borderRadius:9,background:"linear-gradient(135deg,#16a34a,#4ade80)",border:"none",color:"#fff",fontSize:12,fontFamily:"inherit",fontWeight:700,cursor:"pointer",boxShadow:"0 0 18px rgba(74,222,128,0.35)",transition:"all 0.2s",marginTop:4 }}>Open on Kaggle →</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      <div style={{ padding:"10px 14px",borderRadius:8,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(56,189,248,0.15)" }}>
                        <div style={{ fontSize:9,color:"#6b7280",marginBottom:4 }}>DOWNLOAD URL</div>
                        <code style={{ fontSize:10,color:"#38bdf8",wordBreak:"break-all",lineHeight:1.6 }}>{activeUrl}</code>
                      </div>
                      <button onClick={handleDownload} disabled={downloading} style={{ alignSelf:"flex-start",padding:"10px 22px",borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#38bdf8)",border:"none",color:"#fff",fontSize:12,fontFamily:"inherit",fontWeight:700,cursor:"pointer",boxShadow:"0 0 18px rgba(56,189,248,0.3)",transition:"all 0.2s" }}>↓ Download Now</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
                {/* Metadata */}
                <div style={{ background:"rgba(16,10,30,0.82)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"20px 22px",backdropFilter:"blur(14px)",animation:"fadeUp 0.4s ease both",animationDelay:"0.08s" }}>
                  <div style={{ fontSize:14,fontWeight:700,color:"#f3f0ff",marginBottom:16 }}>Dataset Info</div>
                  {[
                    { label:"Category",  value:dataset.category,                           color:"#a78bfa" },
                    { label:"Size",      value:dataset.size ?? "—",                        color:"#c4b5fd" },
                    { label:"Votes",     value:dataset.votes?.toLocaleString() ?? "—",      color:"#fbbf24" },
                    { label:"Source",    value:isKaggle?"Kaggle":"Direct",                  color:"#4ade80" },
                    { label:"Downloads", value:dlCount.toLocaleString(),                   color:"#38bdf8" },
                    { label:"Added",     value:fmtDate(dataset.created_at),                color:"#f472b6" },
                    { label:"Quality",   value:`${score}/100`,                             color:c.fg },
                  ].map(({ label,value,color }) => (
                    <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(124,58,237,0.07)" }}>
                      <span style={{ fontSize:11,color:"#6b7280" }}>{label}</span>
                      <span style={{ fontSize:11,color,fontWeight:600,textAlign:"right",maxWidth:160,wordBreak:"break-all" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Topics */}
                <div style={{ background:"rgba(16,10,30,0.82)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"18px 20px",backdropFilter:"blur(14px)",animation:"fadeUp 0.45s ease both",animationDelay:"0.14s" }}>
                  <div style={{ fontSize:14,fontWeight:700,color:"#f3f0ff",marginBottom:12 }}>Topics</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
                    {[dataset.category,...useCases.slice(0,2),...(dataset.slug?.split("-").slice(0,3)??[])].filter(Boolean).map((tag,i) => (
                      <span key={i} style={{ fontSize:10,padding:"4px 10px",borderRadius:20,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa" }}>{tag}</span>
                    ))}
                    {isKaggle && <span style={{ fontSize:10,padding:"4px 10px",borderRadius:20,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",color:"#4ade80" }}>kaggle</span>}
                  </div>
                </div>

                {/* Related from DB */}
                {related.length>0 && (
                  <div style={{ background:"rgba(16,10,30,0.82)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"18px 20px",backdropFilter:"blur(14px)",animation:"fadeUp 0.5s ease both",animationDelay:"0.2s" }}>
                    <div style={{ fontSize:14,fontWeight:700,color:"#f3f0ff",marginBottom:14 }}>Related Datasets</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {related.slice(0,4).map((r,i) => {
                        const rc = sc(r.score??0);
                        return (
                          <div key={r.id} className="rel-card" onClick={() => router.push(`/dataset/${r.id}`)} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.12)",transition:"all 0.18s",animation:"fadeUp 0.3s ease both",animationDelay:`${0.25+i*0.05}s` }}>
                            <div style={{ width:30,height:30,borderRadius:7,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#7c3aed",flexShrink:0 }}>◈</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:11,fontWeight:600,color:"#e2d9f3",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.name}</div>
                              <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>{r.size??"—"} · {r.votes?`${r.votes.toLocaleString()} votes`:"—"}</div>
                            </div>
                            <span style={{ fontSize:10,padding:"2px 8px",borderRadius:4,background:rc.bg,border:`1px solid ${rc.border}`,color:rc.fg,fontWeight:700,flexShrink:0 }}>{r.score??0}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── QUALITY TAB ──────────────────────────────────────────────── */}
          {activeTab==="quality" && (
            <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:22,animation:"fadeIn 0.3s ease both" }}>
              <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
                {/* Score hero */}
                <div style={{ background:`linear-gradient(135deg,${c.bg},rgba(16,10,30,0.8))`,border:`1px solid ${c.border}`,borderRadius:16,padding:"28px 30px",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",gap:28 }}>
                  <ScoreRing score={score} />
                  <div>
                    <div style={{ fontSize:22,fontWeight:900,color:"#f3f0ff",marginBottom:8 }}>{score>80?"Excellent Quality":score>60?"Good Quality":"Needs Improvement"}</div>
                    <div style={{ fontSize:13,color:"#9ca3af",lineHeight:1.7,maxWidth:400 }}>
                      {score>80?"Production-ready. Minimal preprocessing needed — suitable for direct model training."
                        :score>60?"Good baseline quality. Handle nulls, check distributions, remove duplicates."
                        :"Significant preprocessing required. Validate schema, impute missing values, remove noise."}
                    </div>
                    <div style={{ marginTop:12,display:"flex",gap:8,flexWrap:"wrap" }}>
                      <span style={{ fontSize:11,padding:"4px 12px",borderRadius:20,background:c.bg,border:`1px solid ${c.border}`,color:c.fg,fontWeight:700 }}>{score>80?"✓ Production Ready":score>60?"△ Moderate":"✕ Needs Work"}</span>
                      {dataset.votes && <span style={{ fontSize:11,padding:"4px 12px",borderRadius:20,background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.25)",color:"#fbbf24" }}>▲ {dataset.votes.toLocaleString()} votes</span>}
                    </div>
                  </div>
                </div>

                {/* Breakdown bars */}
                <div style={{ background:"rgba(16,10,30,0.75)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"24px 26px",backdropFilter:"blur(14px)" }}>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:22 }}>Dimension Breakdown</div>
                  {breakdown.map((s,i) => (
                    <div key={i} style={{ marginBottom:18 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"center" }}>
                        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                          <div style={{ width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${s.color}22,${s.color}0a)`,border:`1px solid ${s.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:s.color }}>{s.icon}</div>
                          <span style={{ fontSize:13,color:"#9ca3af" }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize:13,color:s.color,fontWeight:700 }}>{s.pct}%</span>
                      </div>
                      <div style={{ height:7,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${s.pct}%`,borderRadius:4,background:`linear-gradient(90deg,${s.color}88,${s.color})`,boxShadow:`0 0 10px ${s.color}55`,animation:"barFill 1.1s ease both",animationDelay:`${0.3+i*0.1}s` } as React.CSSProperties} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preprocessing checklist */}
                <div style={{ background:"rgba(16,10,30,0.75)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"22px 24px",backdropFilter:"blur(14px)" }}>
                  <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:16 }}>Preprocessing Checklist</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {[
                      { icon:"✓", text:"Check for null/missing values — apply median, mean, or KNN imputation",   color:"#4ade80", bg:"rgba(74,222,128,0.08)",  border:"rgba(74,222,128,0.2)" },
                      { icon:"✓", text:"Remove duplicate records to ensure data uniqueness and integrity",         color:"#4ade80", bg:"rgba(74,222,128,0.08)",  border:"rgba(74,222,128,0.2)" },
                      { icon:"△", text:"Normalize numeric features — use MinMaxScaler or StandardScaler",         color:"#fbbf24", bg:"rgba(251,191,36,0.08)", border:"rgba(251,191,36,0.2)" },
                      { icon:"△", text:"Encode categorical variables using one-hot or ordinal encoding",          color:"#fbbf24", bg:"rgba(251,191,36,0.08)", border:"rgba(251,191,36,0.2)" },
                      { icon:score<70?"✕":"△", text:"Audit for class imbalance — apply SMOTE or weighted sampling if needed", color:score<70?"#f87171":"#fbbf24", bg:score<70?"rgba(239,68,68,0.08)":"rgba(251,191,36,0.08)", border:score<70?"rgba(239,68,68,0.2)":"rgba(251,191,36,0.2)" },
                    ].map((rec,i) => (
                      <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start",padding:"10px 14px",borderRadius:9,background:rec.bg,border:`1px solid ${rec.border}` }}>
                        <span style={{ fontSize:12,color:rec.color,flexShrink:0,marginTop:1,fontWeight:700 }}>{rec.icon}</span>
                        <span style={{ fontSize:12,color:"#9ca3af",lineHeight:1.6 }}>{rec.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: summary */}
              <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
                <div style={{ background:"rgba(16,10,30,0.82)",border:"1px solid rgba(124,58,237,0.18)",borderRadius:14,padding:"20px 22px",backdropFilter:"blur(14px)" }}>
                  <div style={{ fontSize:14,fontWeight:700,color:"#f3f0ff",marginBottom:16 }}>Quality Summary</div>
                  {[
                    { label:"Overall Score",  value:`${score}/100`,             color:c.fg },
                    { label:"Community Votes", value:dataset.votes?.toLocaleString()??"—", color:"#fbbf24" },
                    { label:"File Size",      value:dataset.size??"—",          color:"#c4b5fd" },
                    { label:"Downloads",      value:dlCount.toLocaleString(),   color:"#38bdf8" },
                    { label:"Category",       value:dataset.category,           color:"#a78bfa" },
                  ].map(({ label,value,color }) => (
                    <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(124,58,237,0.07)" }}>
                      <span style={{ fontSize:12,color:"#6b7280" }}>{label}</span>
                      <span style={{ fontSize:12,color,fontWeight:700 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background:`linear-gradient(135deg,${c.bg},rgba(16,10,30,0.75))`,border:`1px solid ${c.border}`,borderRadius:14,padding:"22px",backdropFilter:"blur(14px)",textAlign:"center" }}>
                  <div style={{ fontSize:52,fontWeight:900,color:c.fg,letterSpacing:"-0.04em",lineHeight:1 }}>{score}</div>
                  <div style={{ fontSize:11,color:"#6b7280",marginTop:4,marginBottom:14 }}>Quality Score / 100</div>
                  <div style={{ fontSize:13,color:c.fg,fontWeight:700,padding:"6px 16px",borderRadius:20,background:c.bg,border:`1px solid ${c.border}`,display:"inline-block",marginBottom:12 }}>
                    {score>80?"Excellent":score>60?"Good":"Needs Work"}
                  </div>
                  <div style={{ fontSize:11,color:"#6b7280",lineHeight:1.7 }}>
                    {score>80?"Top tier quality. Ready for production pipelines.":score>60?"Above average. Standard preprocessing advised.":"Below average. Careful preprocessing required."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SIMILAR TAB ──────────────────────────────────────────────── */}
          {activeTab==="similar" && (
            <div style={{ animation:"fadeIn 0.3s ease both" }}>
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:16,fontWeight:700,color:"#f3f0ff",marginBottom:6 }}>Similar Datasets — {dataset.category}</div>
                <div style={{ fontSize:12,color:"#6b7280" }}>{related.length} dataset{related.length!==1?"s":""} found in the same category</div>
              </div>

              {related.length===0 ? (
                <div style={{ padding:"52px 0",textAlign:"center",color:"#6b7280",fontSize:13 }}>No other datasets in this category yet.</div>
              ) : (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,marginBottom:32 }}>
                  {related.map((r,i) => {
                    const rc = sc(r.score??0);
                    return (
                      <div key={r.id} className="rel-card" onClick={() => router.push(`/dataset/${r.id}`)} style={{ background:"rgba(16,10,30,0.78)",border:"1px solid rgba(124,58,237,0.16)",borderRadius:14,padding:"20px 22px",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden",animation:"fadeUp 0.4s ease both",animationDelay:`${i*0.06}s`,backdropFilter:"blur(14px)" }}>
                        <div style={{ position:"absolute",top:0,right:0,width:80,height:80,background:"radial-gradient(circle,rgba(124,58,237,0.1),transparent 70%)",pointerEvents:"none" }} />
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
                          <div style={{ width:36,height:36,borderRadius:9,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#7c3aed" }}>◈</div>
                          <span style={{ fontSize:11,padding:"3px 10px",borderRadius:5,fontWeight:700,background:rc.bg,border:`1px solid ${rc.border}`,color:rc.fg }}>{r.score??0}</span>
                        </div>
                        <div style={{ fontSize:14,fontWeight:700,color:"#e2d9f3",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.name}</div>
                        <div style={{ display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" }}>
                          <span style={{ fontSize:10,padding:"2px 9px",borderRadius:5,background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa" }}>{r.category}</span>
                          {r.size && <span style={{ fontSize:10,padding:"2px 9px",borderRadius:5,background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.18)",color:"#38bdf8" }}>{r.size}</span>}
                          {r.kaggle_url && <span style={{ fontSize:10,padding:"2px 9px",borderRadius:5,background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.18)",color:"#4ade80" }}>Kaggle</span>}
                        </div>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                          <span style={{ fontSize:11,color:"#6b7280" }}>{r.votes?`▲ ${r.votes.toLocaleString()} votes`:"—"}</span>
                          <span style={{ fontSize:11,color:"#7c3aed",fontWeight:600 }}>View →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Curated suggestions */}
              <div style={{ background:"rgba(16,10,30,0.7)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:14,padding:"22px 24px",backdropFilter:"blur(14px)" }}>
                <div style={{ fontSize:14,fontWeight:700,color:"#f3f0ff",marginBottom:14 }}>Also Explore</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:10 }}>
                  {alsoExpl.map((name,i) => (
                    <span key={i} className="also-tag" style={{ fontSize:12,padding:"7px 16px",borderRadius:20,background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",color:"#a78bfa",cursor:"pointer",transition:"all 0.15s" }} onClick={() => router.push("/datasets")}>{name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}