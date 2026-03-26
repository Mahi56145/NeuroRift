"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  UploadCloud, CheckCircle, AlertCircle, Zap, Loader2, ChevronLeft,
  ChevronDown, ChevronUp, Tag, AlignLeft, X, Sparkles, Wand2, PenLine,
  Grid3X3, FileText, Shield, TrendingUp,
} from "lucide-react";

interface UploadResult {
  message?: string; file_url?: string; type?: string;
  preview?: Record<string, unknown>[];
  enrichment?: {
    description?: string; score?: number; tags?: string[]; use_cases?: string[];
    difficulty?: string; preprocessingEffort?: string; recommendedModels?: string[];
    pros?: string[]; cons?: string[]; completeness?: number; biasWarnings?: string[];
    columnInsights?: string[]; trainingReadiness?: string;
  } | null;
  dbData?: { id: string; name: string; score?: number }[];
}

interface GeneratedMeta { name: string; category: string; description: string; tags: string[]; suggestedUseCases: string[]; }

const CATEGORIES = ["CSV Dataset", "PDF Document", "Healthcare", "Finance", "NLP", "Computer Vision", "Business", "General", "Other"];

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Mode: "manual" | "ai"
  const [mode, setMode] = useState<"manual" | "ai">("ai");

  // Manual fields
  const [nameOverride, setNameOverride] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [showOptional, setShowOptional] = useState(true);

  // AI generate state
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedMeta | null>(null);
  const [useGeneratedConfirmed, setUseGeneratedConfirmed] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUserId(data.session.user.id);
      else router.push("/auth");
    });
  }, [router]);

  const resetFile = () => { setFile(null); setResult(null); setError(null); setGenerated(null); setUseGeneratedConfirmed(false); setNameOverride(""); setCategory(""); setDescription(""); };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); setError(null); setGenerated(null); setUseGeneratedConfirmed(false); }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(null); setGenerated(null); setUseGeneratedConfirmed(false); }
  };

  // ─── AI Generate Metadata ──────────────────────────────────────────────────
  const handleAIGenerate = async () => {
    if (!file) return;
    setGenerating(true); setGenerated(null); setError(null);
    try {
      const res = await fetch("/api/ai/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: formatBytes(file.size), type: file.type || file.name.split(".").pop() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGenerated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const confirmGenerated = () => {
    if (!generated) return;
    setNameOverride(generated.name);
    setCategory(generated.category);
    setDescription(generated.description);
    setUseGeneratedConfirmed(true);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    let p = 0;
    const interval = setInterval(() => { p = Math.min(p + Math.random() * 10, 88); setProgress(p); }, 200);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("useAI", useAI ? "true" : "false");
      const finalName = nameOverride || (generated && useGeneratedConfirmed ? generated.name : "");
      const finalCat = category || (generated && useGeneratedConfirmed ? generated.category : "");
      const finalDesc = description || (generated && useGeneratedConfirmed ? generated.description : "");
      if (finalName) formData.append("nameOverride", finalName);
      if (finalCat) formData.append("category", finalCat);
      if (finalDesc) formData.append("description", finalDesc);
      if (userId) formData.append("userId", userId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      clearInterval(interval); setProgress(100);
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data);
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const fileColor = file && file.name.endsWith(".csv") ? "#38bdf8" : file && file.name.endsWith(".pdf") ? "#f472b6" : "#a78bfa";
  const fileLabel = file && file.name.endsWith(".csv") ? "CSV" : file && file.name.endsWith(".pdf") ? "PDF" : "FILE";

  const canUpload = file && !uploading && (mode === "manual" || useGeneratedConfirmed || !generated);

  return (
    <div style={{ backgroundColor: "#05020c", color: "#e2d9f3", minHeight: "100vh", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700;900&display=swap');
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spinR { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes typeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .form-input:focus { outline:none; border-color:rgba(124,58,237,0.5) !important; box-shadow:0 0 14px rgba(124,58,237,0.1) !important; }
        .mode-btn { transition:all 0.2s; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:4px}
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "3%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.08),transparent 70%)", filter: "blur(60px)", animation: "floatY 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "3%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.09),transparent 70%)", filter: "blur(55px)", animation: "floatY 10s ease-in-out 3s infinite" }} />
      </div>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(5,2,12,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(124,58,237,0.12)" }}>
        <button onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, padding: "7px 14px", color: "#9ca3af", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}>
          <ChevronLeft size={12} /> Dashboard
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 28, height: 28 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid #38bdf8", animation: "spinR 8s linear infinite" }} />
            <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 900, color: "#38bdf8" }}>NR</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "#6b7280" }}>CONTRIBUTE ENGINE</span>
        </div>
        <div style={{ width: 120 }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 840, margin: "0 auto", padding: "56px 32px 80px" }}>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 48, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 50, padding: "5px 16px", marginBottom: 18 }}>
            <UploadCloud size={12} color="#38bdf8" />
            <span style={{ fontSize: 9, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.2em" }}>CONTRIBUTE ENGINE</span>
          </div>
          <h1 style={{ fontSize: "clamp(26px,4vw,46px)", fontWeight: 900, margin: "0 0 12px", background: "linear-gradient(135deg,#fff,#38bdf8,#a78bfa)", backgroundSize: "200%", animation: "gradShift 4s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em" }}>
            Contribute Data Into
            <br />The Neural Vault
          </h1>
          <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.7 }}>Contribute your dataset and choose how to add metadata — enter manually or let Groq AI generate it from your file.</p>
        </motion.div>

        {/* Drop Zone */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            style={{ border: `2px dashed ${file ? fileColor + "66" : dragging ? "rgba(56,189,248,0.7)" : "rgba(124,58,237,0.2)"}`, borderRadius: 22, padding: "52px 40px", textAlign: "center", cursor: file ? "default" : "pointer", background: file ? fileColor + "06" : dragging ? "rgba(56,189,248,0.05)" : "rgba(8,4,18,0.7)", backdropFilter: "blur(16px)", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.pdf,.json,.xlsx" onChange={handleFileChange} style={{ display: "none" }} />
            {!file ? (
              <>
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} style={{ marginBottom: 20 }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <UploadCloud size={32} color="#38bdf8" />
                  </div>
                </motion.div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#e2d9f3", margin: "0 0 6px" }}>{dragging ? "Drop to contribute" : "Drag & drop your dataset"}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>or click to browse · CSV, PDF, JSON, XLSX</p>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: fileColor + "14", border: `1px solid ${fileColor}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: fileColor, letterSpacing: "0.06em", flexShrink: 0 }}>
                  {fileLabel}
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f3f0ff" }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{formatBytes(file.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); resetFile(); }}
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#f87171", flexShrink: 0 }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* METADATA MODE SELECTOR */}
        {file && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 20 }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.18em", fontWeight: 700, marginBottom: 10 }}>DATASET METADATA MODE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {/* AI Mode */}
              <button className="mode-btn" onClick={() => { setMode("ai"); setShowOptional(false); }}
                style={{ padding: "18px 20px", borderRadius: 16, background: mode === "ai" ? "rgba(167,139,250,0.1)" : "rgba(8,4,18,0.7)", border: `1.5px solid ${mode === "ai" ? "rgba(167,139,250,0.45)" : "rgba(124,58,237,0.12)"}`, cursor: "pointer", textAlign: "left", boxShadow: mode === "ai" ? "0 0 24px rgba(167,139,250,0.18)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Wand2 size={18} color="#a78bfa" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: mode === "ai" ? "#e2d9f3" : "#9ca3af" }}>AI Auto-Generate</div>
                    <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.08em" }}>Groq reads your file and generates all metadata</div>
                  </div>
                  {mode === "ai" && <CheckCircle size={14} color="#a78bfa" style={{ marginLeft: "auto" }} />}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["name", "category", "tags", "description"].map((t) => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", fontSize: 8, color: "#c4b5fd" }}>{t}</span>
                  ))}
                </div>
              </button>
              {/* Manual Mode */}
              <button className="mode-btn" onClick={() => { setMode("manual"); setShowOptional(true); }}
                style={{ padding: "18px 20px", borderRadius: 16, background: mode === "manual" ? "rgba(56,189,248,0.08)" : "rgba(8,4,18,0.7)", border: `1.5px solid ${mode === "manual" ? "rgba(56,189,248,0.4)" : "rgba(124,58,237,0.12)"}`, cursor: "pointer", textAlign: "left", boxShadow: mode === "manual" ? "0 0 24px rgba(56,189,248,0.12)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PenLine size={18} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: mode === "manual" ? "#e2d9f3" : "#9ca3af" }}>Enter Manually</div>
                    <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.08em" }}>Type your own name, category, and description</div>
                  </div>
                  {mode === "manual" && <CheckCircle size={14} color="#38bdf8" style={{ marginLeft: "auto" }} />}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["full control", "custom name", "optional"].map((t) => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.14)", fontSize: 8, color: "#38bdf8" }}>{t}</span>
                  ))}
                </div>
              </button>
            </div>

            {/* AI MODE CONTENT */}
            <AnimatePresence>
              {mode === "ai" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {!generated && !generating && (
                    <button onClick={handleAIGenerate}
                      style={{ width: "100%", padding: "15px", borderRadius: 16, background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "inherit", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 24px rgba(124,58,237,0.4)" }}>
                      <Sparkles size={16} /> GENERATE METADATA WITH GROQ AI
                    </button>
                  )}
                  {generating && (
                    <div style={{ textAlign: "center", padding: "28px", background: "rgba(8,4,18,0.7)", borderRadius: 16, border: "1px solid rgba(124,58,237,0.12)" }}>
                      <div style={{ width: 44, height: 44, margin: "0 auto 14px", position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.2)", borderTopColor: "#a78bfa", animation: "spinR 1s linear infinite" }} />
                        <Wand2 size={18} color="#a78bfa" style={{ position: "absolute", inset: 0, margin: "auto" }} />
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 11 }}>Groq AI is reading your file and generating metadata…</p>
                    </div>
                  )}
                  {generated && !useGeneratedConfirmed && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 18, overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(167,139,250,0.1)", background: "rgba(167,139,250,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                        <Sparkles size={14} color="#a78bfa" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.1em" }}>GROQ AI GENERATED METADATA</span>
                      </div>
                      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 5 }}>GENERATED NAME</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f0ff" }}>{generated.name}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 5 }}>CATEGORY</div>
                            <span style={{ padding: "3px 12px", borderRadius: 20, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>{generated.category}</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 5 }}>AI DESCRIPTION</div>
                          <p style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.8, margin: 0, padding: "10px 14px", background: "rgba(167,139,250,0.05)", borderRadius: 10, borderLeft: "3px solid rgba(167,139,250,0.3)" }}>{generated.description}</p>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8 }}>SUGGESTED TAGS</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {generated.tags.map((t) => <span key={t} style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", fontSize: 9, color: "#c4b5fd", fontWeight: 700 }}>{t}</span>)}
                          </div>
                        </div>
                        {generated.suggestedUseCases.length > 0 && (
                          <div>
                            <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8 }}>SUGGESTED USE CASES</div>
                            {generated.suggestedUseCases.map((u, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>{u}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={confirmGenerated}
                            style={{ flex: 1, padding: "12px", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                            ✓ Use This Metadata
                          </button>
                          <button onClick={handleAIGenerate}
                            style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
                            ↺ Regenerate
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {useGeneratedConfirmed && (
                    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                      style={{ padding: "16px 20px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
                      <CheckCircle size={18} color="#4ade80" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>Metadata confirmed: {generated?.name}</div>
                        <div style={{ fontSize: 9, color: "#6b7280" }}>Ready to contribute · category: {generated?.category}</div>
                      </div>
                      <button onClick={() => { setUseGeneratedConfirmed(false); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Change</button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* MANUAL MODE CONTENT */}
            <AnimatePresence>
              {mode === "manual" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ background: "rgba(8,4,18,0.7)", border: "1px solid rgba(124,58,237,0.12)", borderRadius: 18, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}><FileText size={9} /> DATASET NAME</label>
                    <input className="form-input" value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} placeholder="Leave blank to use filename"
                      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 10, padding: "10px 14px", color: "#e2d9f3", fontSize: 12, fontFamily: "inherit", transition: "border-color 0.2s" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}><Tag size={9} /> CATEGORY</label>
                    <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", background: "rgba(10,5,22,0.9)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 10, padding: "10px 14px", color: category ? "#e2d9f3" : "#6b7280", fontSize: 11, fontFamily: "inherit", cursor: "pointer", transition: "border-color 0.2s" }}>
                      <option value="">Auto-detect category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}><AlignLeft size={9} /> DESCRIPTION</label>
                    <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your dataset…" rows={3}
                      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 10, padding: "10px 14px", color: "#e2d9f3", fontSize: 12, fontFamily: "inherit", resize: "vertical", transition: "border-color 0.2s" }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* AI ENRICHMENT TOGGLE + UPLOAD BTN */}
        {file && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "rgba(8,4,18,0.7)", border: "1px solid rgba(124,58,237,0.12)", borderRadius: 14, backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: useAI ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${useAI ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  <Sparkles size={15} color={useAI ? "#a78bfa" : "#6b7280"} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: useAI ? "#e2d9f3" : "#9ca3af" }}>Quality Enrichment Scan</div>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.06em" }}>Get quality score, pros/cons, ML model recommendations</div>
                </div>
              </div>
              <div onClick={() => setUseAI(!useAI)} style={{ width: 42, height: 22, borderRadius: 11, background: useAI ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "rgba(255,255,255,0.08)", position: "relative", cursor: "pointer", boxShadow: useAI ? "0 0 12px rgba(124,58,237,0.4)" : "none", transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 3, left: useAI ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
              </div>
            </div>

            {/* Upload button */}
            <button onClick={handleUpload} disabled={!canUpload}
              style={{ width: "100%", padding: "16px", borderRadius: 16, backgroundColor: canUpload ? "transparent" : "rgba(255,255,255,0.05)", backgroundImage: canUpload ? "linear-gradient(135deg,#7c3aed,#a855f7,#38bdf8)" : "none", backgroundSize: "200%", animation: canUpload ? "gradShift 3s ease infinite" : "none", border: "none", color: canUpload ? "#fff" : "#4b5563", fontSize: 13, fontWeight: 800, fontFamily: "inherit", letterSpacing: "0.1em", cursor: canUpload ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: canUpload ? "0 0 28px rgba(124,58,237,0.4)" : "none", transition: "all 0.25s" }}>
              {uploading ? <><Loader2 size={16} style={{ animation: "spinR 1s linear infinite" }} /> CONTRIBUTING…</> : <><UploadCloud size={16} /> CONTRIBUTE TO NEURAL VAULT</>}
            </button>

            {uploading && (
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <motion.div animate={{ width: `${progress}%` }} style={{ height: "100%", background: "linear-gradient(90deg,#7c3aed,#38bdf8)", borderRadius: 4 }} transition={{ duration: 0.3 }} />
              </div>
            )}
          </motion.div>
        )}

        {/* ERROR */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 18, padding: "14px 18px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 11 }}>
              <AlertCircle size={14} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESULTS */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 200 }} style={{ marginTop: 32 }}>
              <div style={{ padding: "18px 22px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircle size={22} color="#4ade80" />
                <div><div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Contribution Successful!</div><div style={{ fontSize: 9, color: "#6b7280" }}>Injected into the neural vault</div></div>
                {result.file_url && <a href={result.file_url} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", padding: "5px 12px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 50, color: "#4ade80", fontSize: 9, fontWeight: 700, textDecoration: "none" }}>Open File →</a>}
              </div>

              {/* Enrichment */}
              {result.enrichment && (
                <div style={{ background: "rgba(8,4,18,0.9)", border: "1px solid rgba(167,139,250,0.12)", borderTop: "none", borderRadius: "0 0 16px 16px", padding: "24px", backdropFilter: "blur(16px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                    <Sparkles size={14} color="#a78bfa" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.12em" }}>GROQ ENRICHMENT INSIGHTS</span>
                    {result.enrichment.score != null && (
                      <div style={{ marginLeft: "auto", padding: "4px 14px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 20, fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>Score: {result.enrichment.score}/100</div>
                    )}
                  </div>

                  {result.enrichment.description && <p style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.8, marginBottom: 18, padding: "12px 16px", background: "rgba(167,139,250,0.05)", borderRadius: 10, borderLeft: "3px solid rgba(167,139,250,0.25)" }}>{result.enrichment.description}</p>}

                  {/* Training readiness */}
                  {result.enrichment.trainingReadiness && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <Shield size={13} color="#38bdf8" />
                      <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>TRAINING READINESS:</span>
                      <span style={{ fontSize: 10, color: "#d1d5db" }}>{result.enrichment.trainingReadiness}</span>
                    </div>
                  )}

                  {/* Badges */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {result.enrichment.difficulty && <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.18)", fontSize: 9, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.1em" }}>DIFFICULTY: {result.enrichment.difficulty.toUpperCase()}</div>}
                    {result.enrichment.preprocessingEffort && <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)", fontSize: 9, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.1em" }}>PREPROCESSING: {result.enrichment.preprocessingEffort.toUpperCase()}</div>}
                  </div>

                  {/* Tags */}
                  {result.enrichment.tags && result.enrichment.tags.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}><Tag size={8} /> AI TAGS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{result.enrichment.tags.map((t) => <span key={t} style={{ padding: "3px 10px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 20, fontSize: 9, color: "#c4b5fd", fontWeight: 700 }}>{t}</span>)}</div>
                    </div>
                  )}

                  {/* Bias Warnings */}
                  {result.enrichment.biasWarnings && result.enrichment.biasWarnings.length > 0 && (
                    <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 10 }}>
                      <div style={{ fontSize: 8, color: "#fbbf24", letterSpacing: "0.15em", marginBottom: 7, fontWeight: 700 }}>⚠ BIAS WARNINGS</div>
                      {result.enrichment.biasWarnings.map((b, i) => <div key={i} style={{ fontSize: 10, color: "#fcd34d", marginBottom: 4 }}>• {b}</div>)}
                    </div>
                  )}

                  {/* Use cases + Models grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    {result.enrichment.use_cases && result.enrichment.use_cases.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Zap size={8} color="#38bdf8" /> USE CASES</div>
                        {result.enrichment.use_cases.map((u, i) => <div key={i} style={{ fontSize: 10, color: "#9ca3af", marginBottom: 5, display: "flex", alignItems: "flex-start", gap: 6 }}><div style={{ width: 4, height: 4, borderRadius: "50%", background: "#38bdf8", marginTop: 4, flexShrink: 0 }} />{u}</div>)}
                      </div>
                    )}
                    {result.enrichment.recommendedModels && result.enrichment.recommendedModels.length > 0 && (
                      <div>
                        <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><TrendingUp size={8} color="#4ade80" /> RECOMMENDED MODELS</div>
                        {result.enrichment.recommendedModels.map((m, i) => <div key={i} style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 5, padding: "4px 10px", background: "rgba(74,222,128,0.05)", borderRadius: 6 }}>{m}</div>)}
                      </div>
                    )}
                  </div>

                  {/* Pros/Cons */}
                  {((result.enrichment.pros?.length ?? 0) > 0 || (result.enrichment.cons?.length ?? 0) > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: "12px 14px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 10 }}>
                        <div style={{ fontSize: 8, color: "#4ade80", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 8 }}>✓ STRENGTHS</div>
                        {(result.enrichment.pros ?? []).map((p, i) => <div key={i} style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>• {p}</div>)}
                      </div>
                      <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: 10 }}>
                        <div style={{ fontSize: 8, color: "#f87171", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 8 }}>✕ LIMITATIONS</div>
                        {(result.enrichment.cons ?? []).map((c, i) => <div key={i} style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>• {c}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              {result.preview && result.preview.length > 0 && (
                <div style={{ marginTop: 14, background: "rgba(8,4,18,0.9)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 14, padding: "18px", backdropFilter: "blur(12px)", overflowX: "auto" }}>
                  <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.16em", marginBottom: 12, fontWeight: 700 }}>DATA PREVIEW</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr>{Object.keys(result.preview[0]).slice(0, 6).map((col) => <th key={col} style={{ padding: "5px 10px", textAlign: "left", color: "#a78bfa", fontWeight: 700, letterSpacing: "0.07em", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>{col}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.preview.slice(0, 5).map((row, ri) => (
                        <tr key={ri}>{Object.values(row).slice(0, 6).map((val, ci) => <td key={ci} style={{ padding: "5px 10px", color: "#9ca3af", borderBottom: "1px solid rgba(124,58,237,0.04)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(val)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={resetFile} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", color: "#a78bfa", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Upload Another</button>
                <button onClick={() => result.dbData?.[0] && router.push(`/dashboard/analyse?id=${result.dbData[0].id}`)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ade80", fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Deep Analyse →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
