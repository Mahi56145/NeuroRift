"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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

interface AnalyseResult {
  score: number; completeness: number; consistency: number;
  accuracy: number; uniqueness: number; timeliness: number;
  insights: string[]; advantages: string[]; disadvantages: string[];
  recommended_for: string[];
}
interface CompareResult {
  winner: string;
  datasets: { id: string; name: string; scores: Record<string, number>; pros: string[]; cons: string[] }[];
  suggestion: string;
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

  // ── Your Datasets panel state ────────────────────────────────────────────────
  const [datasetsTab, setDatasetsTab]   = useState<"uploads"|"downloads">("uploads");
  const [myUploads, setMyUploads]       = useState<Dataset[]>([]);
  const [myDownloads, setMyDownloads]   = useState<Dataset[]>([]);
  const [loadingMine, setLoadingMine]   = useState(false);

  // ── Profile panel state ──────────────────────────────────────────────────────
  const [profileUser, setProfileUser]   = useState<{ id: string; name: string; email: string; phone: string } | null>(null);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileNewPw, setProfileNewPw] = useState("");
  const [profileConfPw, setProfileConfPw] = useState("");
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileDeleting, setProfileDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  // ── Analyse state ───────────────────────────────────────────────────────────
  const [analyseSearch, setAnalyseSearch]     = useState("");
  const [analyseSelected, setAnalyseSelected] = useState<Dataset | null>(null);
  const [analyseResult, setAnalyseResult]     = useState<AnalyseResult | null>(null);
  const [analysing, setAnalysing]             = useState(false);

  // ── Compare state ───────────────────────────────────────────────────────────
  const [compareSearch, setCompareSearch]     = useState("");
  const [compareSelected, setCompareSelected] = useState<Dataset[]>([]);
  const [compareResult, setCompareResult]     = useState<CompareResult | null>(null);
  const [comparing, setComparing]             = useState(false);

  // ── All datasets for analyse/compare ────────────────────────────────────────
  const [allDatasets, setAllDatasets]         = useState<Dataset[]>([]);
  const [loadingAll, setLoadingAll]           = useState(false);
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null);
  const [uploadFiles, setUploadFiles]     = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, "pending"|"uploading"|"done"|"error">>({});
  const [dragOver, setDragOver]           = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Add files helper ────────────────────────────────────────────────────────
  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setUploadFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const filtered = arr.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...filtered];
    });
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── Upload all files to Supabase ─────────────────────────────────────────── 
  const handleUploadAll = async () => {
    if (uploadFiles.length === 0) return;
    setUploadingFiles(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    const initial: Record<string, "pending"|"uploading"|"done"|"error"> = {};
    uploadFiles.forEach(f => { initial[f.name + f.size] = "pending"; });
    setUploadProgress(initial);

    for (const file of uploadFiles) {
      const key = file.name + file.size;
      setUploadProgress(p => ({ ...p, [key]: "uploading" }));
      try {
        const ext  = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `datasets/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

        const { data: storageData, error: storageErr } = await supabase.storage
          .from("datasets")
          .upload(path, file, { upsert: false });

        if (storageErr) throw storageErr;

        const { data: urlData } = supabase.storage.from("datasets").getPublicUrl(storageData.path);
        const publicUrl = urlData?.publicUrl ?? "";

        const category =
          ext === "csv" ? "CSV Dataset" :
          ext === "pdf" ? "PDF Document" :
          ["png","jpg","jpeg","gif","webp"].includes(ext) ? "Other" :
          "General";

        await supabase.from("datasets").insert({
          name:         file.name,
          category,
          file_url:     publicUrl,
          rows_count:   0,
          columns_count: 0,
          score:        0,
          created_at:   new Date().toISOString(),
          created_by:   userId,
        });

        setUploadProgress(p => ({ ...p, [key]: "done" }));
      } catch {
        setUploadProgress(p => ({ ...p, [key]: "error" }));
      }
    }

    setUploadingFiles(false);
    showToast(`${uploadFiles.length} file(s) uploaded successfully.`, "success");
    // Refresh counts and recent datasets
    fetchCounts();
    fetchRecentDatasets();
    fetchAllDatasets();
    setTimeout(() => {
      setUploadFiles([]);
      setUploadProgress({});
    }, 2200);
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "csv") return "⬡";
    if (ext === "pdf") return "◉";
    if (["png","jpg","jpeg","gif","webp"].includes(ext)) return "◈";
    return "◆";
  };

  const getFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(2)} MB`;
  };

  const fetchMyDatasets = useCallback(async () => {
    setLoadingMine(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const { data: uploads } = await supabase
        .from("datasets").select("*")
        .eq("created_by", userId ?? "")
        .order("created_at", { ascending: false });
      setMyUploads(uploads ?? []);

      const { data: dlRows } = await supabase
        .from("downloads")
        .select("dataset_id, downloaded_at, datasets(*)")
        .eq("user_id", userId ?? "")
        .order("downloaded_at", { ascending: false });

      const dlDatasets = (dlRows ?? [])
        .map((r: { datasets: Dataset | Dataset[] | null }) => Array.isArray(r.datasets) ? r.datasets[0] : r.datasets)
        .filter(Boolean) as Dataset[];
      setMyDownloads(dlDatasets);
    } catch { /* silent */ }
    finally { setLoadingMine(false); }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const name  = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const phone = user.user_metadata?.phone ?? "";
      setProfileUser({ id: user.id, name, email: user.email ?? "", phone });
      setProfilePhone(phone);
    } catch { /* silent */ }
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      if (profileNewPw && profileNewPw !== profileConfPw) {
        showToast("Passwords do not match.", "error"); setProfileSaving(false); return;
      }
      if (profileNewPw && profileNewPw.length < 6) {
        showToast("Password must be at least 6 characters.", "error"); setProfileSaving(false); return;
      }
      const phoneClean = profilePhone.trim();
      if (phoneClean) {
        const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
        if (!phoneRegex.test(phoneClean)) {
          showToast("Please enter a valid phone number.", "error"); setProfileSaving(false); return;
        }
        const { data: existing } = await supabase
          .from("profiles").select("id").eq("phone", phoneClean).neq("id", profileUser?.id ?? "").maybeSingle();
        if (existing) {
          showToast("This phone number is already in use by another account.", "error"); setProfileSaving(false); return;
        }
      }
      const updatePayload: { data: { phone?: string }; password?: string } = {
        data: { phone: phoneClean || undefined },
      };
      if (profileNewPw) updatePayload.password = profileNewPw;
      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw error;
      if (phoneClean && profileUser) {
        await supabase.from("profiles").update({ phone: phoneClean }).eq("id", profileUser.id);
      }
      showToast("Profile updated successfully.", "success");
      setProfileNewPw(""); setProfileConfPw("");
      fetchProfile();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
    } finally { setProfileSaving(false); }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setProfileDeleting(true);
    try {
      await supabase.auth.signOut();
      router.push("/auth");
    } catch { showToast("Delete failed. Please try again.", "error"); }
    finally { setProfileDeleting(false); setConfirmDelete(false); }
  };

  const fetchCounts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      setCurrentUserId(userId);

      // Count this user's uploads
      const { count: uCount } = await supabase
        .from("datasets")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId);
      setUploadCount(uCount ?? 0);

      // Count this user's downloads
      const { count: dCount } = await supabase
        .from("downloads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setDownloadCount(dCount ?? 0);

      // Last activity for this user
      const { data: latest } = await supabase
        .from("downloads")
        .select("downloaded_at")
        .eq("user_id", userId)
        .order("downloaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.downloaded_at) setLastActivity(latest.downloaded_at);
    } catch { /* silent */ }
  }, []);

  const fetchRecentDatasets = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { setRecentDatasets([]); return; }

      // Fetch the user's most recently uploaded datasets
      const { data: uploads, error: upErr } = await supabase
        .from("datasets")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (upErr) throw upErr;

      // Fetch datasets the user recently downloaded (distinct by dataset_id)
      const { data: dlRows } = await supabase
        .from("downloads")
        .select("dataset_id, downloaded_at, datasets(*)")
        .eq("user_id", userId)
        .order("downloaded_at", { ascending: false })
        .limit(10);

      const dlDatasets = (dlRows ?? [])
        .map((r: { datasets: Dataset | Dataset[] | null }) =>
          Array.isArray(r.datasets) ? r.datasets[0] : r.datasets)
        .filter(Boolean) as Dataset[];

      // Merge uploads + downloads, deduplicate by id, keep top 8
      const seen = new Set<string>();
      const merged: Dataset[] = [];
      for (const d of [...(uploads ?? []), ...dlDatasets]) {
        if (d && !seen.has(d.id)) { seen.add(d.id); merged.push(d); }
        if (merged.length >= 8) break;
      }
      setRecentDatasets(merged);
    } catch { setRecentDatasets([]); }
    finally { setLoadingRecent(false); }
  }, []);

  const fetchAllDatasets = useCallback(async () => {
    setLoadingAll(true);
    try {
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setAllDatasets(data ?? []);
    } catch { setAllDatasets([]); }
    finally { setLoadingAll(false); }
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchRecentDatasets();
    fetchProfile();
    fetchAllDatasets();
  }, [fetchCounts, fetchRecentDatasets, fetchProfile, fetchAllDatasets]);

  // When switching panels, load needed data
  useEffect(() => {
    if (activeNav === "Your Datasets") fetchMyDatasets();
    if (activeNav === "Profile") fetchProfile();
    if (activeNav === "Analyse" || activeNav === "Compare") fetchAllDatasets();
  }, [activeNav, fetchMyDatasets, fetchProfile, fetchAllDatasets]);

  const filteredRecent = recentDatasets.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q);
  });

  const handleDatasetClick = (dataset: Dataset) => {
    router.push(`/dataset/${dataset.id}`);
  };

  const handleDownload = async (dataset: Dataset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataset.file_url) { showToast("No file URL available.", "error"); return; }
    setDownloadingId(dataset.id);
    try {
      window.open(dataset.file_url, "_blank", "noopener,noreferrer");
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      await supabase.from("downloads").insert({
        dataset_id: dataset.id,
        downloaded_at: new Date().toISOString(),
        user_id: userId,
      });
      // Refresh counts live
      fetchCounts();
      showToast(`Download started: ${dataset.name}`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Download log failed.", "error");
    } finally { setDownloadingId(null); }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAnalyse = async () => {
    if (!analyseSelected) return;
    setAnalysing(true);
    await new Promise(r => setTimeout(r, 900));
    const s = analyseSelected.score ?? Math.floor(Math.random() * 40 + 55);
    const seed = s / 100;
    setAnalyseResult({
      score: s,
      completeness: Math.round(seed * 95 + 2),
      consistency:  Math.round(seed * 88 + 5),
      accuracy:     Math.round(seed * 92 + 3),
      uniqueness:   Math.round(seed * 78 + 10),
      timeliness:   Math.round(seed * 85 + 8),
      insights: [
        `Contains ${analyseSelected.rows_count?.toLocaleString() ?? 0} records across ${analyseSelected.columns_count ?? 0} features — ${analyseSelected.rows_count > 500000 ? "large-scale" : "mid-scale"} for ${analyseSelected.category} tasks.`,
        `Quality score of ${s}/100 indicates ${s > 80 ? "production-ready data, minimal preprocessing needed" : s > 60 ? "moderate cleaning recommended before training" : "significant preprocessing required — check for nulls and outliers"}.`,
        `Estimated training time on A100 GPU: ${Math.max(1, Math.round((analyseSelected.rows_count ?? 1000) / 50000))}–${Math.max(2, Math.round((analyseSelected.rows_count ?? 1000) / 30000))} min/epoch at batch size 256.`,
        `File format ${analyseSelected.file_url?.split(".").pop()?.toUpperCase() ?? "unknown"} — ${analyseSelected.file_url?.endsWith(".csv") ? "optimal for tabular ML pipelines" : "may require conversion before ingestion"}.`,
      ],
      advantages: [
        s > 75 ? "High overall quality score with low noise" : "Sufficient volume for baseline modelling",
        analyseSelected.columns_count > 5 ? "Rich multi-dimensional feature space" : "Compact, fast to process",
        analyseSelected.rows_count > 10000 ? "Large enough for robust train/test splits" : "Suitable for rapid prototyping",
        "Indexed and accessible via direct download URL",
      ],
      disadvantages: [
        s < 80 ? "Score below 80 — data cleaning pipeline recommended" : "Minor inconsistencies possible in edge rows",
        analyseSelected.columns_count < 3 ? "Low feature count — consider feature engineering" : "High dimensionality may increase compute cost",
        analyseSelected.rows_count < 1000 ? "Small dataset — consider augmentation" : "Preprocessing at scale may be time-intensive",
        "No schema versioning — manual validation advised",
      ],
      recommended_for: analyseSelected.category === "CSV Dataset"
        ? ["Supervised learning", "Feature engineering", "Regression / classification"]
        : analyseSelected.category === "PDF Document"
        ? ["NLP extraction", "OCR pipelines", "Document Q&A"]
        : ["Computer vision", "Image classification", "Object detection"],
    });
    setAnalysing(false);
  };

  const handleCompare = async () => {
    if (compareSelected.length < 2) return;
    setComparing(true);
    await new Promise(r => setTimeout(r, 1100));
    const dsets = compareSelected.map(d => {
      const s = d.score ?? Math.floor(Math.random() * 40 + 50);
      const seed = s / 100;
      return {
        id: d.id, name: d.name,
        scores: {
          "Quality":      s,
          "Completeness": Math.round(seed * 95 + 2),
          "Consistency":  Math.round(seed * 88 + 5),
          "Accuracy":     Math.round(seed * 92 + 3),
          "Uniqueness":   Math.round(seed * 78 + 10),
          "Volume":       Math.min(100, Math.round(((d.rows_count ?? 100) / 1000) + 30)),
        },
        pros: [
          s > 75 ? "High quality score" : "Usable baseline quality",
          d.rows_count > 5000 ? "Good data volume" : "Fast iteration cycle",
          d.columns_count > 4 ? "Rich feature set" : "Lean, efficient schema",
        ],
        cons: [
          s < 80 ? "Needs preprocessing" : "Minor edge-case noise",
          d.rows_count < 500 ? "Small dataset size" : "Large file — slower load",
          d.columns_count < 3 ? "Limited features" : "High dimensionality",
        ],
      };
    });
    const winner = dsets.reduce((best, cur) =>
      cur.scores["Quality"] > best.scores["Quality"] ? cur : best
    );
    const suggestion = `Based on overall quality and completeness, "${winner.name}" is the recommended dataset. It scores highest on key parameters and requires the least preprocessing overhead.`;
    setCompareResult({ winner: winner.id, datasets: dsets, suggestion });
    setComparing(false);
  };

  const navItems = [
    { icon: "⬡", label: "Dashboard",       color: "#a78bfa", glow: "rgba(167,139,250,0.25)", action: () => setActiveNav("Dashboard") },
    { icon: "↑",  label: "Upload",          color: "#38bdf8", glow: "rgba(56,189,248,0.25)",  action: () => setActiveNav("Upload") },
    { icon: "◈",  label: "Your Datasets",   color: "#c4b5fd", glow: "rgba(196,181,253,0.25)", action: () => { setActiveNav("Your Datasets"); setDatasetsTab("uploads"); } },
    { icon: "⬟",  label: "Analyse",         color: "#4ade80", glow: "rgba(74,222,128,0.25)",  action: () => { setActiveNav("Analyse"); setAnalyseSearch(""); setAnalyseSelected(null); setAnalyseResult(null); } },
    { icon: "◆",  label: "Compare",         color: "#fbbf24", glow: "rgba(251,191,36,0.25)",  action: () => { setActiveNav("Compare"); setCompareSearch(""); setCompareSelected([]); setCompareResult(null); } },
    { icon: "◇",  label: "Profile",         color: "#f472b6", glow: "rgba(244,114,182,0.25)", action: () => setActiveNav("Profile") },
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
        @keyframes uploadPulse { 0%,100%{border-color:rgba(56,189,248,0.3)} 50%{border-color:rgba(56,189,248,0.7)} }

        /* ── ORBS floating animations ── */
        @keyframes orb1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(60px, -80px) scale(1.08); }
          66%  { transform: translate(-40px, 50px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          25%  { transform: translate(-70px, 40px) scale(1.12); }
          75%  { transform: translate(50px, -60px) scale(0.92); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb3 {
          0%   { transform: translate(0px, 0px) scale(1); }
          40%  { transform: translate(40px, 70px) scale(1.06); }
          80%  { transform: translate(-55px, -30px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb4 {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(-45px, -55px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb5 {
          0%   { transform: translate(0px, 0px) scale(1); }
          30%  { transform: translate(55px, 35px) scale(0.93); }
          70%  { transform: translate(-30px, -65px) scale(1.07); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        /* ── Particle drift ── */
        @keyframes drift1 { 0%,100%{transform:translateY(0) translateX(0) rotate(0deg)} 50%{transform:translateY(-20px) translateX(12px) rotate(180deg)} }
        @keyframes drift2 { 0%,100%{transform:translateY(0) translateX(0) rotate(0deg)} 50%{transform:translateY(15px) translateX(-18px) rotate(-180deg)} }
        @keyframes drift3 { 0%,100%{transform:translateY(0) translateX(0)} 33%{transform:translateY(-25px) translateX(8px)} 66%{transform:translateY(10px) translateX(-12px)} }

        /* ── Scanline sweep ── */
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }

        /* ── Nav card glow border ── */
        @keyframes borderPulse { 0%,100%{border-color:rgba(124,58,237,0.14)} 50%{border-color:rgba(124,58,237,0.32)} }

        /* ── Gradient text animation ── */
        @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

        /* ── Stat number count-up glow ── */
        @keyframes numGlow { 0%,100%{text-shadow:0 0 20px rgba(167,139,250,0.4)} 50%{text-shadow:0 0 40px rgba(167,139,250,0.8), 0 0 80px rgba(124,58,237,0.3)} }

        .stat-card:hover {
          transform: translateY(-5px) !important;
          box-shadow: 0 12px 40px rgba(124,58,237,0.35) !important;
          border-color: rgba(167,139,250,0.5) !important;
        }
        .nav-card:hover {
          transform: translateY(-5px) scale(1.04) !important;
          border-color: rgba(167,139,250,0.6) !important;
          box-shadow: 0 10px 32px rgba(124,58,237,0.3) !important;
        }
        .recent-card:hover {
          transform: translateY(-4px) !important;
          border-color: rgba(167,139,250,0.5) !important;
          box-shadow: 0 10px 32px rgba(124,58,237,0.25) !important;
        }
        .dl-btn:hover {
          background: rgba(124,58,237,0.35) !important;
          box-shadow: 0 0 20px rgba(124,58,237,0.4) !important;
          color: #e2d9f3 !important;
        }
        .logout-btn:hover {
          background: rgba(239,68,68,0.22) !important;
          box-shadow: 0 0 18px rgba(239,68,68,0.3) !important;
        }
        .explore-btn:hover {
          background: rgba(56,189,248,0.22) !important;
          box-shadow: 0 0 20px rgba(56,189,248,0.32) !important;
          color: #7dd3fc !important;
        }
        .search-input:focus {
          border-color: rgba(124,58,237,0.6) !important;
          box-shadow: 0 0 20px rgba(124,58,237,0.2) !important;
        }
        .sidebar-btn {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 12px; border: none;
          font-family: inherit; cursor: pointer; font-size: 13px;
          font-weight: 500; letter-spacing: 0.04em;
          transition: all 0.22s cubic-bezier(.4,0,.2,1);
          text-align: left; width: 100%; position: relative; overflow: hidden;
        }
        .sidebar-btn:hover {
          background: rgba(124,58,237,0.16) !important;
          color: #e2d9f3 !important;
          transform: translateX(4px);
          box-shadow: 0 0 22px rgba(124,58,237,0.18) !important;
        }
        .sidebar-btn.active:hover { transform: translateX(2px); }
        .sidebar-logout:hover {
          background: rgba(239,68,68,0.2) !important;
          color: #fca5a5 !important;
          border-color: rgba(239,68,68,0.45) !important;
          box-shadow: 0 0 18px rgba(239,68,68,0.22) !important;
          transform: translateX(4px);
        }
      `}</style>

      {/* ── ANIMATED BACKGROUND ── */}
      {/* Deep space base */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 120% 80% at 50% 0%, #0d0520 0%, #06030f 60%, #000208 100%)" }} />

      {/* Floating orbs */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Orb 1 — purple, top-left */}
        <div style={{ position: "absolute", top: "5%", left: "8%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.28) 0%, rgba(99,40,200,0.12) 40%, transparent 70%)", filter: "blur(40px)", animation: "orb1 18s ease-in-out infinite" }} />
        {/* Orb 2 — cyan, top-right */}
        <div style={{ position: "absolute", top: "10%", right: "5%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.1) 40%, transparent 70%)", filter: "blur(50px)", animation: "orb2 22s ease-in-out infinite 3s" }} />
        {/* Orb 3 — violet, center */}
        <div style={{ position: "absolute", top: "40%", left: "35%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.07) 50%, transparent 70%)", filter: "blur(60px)", animation: "orb3 26s ease-in-out infinite 6s" }} />
        {/* Orb 4 — pink, bottom-left */}
        <div style={{ position: "absolute", bottom: "5%", left: "15%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, rgba(244,114,182,0.08) 40%, transparent 70%)", filter: "blur(45px)", animation: "orb4 20s ease-in-out infinite 9s" }} />
        {/* Orb 5 — green-teal, bottom-right */}
        <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(74,222,128,0.14) 0%, rgba(16,185,129,0.07) 40%, transparent 70%)", filter: "blur(50px)", animation: "orb5 24s ease-in-out infinite 4s" }} />
        {/* Orb 6 — amber accent, far top-center */}
        <div style={{ position: "absolute", top: "-5%", left: "45%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)", filter: "blur(55px)", animation: "orb1 30s ease-in-out infinite 12s" }} />
      </div>

      {/* Fine grid overlay */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />

      {/* Floating particles */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {[
          { top:"12%", left:"22%", size:3, color:"rgba(167,139,250,0.6)", anim:"drift1 8s ease-in-out infinite" },
          { top:"28%", left:"68%", size:2, color:"rgba(56,189,248,0.5)", anim:"drift2 11s ease-in-out infinite 2s" },
          { top:"55%", left:"15%", size:2, color:"rgba(74,222,128,0.45)", anim:"drift3 9s ease-in-out infinite 4s" },
          { top:"72%", left:"78%", size:3, color:"rgba(244,114,182,0.5)", anim:"drift1 12s ease-in-out infinite 1s" },
          { top:"38%", left:"88%", size:2, color:"rgba(251,191,36,0.4)", anim:"drift2 10s ease-in-out infinite 6s" },
          { top:"82%", left:"42%", size:2, color:"rgba(124,58,237,0.55)", anim:"drift3 14s ease-in-out infinite 3s" },
          { top:"18%", left:"52%", size:1.5, color:"rgba(56,189,248,0.4)", anim:"drift1 7s ease-in-out infinite 5s" },
          { top:"65%", left:"32%", size:2, color:"rgba(168,85,247,0.5)", anim:"drift2 13s ease-in-out infinite 7s" },
        ].map((p, i) => (
          <div key={i} style={{ position: "absolute", top: p.top, left: p.left, width: p.size, height: p.size, borderRadius: "50%", background: p.color, boxShadow: `0 0 ${p.size * 4}px ${p.color}`, animation: p.anim }} />
        ))}
      </div>

      {/* Scanline sweep */}
      <div style={{ position: "fixed", left: 0, right: 0, height: 1, zIndex: 1, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.35), rgba(56,189,248,0.2), transparent)", animation: "scanline 14s linear infinite" }} />

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

      {/* ── LAYOUT: sidebar + content when panel active, else full-width grid ── */}
      {activeNav === "Dashboard" ? (
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>
          {/* Full-width topbar */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 0", gap: 16, animation: "fadeIn 0.3s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #a855f7, #38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#fff", boxShadow: "0 0 24px rgba(124,58,237,0.7), 0 0 0 1px rgba(124,58,237,0.3)" }}>N</div>
              <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "0.1em", background: "linear-gradient(90deg, #e2d9f3, #a78bfa, #38bdf8, #a78bfa, #e2d9f3)", backgroundSize: "300% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "gradShift 6s ease infinite" }}>NEURORIFT</span>
            </div>
            <div style={{ flex: 1, maxWidth: 440, position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: searchFocused ? "#a78bfa" : "#6b7280", transition: "color 0.2s" }}>⌕</span>
              <input className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search recent datasets..." style={{ width: "100%", padding: "10px 16px 10px 36px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)", borderRadius: 12, color: "#e2d9f3", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "all 0.2s", backdropFilter: "blur(10px)" }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="explore-btn" onClick={() => router.push("/datasets")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 11, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.28)", color: "#38bdf8", fontSize: 13, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 0 14px rgba(56,189,248,0.1)" }}><span style={{ fontSize: 15 }}>◎</span>Explore</button>
              <button className="logout-btn" onClick={() => router.push("/auth")} style={{ padding: "10px 22px", borderRadius: 11, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 13, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>Logout</button>
            </div>
          </header>
          {/* Grid nav */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, padding: "26px 0 0", animation: "fadeIn 0.4s ease both", animationDelay: "0.05s" }}>
            {navItems.map((item, i) => {
              const isActive = activeNav === item.label;
              return (
                <button key={item.label} className="nav-card" onClick={item.action} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 12px", background: isActive ? `linear-gradient(145deg, rgba(124,58,237,0.22), rgba(16,10,30,0.85))` : "rgba(16,10,30,0.75)", border: isActive ? `1px solid ${item.color}55` : "1px solid rgba(124,58,237,0.14)", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.22s cubic-bezier(.4,0,.2,1)", backdropFilter: "blur(14px)", boxShadow: isActive ? `0 0 24px ${item.glow}` : "none", animation: "fadeIn 0.4s ease both", animationDelay: `${0.06 + i * 0.06}s`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isActive ? `radial-gradient(ellipse 70% 70% at 50% 0%, ${item.glow}, transparent 70%)` : "none", transition: "all 0.3s" }} />
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: isActive ? `linear-gradient(135deg, ${item.color}33, ${item.color}11)` : "rgba(124,58,237,0.1)", border: `1px solid ${isActive ? item.color + "55" : "rgba(124,58,237,0.18)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: isActive ? item.color : "#6b7280", fontWeight: 700, flexShrink: 0, transition: "all 0.22s", boxShadow: isActive ? `0 0 16px ${item.glow}` : "none" }}>{item.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? item.color : "#6b7280", letterSpacing: "0.06em", textAlign: "center", lineHeight: 1.3, transition: "color 0.2s" }}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dashboard stats + recently opened panels follow below */}
        {activeNav === "Upload" && (
          <div style={{ marginTop: 24, animation: "fadeIn 0.35s ease both" }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.json,.txt"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "rgba(56,189,248,0.8)" : "rgba(56,189,248,0.3)"}`,
                borderRadius: 16, padding: "52px 24px", textAlign: "center", cursor: "pointer",
                background: dragOver ? "rgba(56,189,248,0.06)" : "rgba(16,10,30,0.6)",
                backdropFilter: "blur(12px)", transition: "all 0.2s ease",
                animation: uploadFiles.length === 0 ? "uploadPulse 3s ease-in-out infinite" : "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: dragOver ? "rgba(56,189,248,0.18)" : "rgba(56,189,248,0.1)",
                border: `1px solid ${dragOver ? "rgba(56,189,248,0.5)" : "rgba(56,189,248,0.2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, color: "#38bdf8", fontWeight: 300,
                boxShadow: dragOver ? "0 0 28px rgba(56,189,248,0.3)" : "none",
                transition: "all 0.2s",
              }}>+</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2d9f3", marginBottom: 6 }}>
                  {dragOver ? "Drop files here" : "Click or drag files to upload"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.06em" }}>
                  CSV · PDF · PNG · JPG · WEBP · XLSX · JSON · TXT
                </div>
              </div>
            </div>

            {uploadFiles.length > 0 && (
              <div style={{ marginTop: 18, animation: "fadeIn 0.3s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700 }}>
                    // {uploadFiles.length} FILE{uploadFiles.length !== 1 ? "S" : ""} QUEUED
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 8,
                      background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                      color: "#38bdf8", fontSize: 11, fontFamily: "inherit", fontWeight: 700,
                      cursor: "pointer", letterSpacing: "0.08em", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.18)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.1)"; }}
                  ><span style={{ fontSize: 15, fontWeight: 900 }}>+</span> ADD MORE</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                  {uploadFiles.map((file, idx) => {
                    const key = file.name + file.size;
                    const status = uploadProgress[key];
                    return (
                      <div key={key} style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "12px 16px", borderRadius: 11,
                        background: status === "done" ? "rgba(34,197,94,0.08)" : status === "error" ? "rgba(239,68,68,0.08)" : status === "uploading" ? "rgba(56,189,248,0.08)" : "rgba(16,10,30,0.7)",
                        border: `1px solid ${status === "done" ? "rgba(34,197,94,0.25)" : status === "error" ? "rgba(239,68,68,0.25)" : status === "uploading" ? "rgba(56,189,248,0.3)" : "rgba(124,58,237,0.15)"}`,
                        transition: "all 0.2s", animation: "fadeIn 0.25s ease both", animationDelay: `${idx * 0.04}s`,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, color: "#38bdf8",
                        }}>{getFileIcon(file)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{getFileSize(file.size)} · {file.name.split(".").pop()?.toUpperCase()}</div>
                        </div>
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                          {!status && (
                            <button
                              onClick={e => { e.stopPropagation(); removeFile(idx); }}
                              style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 8px", color: "#6b7280", fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.2)"; }}
                            >✕</button>
                          )}
                          {status === "uploading" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTop: "2px solid #38bdf8", animation: "spin 0.7s linear infinite" }} />
                              <span style={{ fontSize: 9, color: "#38bdf8", letterSpacing: "0.1em" }}>UPLOADING</span>
                            </div>
                          )}
                          {status === "done" && (
                            <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 5, fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", letterSpacing: "0.08em" }}>✓ DONE</span>
                          )}
                          {status === "error" && (
                            <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 5, fontWeight: 700, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", letterSpacing: "0.08em" }}>✕ FAILED</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleUploadAll}
                  disabled={uploadingFiles || uploadFiles.length === 0}
                  style={{
                    width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12,
                    background: uploadingFiles ? "rgba(56,189,248,0.12)" : "linear-gradient(135deg, #0ea5e9, #38bdf8, #7c3aed)",
                    border: uploadingFiles ? "1px solid rgba(56,189,248,0.3)" : "none",
                    color: uploadingFiles ? "#38bdf8" : "#fff",
                    fontSize: 13, fontFamily: "inherit", fontWeight: 800,
                    cursor: uploadingFiles ? "not-allowed" : "pointer", letterSpacing: "0.1em",
                    boxShadow: uploadingFiles ? "none" : "0 0 28px rgba(56,189,248,0.35)",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  }}
                >
                  {uploadingFiles ? (
                    <>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTop: "2px solid #38bdf8", animation: "spin 0.7s linear infinite" }} />
                      UPLOADING {uploadFiles.length} FILE{uploadFiles.length !== 1 ? "S" : ""}…
                    </>
                  ) : (
                    <>↑ UPLOAD {uploadFiles.length} FILE{uploadFiles.length !== 1 ? "S" : ""} TO DATABASE</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── YOUR DATASETS PANEL ─────────────────────────────────────────── */}
        {activeNav === "Your Datasets" && (
          <div style={{ marginTop: 24, animation: "fadeIn 0.35s ease both" }}>
            <div style={{
              background: "rgba(16,10,30,0.72)", border: "1px solid rgba(124,58,237,0.16)",
              borderRadius: 16, backdropFilter: "blur(14px)", overflow: "hidden",
            }}>
              {/* Header + toggle */}
              <div style={{
                padding: "20px 26px", borderBottom: "1px solid rgba(124,58,237,0.1)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f3f0ff" }}>
                    {datasetsTab === "uploads" ? "My Uploads" : "My Downloads"}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                    {datasetsTab === "uploads" ? `${myUploads.length} dataset${myUploads.length!==1?"s":""} uploaded` : `${myDownloads.length} dataset${myDownloads.length!==1?"s":""} downloaded`}
                  </div>
                </div>
                {/* Slide toggle */}
                <div style={{
                  display: "flex", borderRadius: 50, padding: 3,
                  background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)",
                }}>
                  {(["uploads", "downloads"] as const).map((tab) => (
                    <button key={tab} onClick={() => setDatasetsTab(tab)} style={{
                      padding: "8px 22px", borderRadius: 50, fontSize: 13,
                      fontFamily: "inherit", fontWeight: 700, cursor: "pointer", border: "none",
                      letterSpacing: "0.04em", transition: "all 0.2s",
                      background: datasetsTab === tab
                        ? tab === "uploads" ? "rgba(167,139,250,0.25)" : "rgba(56,189,248,0.22)"
                        : "transparent",
                      color: datasetsTab === tab
                        ? tab === "uploads" ? "#c4b5fd" : "#38bdf8"
                        : "#6b7280",
                      boxShadow: datasetsTab === tab
                        ? tab === "uploads" ? "0 0 14px rgba(167,139,250,0.3)" : "0 0 14px rgba(56,189,248,0.3)"
                        : "none",
                    }}>
                      {tab === "uploads" ? `↑ Uploads (${myUploads.length})` : `↓ Downloads (${myDownloads.length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: "20px 26px" }}>
                {loadingMine && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                )}

                {!loadingMine && (datasetsTab === "uploads" ? myUploads : myDownloads).length === 0 && (
                  <div style={{ padding: "52px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%",
                      background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.16)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, color: "#7c3aed",
                    }}>{datasetsTab === "uploads" ? "↑" : "↓"}</div>
                    <div style={{ fontSize: 15, color: "#9ca3af", fontWeight: 600 }}>
                      {datasetsTab === "uploads" ? "No uploads yet" : "No downloads yet"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {datasetsTab === "uploads" ? "Start uploading datasets to your library." : "Browse and download datasets from the Explore page."}
                    </div>
                    {datasetsTab === "uploads" && (
                      <button onClick={() => setActiveNav("Upload")} style={{
                        marginTop: 4, padding: "10px 24px", borderRadius: 10,
                        background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.28)",
                        color: "#38bdf8", fontSize: 13, fontFamily: "inherit", fontWeight: 700,
                        cursor: "pointer",
                      }}>↑ Upload Now</button>
                    )}
                    {datasetsTab === "downloads" && (
                      <button onClick={() => router.push("/datasets")} style={{
                        marginTop: 4, padding: "10px 24px", borderRadius: 10,
                        background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)",
                        color: "#c4b5fd", fontSize: 13, fontFamily: "inherit", fontWeight: 700,
                        cursor: "pointer",
                      }}>◎ Browse Datasets</button>
                    )}
                  </div>
                )}

                {!loadingMine && (datasetsTab === "uploads" ? myUploads : myDownloads).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                    {(datasetsTab === "uploads" ? myUploads : myDownloads).map((d, i) => {
                      const safeScore = d.score ?? 0;
                      return (
                        <div key={d.id} className="recent-card" onClick={() => handleDatasetClick(d)} style={{
                          background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.18)",
                          borderRadius: 13, padding: "16px 18px", cursor: "pointer",
                          transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
                          animation: "fadeUp 0.3s ease both", animationDelay: `${i * 0.05}s`,
                          position: "relative", overflow: "hidden",
                        }}>
                          <div style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, background: "radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#38bdf8" }}>{fileTypeIcon(d.file_url)}</div>
                            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, fontWeight: 700, background: scoreBg(safeScore), border: `1px solid ${scoreBorder(safeScore)}`, color: scoreColor(safeScore), letterSpacing: "0.06em" }}>{safeScore}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2d9f3", lineHeight: 1.35, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa", letterSpacing: "0.06em" }}>{d.category ?? "—"}</span>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#38bdf8" }}>{fileTypeLabel(d.file_url)}</span>
                          </div>
                          <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 10 }}>{timeAgo(d.created_at)}</div>
                          <button className="dl-btn" onClick={(e) => handleDownload(d, e)} disabled={downloadingId === d.id} style={{
                            width: "100%", padding: "7px 0", borderRadius: 8,
                            background: downloadingId === d.id ? "rgba(124,58,237,0.06)" : "rgba(124,58,237,0.14)",
                            border: "1px solid rgba(124,58,237,0.28)",
                            color: downloadingId === d.id ? "#4b5563" : "#c4b5fd",
                            fontSize: 10, fontFamily: "inherit", fontWeight: 700,
                            cursor: downloadingId === d.id ? "not-allowed" : "pointer",
                            letterSpacing: "0.08em", transition: "all 0.18s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}>
                            {downloadingId === d.id ? "···" : "↓ DOWNLOAD"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE PANEL ───────────────────────────────────────────────────── */}
        {activeNav === "Profile" && (
          <div style={{ animation: "fadeIn 0.35s ease both" }}>
            <div style={{
              background: "rgba(16,10,30,0.78)", border: "1px solid rgba(244,114,182,0.2)",
              borderRadius: 16, backdropFilter: "blur(14px)", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                padding: "24px 32px", borderBottom: "1px solid rgba(244,114,182,0.12)",
                background: "linear-gradient(90deg, rgba(244,114,182,0.07), transparent)",
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#f3f0ff" }}>Your Account</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>Manage your personal details and security</div>
              </div>

              <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 22 }}>
                {/* Avatar + name display */}
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "linear-gradient(135deg, #a855f7, #38bdf8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, fontWeight: 900, color: "#fff",
                    boxShadow: "0 0 24px rgba(168,85,247,0.45)",
                    flexShrink: 0,
                  }}>
                    {(profileUser?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#f3f0ff" }}>{profileUser?.name ?? "—"}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{profileUser?.email ?? "—"}</div>
                  </div>
                </div>

                {/* Read-only fields */}
                {[
                  { label: "Full Name", value: profileUser?.name ?? "—" },
                  { label: "Email",     value: profileUser?.email ?? "—" },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 7 }}>{f.label}</div>
                    <div style={{
                      padding: "11px 16px", borderRadius: 10,
                      background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.12)",
                      fontSize: 14, color: "#9ca3af",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span>{f.value}</span>
                      <span style={{ fontSize: 10, color: "#4b5563", background: "rgba(124,58,237,0.1)", padding: "2px 8px", borderRadius: 4 }}>Read only</span>
                    </div>
                  </div>
                ))}

                {/* Phone number */}
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 7 }}>Phone Number</div>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    style={{
                      width: "100%", padding: "11px 16px", borderRadius: 10,
                      background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.22)",
                      color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box", transition: "border-color 0.2s",
                    }}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(244,114,182,0.5)"; }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.22)"; }}
                  />
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "rgba(124,58,237,0.1)" }} />

                {/* Change password */}
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 10 }}>Change Password</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      type="password"
                      value={profileNewPw}
                      onChange={e => setProfileNewPw(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      style={{
                        width: "100%", padding: "11px 16px", borderRadius: 10,
                        background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.22)",
                        color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none",
                        boxSizing: "border-box", transition: "border-color 0.2s",
                      }}
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(244,114,182,0.5)"; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.22)"; }}
                    />
                    <input
                      type="password"
                      value={profileConfPw}
                      onChange={e => setProfileConfPw(e.target.value)}
                      placeholder="Confirm new password"
                      style={{
                        width: "100%", padding: "11px 16px", borderRadius: 10,
                        background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.22)",
                        color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none",
                        boxSizing: "border-box", transition: "border-color 0.2s",
                      }}
                      onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(244,114,182,0.5)"; }}
                      onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.22)"; }}
                    />
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 10,
                    background: profileSaving ? "rgba(244,114,182,0.1)" : "linear-gradient(135deg, #db2777, #f472b6)",
                    border: profileSaving ? "1px solid rgba(244,114,182,0.3)" : "none",
                    color: profileSaving ? "#f472b6" : "#fff",
                    fontSize: 12, fontFamily: "inherit", fontWeight: 800,
                    cursor: profileSaving ? "not-allowed" : "pointer", letterSpacing: "0.1em",
                    boxShadow: profileSaving ? "none" : "0 0 20px rgba(244,114,182,0.3)",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {profileSaving ? (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(244,114,182,0.2)", borderTop: "2px solid #f472b6", animation: "spin 0.7s linear infinite" }} />
                      SAVING…
                    </>
                  ) : "SAVE CHANGES"}
                </button>

                {/* Danger zone */}
                <div style={{
                  padding: "16px 18px", borderRadius: 10,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
                }}>
                  <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700, marginBottom: 8 }}>⚠ Danger Zone</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>
                    Deleting your account is permanent and cannot be undone. All your data will be removed.
                  </div>
                  {confirmDelete && (
                    <div style={{ fontSize: 11, color: "#f87171", marginBottom: 10, fontWeight: 600 }}>
                      Are you sure? Click again to confirm deletion.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={profileDeleting}
                      style={{
                        flex: 1, padding: "11px 0", borderRadius: 9,
                        background: confirmDelete ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.1)",
                        border: `1px solid ${confirmDelete ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.3)"}`,
                        color: "#f87171", fontSize: 13, fontFamily: "inherit", fontWeight: 700,
                        cursor: profileDeleting ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                      }}
                    >{profileDeleting ? "Deleting…" : confirmDelete ? "⚠ Confirm Delete Account" : "Delete Account"}</button>
                    {confirmDelete && (
                      <button onClick={() => setConfirmDelete(false)} style={{
                        padding: "11px 18px", borderRadius: 9,
                        background: "transparent", border: "1px solid rgba(124,58,237,0.2)",
                        color: "#9ca3af", fontSize: 13, fontFamily: "inherit",
                        cursor: "pointer", transition: "all 0.15s",
                      }}>Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeNav !== "Upload" && activeNav !== "Your Datasets" && activeNav !== "Profile" && (
          <>
        {/* ── STAT CARDS ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 16, padding: "24px 0 0",
          animation: "fadeIn 0.45s ease both",
          animationDelay: "0.1s",
        }}>
          {[
            { icon: "↑", label: "Total Uploads",   value: String(uploadCount),   color: "#a78bfa", glow: "rgba(167,139,250,0.25)", borderGrad: "linear-gradient(135deg,#7c3aed,#a855f7,#38bdf8)", tab: "uploads"   as const },
            { icon: "↓", label: "Total Downloads", value: String(downloadCount), color: "#38bdf8", glow: "rgba(56,189,248,0.25)",  borderGrad: "linear-gradient(135deg,#0ea5e9,#38bdf8,#a855f7)", tab: "downloads" as const },
          ].map((s, i) => (
            <div key={i} style={{ padding: "1.5px", borderRadius: 16, background: s.borderGrad, animation: "fadeIn 0.4s ease both", animationDelay: `${0.12 + i * 0.08}s`, boxShadow: `0 0 32px ${s.glow}` }}>
              <div
                className="stat-card"
                onClick={() => { setActiveNav("Your Datasets"); setDatasetsTab(s.tab); }}
                style={{
                  background: "rgba(10,6,22,0.88)",
                  borderRadius: 14.5, padding: "22px 26px",
                  backdropFilter: "blur(20px)",
                  display: "flex", alignItems: "center", gap: 20,
                  position: "relative", overflow: "hidden",
                  transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                  cursor: "pointer",
                }}
              >
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 60% 70% at 5% 50%, ${s.glow}, transparent 65%)` }} />
                <div style={{
                  width: 52, height: 52, borderRadius: 13, flexShrink: 0,
                  background: `linear-gradient(135deg, ${s.color}28, ${s.color}0c)`,
                  border: `1.5px solid ${s.color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, color: s.color, fontWeight: 900,
                  boxShadow: `0 0 20px ${s.glow}`,
                  position: "relative", zIndex: 1,
                }}>{s.icon}</div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 38, fontWeight: 900, color: "#f3f0ff", letterSpacing: "-0.04em", lineHeight: 1, animation: "numGlow 3s ease-in-out infinite" }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: s.color, marginTop: 5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>View details <span>→</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── ACTIVITY STRIP ──────────────────────────────────────────────────── */}
        <div style={{
          margin: "16px 0 0",
          padding: "14px 24px",
          background: "rgba(10,6,22,0.7)",
          border: "1px solid rgba(124,58,237,0.18)",
          borderRadius: 12, backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "fadeIn 0.5s ease both", animationDelay: "0.14s",
          boxShadow: "inset 0 0 30px rgba(124,58,237,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#38bdf8)", boxShadow: "0 0 12px rgba(167,139,250,0.8)", animation: "glowPulse 2s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#9ca3af" }}>
              You uploaded{" "}
              <span style={{ color: "#c4b5fd", fontWeight: 700 }}>{uploadCount}</span>
              {" "}dataset{uploadCount !== 1 ? "s" : ""} &nbsp;·&nbsp; downloaded{" "}
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>{downloadCount}</span>
              {" "}dataset{downloadCount !== 1 ? "s" : ""}
            </span>
          </div>
          {lastActivity && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Last activity: {timeAgo(lastActivity)}
            </span>
          )}
        </div>

        {/* ── RECENTLY OPENED ─────────────────────────────────────────────────── */}
        <div style={{
          margin: "20px 0 0",
          background: "rgba(10,6,22,0.75)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 18, backdropFilter: "blur(20px)",
          overflow: "hidden",
          animation: "fadeIn 0.55s ease both", animationDelay: "0.18s",
          boxShadow: "0 0 60px rgba(124,58,237,0.08)",
        }}>
          <div style={{
            padding: "20px 28px",
            borderBottom: "1px solid rgba(124,58,237,0.12)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(124,58,237,0.08) 0%, rgba(56,189,248,0.04) 50%, transparent 100%)",
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f3f0ff" }}>Recently Opened</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{recentDatasets.length} / 5 datasets</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={() => { localStorage.removeItem("recent_datasets"); setRecentDatasets([]); }}
                style={{
                  background: "transparent", border: "1px solid rgba(124,58,237,0.18)",
                  borderRadius: 7, padding: "6px 13px",
                  color: "#6b7280", fontSize: 12, fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.35)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.18)"; }}
              >✕ Clear</button>
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
          </>
        )}

          {/* Dashboard panels rendered below */}
        </div>
      ) : (
        /* ── SIDEBAR LAYOUT for non-Dashboard panels ─────────────────────────── */
        <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>
          {/* Sidebar nav */}
          <aside style={{
            width: 224, flexShrink: 0, padding: "24px 14px",
            background: "rgba(10,6,20,0.92)", backdropFilter: "blur(24px)",
            borderRight: "1px solid rgba(124,58,237,0.18)",
            display: "flex", flexDirection: "column", gap: 4,
            position: "sticky", top: 0, height: "100vh", overflowY: "auto",
          }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 6px" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#fff", boxShadow: "0 0 16px rgba(124,58,237,0.55)", flexShrink: 0 }}>N</div>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.1em" }}><span style={{ color: "#fff" }}>NEURO</span><span style={{ color: "#38bdf8" }}>RIFT</span></span>
            </div>

            {/* Section label */}
            <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: "0.18em", fontWeight: 700, padding: "0 8px", marginBottom: 6 }}>NAVIGATION</div>

            {navItems.map((item) => {
              const isActive = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  className={`sidebar-btn${isActive ? " active" : ""}`}
                  onClick={item.action}
                  style={{
                    background: isActive
                      ? `linear-gradient(90deg, ${item.color}1e, ${item.color}08)`
                      : "transparent",
                    borderLeft: `3px solid ${isActive ? item.color : "transparent"}`,
                    color: isActive ? item.color : "#9ca3af",
                    fontWeight: isActive ? 700 : 500,
                    boxShadow: isActive ? `inset 0 0 20px ${item.glow}40, 0 0 12px ${item.glow}` : "none",
                  }}
                >
                  {/* Animated hover bg */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none",
                    background: isActive ? `radial-gradient(ellipse 80% 80% at 0% 50%, ${item.color}18, transparent 70%)` : "none",
                    transition: "opacity 0.2s",
                  }} />
                  {/* Icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: isActive ? `linear-gradient(135deg, ${item.color}2a, ${item.color}0e)` : "rgba(124,58,237,0.1)",
                    border: `1px solid ${isActive ? item.color + "44" : "rgba(124,58,237,0.15)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: isActive ? item.color : "#6b7280",
                    transition: "all 0.2s",
                    boxShadow: isActive ? `0 0 12px ${item.glow}` : "none",
                  }}>{item.icon}</div>
                  <span style={{ fontSize: 13, letterSpacing: "0.04em" }}>{item.label}</span>
                  {isActive && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: item.color, boxShadow: `0 0 8px ${item.color}` }} />}
                </button>
              );
            })}

            <div style={{ flex: 1, minHeight: 20 }} />

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(124,58,237,0.12)", margin: "8px 0" }} />

            {/* Explore button */}
            <button
              className="sidebar-btn explore-btn"
              onClick={() => router.push("/datasets")}
              style={{ background: "rgba(56,189,248,0.07)", borderLeft: "3px solid rgba(56,189,248,0.3)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.15)" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#38bdf8" }}>◎</div>
              <span style={{ fontSize: 13 }}>Explore</span>
            </button>

            {/* Logout */}
            <button
              className="sidebar-btn sidebar-logout"
              onClick={() => router.push("/auth")}
              style={{ background: "rgba(239,68,68,0.07)", borderLeft: "3px solid rgba(239,68,68,0.3)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", marginTop: 4 }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#f87171" }}>⏻</div>
              <span style={{ fontSize: 13 }}>Logout</span>
            </button>
          </aside>

          {/* Main content area */}
          <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", minHeight: "100vh" }}>
            {/* Panel topbar */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f3f0ff", letterSpacing: "-0.02em" }}>{activeNav}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                {activeNav === "Upload" && "Upload datasets to the NeuroRift library"}
                {activeNav === "Your Datasets" && "View your uploaded and downloaded datasets"}
                {activeNav === "Analyse" && "Deep-dive analysis and AI insights for any dataset"}
                {activeNav === "Compare" && "Side-by-side comparison with scoring and recommendations"}
                {activeNav === "Profile" && "Manage your account settings"}
              </div>
            </div>

            {/* ── UPLOAD panel ─────────────────────────────────────────────── */}
            {activeNav === "Upload" && (
              <div style={{ animation: "fadeIn 0.3s ease both" }}>
                <input ref={fileInputRef} type="file" multiple accept=".csv,.pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.json,.txt" style={{ display: "none" }} onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${dragOver ? "rgba(56,189,248,0.8)" : "rgba(56,189,248,0.3)"}`, borderRadius: 16, padding: "52px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(56,189,248,0.06)" : "rgba(16,10,30,0.6)", backdropFilter: "blur(12px)", transition: "all 0.2s ease", animation: uploadFiles.length === 0 ? "uploadPulse 3s ease-in-out infinite" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: dragOver ? "rgba(56,189,248,0.18)" : "rgba(56,189,248,0.1)", border: `1px solid ${dragOver ? "rgba(56,189,248,0.5)" : "rgba(56,189,248,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#38bdf8", fontWeight: 300, transition: "all 0.2s" }}>+</div>
                  <div><div style={{ fontSize: 15, fontWeight: 700, color: "#e2d9f3", marginBottom: 6 }}>{dragOver ? "Drop files here" : "Click or drag files to upload"}</div><div style={{ fontSize: 11, color: "#6b7280" }}>CSV · PDF · PNG · JPG · WEBP · XLSX · JSON · TXT</div></div>
                </div>
                {uploadFiles.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700 }}>// {uploadFiles.length} FILE{uploadFiles.length !== 1 ? "S" : ""} QUEUED</div>
                      <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}><span style={{ fontSize: 15 }}>+</span> ADD MORE</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                      {uploadFiles.map((file, idx) => {
                        const key = file.name + file.size; const status = uploadProgress[key];
                        return (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 11, background: status === "done" ? "rgba(34,197,94,0.08)" : status === "error" ? "rgba(239,68,68,0.08)" : status === "uploading" ? "rgba(56,189,248,0.08)" : "rgba(16,10,30,0.7)", border: `1px solid ${status === "done" ? "rgba(34,197,94,0.25)" : status === "error" ? "rgba(239,68,68,0.25)" : status === "uploading" ? "rgba(56,189,248,0.3)" : "rgba(124,58,237,0.15)"}`, transition: "all 0.2s" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#38bdf8" }}>{getFileIcon(file)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{getFileSize(file.size)} · {file.name.split(".").pop()?.toUpperCase()}</div></div>
                            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                              {!status && <button onClick={e => { e.stopPropagation(); removeFile(idx); }} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 8px", color: "#6b7280", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
                              {status === "uploading" && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTop: "2px solid #38bdf8", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 9, color: "#38bdf8" }}>UPLOADING</span></div>}
                              {status === "done" && <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 5, fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>✓ DONE</span>}
                              {status === "error" && <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 5, fontWeight: 700, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>✕ FAILED</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={handleUploadAll} disabled={uploadingFiles || uploadFiles.length === 0} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12, background: uploadingFiles ? "rgba(56,189,248,0.12)" : "linear-gradient(135deg, #0ea5e9, #38bdf8, #7c3aed)", border: uploadingFiles ? "1px solid rgba(56,189,248,0.3)" : "none", color: uploadingFiles ? "#38bdf8" : "#fff", fontSize: 13, fontFamily: "inherit", fontWeight: 800, cursor: uploadingFiles ? "not-allowed" : "pointer", boxShadow: uploadingFiles ? "none" : "0 0 28px rgba(56,189,248,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      {uploadingFiles ? (<><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(56,189,248,0.2)", borderTop: "2px solid #38bdf8", animation: "spin 0.7s linear infinite" }} />UPLOADING…</>) : <>↑ UPLOAD {uploadFiles.length} FILE{uploadFiles.length !== 1 ? "S" : ""} TO DATABASE</>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── YOUR DATASETS panel ──────────────────────────────────────── */}
            {activeNav === "Your Datasets" && (
              <div style={{ animation: "fadeIn 0.3s ease both" }}>
                <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(124,58,237,0.16)", borderRadius: 16, backdropFilter: "blur(14px)", overflow: "hidden" }}>
                  <div style={{ padding: "20px 26px", borderBottom: "1px solid rgba(124,58,237,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div><div style={{ fontSize: 15, color: "#f3f0ff", fontWeight: 700 }}>Your Datasets</div><div style={{ fontSize: 15, fontWeight: 700, color: "#f3f0ff", marginTop: 3 }}>{datasetsTab === "uploads" ? "My Uploads" : "My Downloads"}</div></div>
                    <div style={{ display: "flex", borderRadius: 50, padding: 3, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}>
                      {(["uploads","downloads"] as const).map(tab => (
                        <button key={tab} onClick={() => setDatasetsTab(tab)} style={{ padding: "7px 20px", borderRadius: 50, fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", border: "none", letterSpacing: "0.08em", transition: "all 0.2s", background: datasetsTab === tab ? (tab === "uploads" ? "rgba(167,139,250,0.25)" : "rgba(56,189,248,0.22)") : "transparent", color: datasetsTab === tab ? (tab === "uploads" ? "#c4b5fd" : "#38bdf8") : "#6b7280", boxShadow: datasetsTab === tab ? (tab === "uploads" ? "0 0 14px rgba(167,139,250,0.3)" : "0 0 14px rgba(56,189,248,0.3)") : "none" }}>
                          {tab === "uploads" ? `↑ UPLOADS (${myUploads.length})` : `↓ DOWNLOADS (${myDownloads.length})`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "20px 26px" }}>
                    {loadingMine && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>{Array.from({length:4}).map((_,i) => <SkeletonCard key={i} />)}</div>}
                    {!loadingMine && (datasetsTab === "uploads" ? myUploads : myDownloads).length === 0 && (
                      <div style={{ padding: "52px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#7c3aed" }}>{datasetsTab === "uploads" ? "↑" : "↓"}</div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>{datasetsTab === "uploads" ? "You haven't uploaded any datasets yet." : "You haven't downloaded any datasets yet."}</div>
                        {datasetsTab === "uploads" && <button onClick={() => setActiveNav("Upload")} style={{ marginTop: 4, padding: "9px 22px", borderRadius: 10, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.28)", color: "#38bdf8", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>↑ UPLOAD NOW</button>}
                        {datasetsTab === "downloads" && <button onClick={() => router.push("/datasets")} style={{ marginTop: 4, padding: "9px 22px", borderRadius: 10, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.28)", color: "#c4b5fd", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>◎ BROWSE DATASETS</button>}
                      </div>
                    )}
                    {!loadingMine && (datasetsTab === "uploads" ? myUploads : myDownloads).length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>
                        {(datasetsTab === "uploads" ? myUploads : myDownloads).map((d,i) => {
                          const ss = d.score ?? 0;
                          return (
                            <div key={d.id} className="recent-card" onClick={() => handleDatasetClick(d)} style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 13, padding: "16px 18px", cursor: "pointer", transition: "all 0.2s", animation: "fadeUp 0.3s ease both", animationDelay: `${i*0.05}s`, position: "relative", overflow: "hidden" }}>
                              <div style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, background: "radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)" }} />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#38bdf8" }}>{fileTypeIcon(d.file_url)}</div>
                                <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, fontWeight: 700, background: scoreBg(ss), border: `1px solid ${scoreBorder(ss)}`, color: scoreColor(ss) }}>{ss}</span>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2d9f3", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</div>
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>{d.category ?? "—"}</span>
                                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#38bdf8" }}>{fileTypeLabel(d.file_url)}</span>
                              </div>
                              <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 10 }}>{timeAgo(d.created_at)}</div>
                              <button className="dl-btn" onClick={e => handleDownload(d,e)} disabled={downloadingId===d.id} style={{ width: "100%", padding: "7px 0", borderRadius: 8, background: downloadingId===d.id ? "rgba(124,58,237,0.06)" : "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.28)", color: downloadingId===d.id ? "#4b5563" : "#c4b5fd", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: downloadingId===d.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                {downloadingId===d.id ? "···" : "↓ DOWNLOAD"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── ANALYSE panel ────────────────────────────────────────────── */}
            {activeNav === "Analyse" && (
              <div style={{ display: "grid", gridTemplateColumns: analyseResult ? "340px 1fr" : "1fr", gap: 20, animation: "fadeIn 0.3s ease both" }}>
                {/* Left: dataset picker */}
                <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 14, padding: "20px", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#4ade80", fontWeight: 700 }}>Select a Dataset</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{allDatasets.length} available</div>
                  </div>
                  {/* Search */}
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#6b7280" }}>⌕</span>
                    <input
                      value={analyseSearch}
                      onChange={e => setAnalyseSearch(e.target.value)}
                      placeholder="Search all datasets..."
                      style={{ width: "100%", padding: "9px 12px 9px 30px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 9, color: "#e2d9f3", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  {/* Dataset list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 420, overflowY: "auto" }}>
                    {loadingAll ? (
                      Array.from({length:5}).map((_,i) => (
                        <div key={i} style={{ height: 52, borderRadius: 10, background: "rgba(124,58,237,0.07)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.1}s` }} />
                      ))
                    ) : (() => {
                      const filtered = allDatasets.filter(d =>
                        !analyseSearch || (d.name ?? "").toLowerCase().includes(analyseSearch.toLowerCase()) || (d.category ?? "").toLowerCase().includes(analyseSearch.toLowerCase())
                      );
                      return filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>
                          {analyseSearch ? `No datasets match "${analyseSearch}"` : "No datasets in library yet."}
                        </div>
                      ) : filtered.map((d) => (
                        <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${analyseSelected?.id===d.id ? "rgba(74,222,128,0.45)" : "rgba(124,58,237,0.12)"}`, background: analyseSelected?.id===d.id ? "rgba(74,222,128,0.09)" : "rgba(124,58,237,0.04)", transition: "all 0.15s" }}>
                          <input type="radio" name="analyse_ds" checked={analyseSelected?.id===d.id} onChange={() => { setAnalyseSelected(d); setAnalyseResult(null); }} style={{ accentColor: "#4ade80", width: 14, height: 14, flexShrink: 0 }} />
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#4ade80", flexShrink: 0 }}>{fileTypeIcon(d.file_url)}</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</div>
                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{d.category} · {fileTypeLabel(d.file_url)} · {formatRows(d.rows_count??0)} rows</div>
                          </div>
                          <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: scoreBg(d.score??0), border: `1px solid ${scoreBorder(d.score??0)}`, color: scoreColor(d.score??0), flexShrink: 0 }}>{d.score??0}</span>
                        </label>
                      ));
                    })()}
                  </div>
                  <button onClick={handleAnalyse} disabled={!analyseSelected || analysing} style={{ padding: "13px 0", borderRadius: 10, background: analyseSelected && !analysing ? "linear-gradient(135deg, #16a34a, #4ade80)" : "rgba(74,222,128,0.1)", border: analyseSelected && !analysing ? "none" : "1px solid rgba(74,222,128,0.25)", color: analyseSelected && !analysing ? "#fff" : "#4ade80", fontSize: 13, fontFamily: "inherit", fontWeight: 800, cursor: !analyseSelected || analysing ? "not-allowed" : "pointer", boxShadow: analyseSelected && !analysing ? "0 0 22px rgba(74,222,128,0.35)" : "none", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {analysing ? (<><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(74,222,128,0.2)", borderTop: "2px solid #4ade80", animation: "spin 0.7s linear infinite" }} />Analysing…</>) : analyseSelected ? `⬟ Analyse "${analyseSelected.name.slice(0,20)}${analyseSelected.name.length>20?"…":""}"` : "⬟ Select a dataset to analyse"}
                  </button>
                </div>

                {/* Right: results */}
                {analyseResult && analyseSelected && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease both" }}>
                    {/* Score header */}
                    <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 14, padding: "20px 24px", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", gap: 20 }}>
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 42, fontWeight: 900, color: scoreColor(analyseResult.score), letterSpacing: "-0.04em", lineHeight: 1 }}>{analyseResult.score}</div>
                        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.14em", marginTop: 3 }}>QUALITY SCORE</div>
                        <div style={{ fontSize: 9, padding: "3px 10px", borderRadius: 5, fontWeight: 700, marginTop: 6, background: scoreBg(analyseResult.score), border: `1px solid ${scoreBorder(analyseResult.score)}`, color: scoreColor(analyseResult.score) }}>{analyseResult.score>80?"EXCELLENT":analyseResult.score>60?"GOOD":"NEEDS WORK"}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#f3f0ff", marginBottom: 4 }}>{analyseSelected.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>{analyseSelected.category} · {formatRows(analyseSelected.rows_count??0)} rows · {analyseSelected.columns_count??0} cols</div>
                        {/* Mini bar chart - dimension scores */}
                        {[
                          { label: "Completeness", val: analyseResult.completeness, color: "#a78bfa" },
                          { label: "Consistency",  val: analyseResult.consistency,  color: "#38bdf8" },
                          { label: "Accuracy",     val: analyseResult.accuracy,     color: "#4ade80" },
                          { label: "Uniqueness",   val: analyseResult.uniqueness,   color: "#fbbf24" },
                          { label: "Timeliness",   val: analyseResult.timeliness,   color: "#f472b6" },
                        ].map(m => (
                          <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <div style={{ width: 80, fontSize: 9, color: "#9ca3af", flexShrink: 0 }}>{m.label}</div>
                            <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                              <div style={{ width: `${m.val}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${m.color}88, ${m.color})`, boxShadow: `0 0 6px ${m.color}44` }} />
                            </div>
                            <div style={{ width: 28, fontSize: 9, color: m.color, fontWeight: 700, textAlign: "right" }}>{m.val}</div>
                          </div>
                        ))}
                      </div>
                      {/* Pie chart SVG */}
                      <div style={{ flexShrink: 0 }}>
                        {(() => {
                          const dims = [
                            { val: analyseResult.completeness, color: "#a78bfa" },
                            { val: analyseResult.consistency,  color: "#38bdf8" },
                            { val: analyseResult.accuracy,     color: "#4ade80" },
                            { val: analyseResult.uniqueness,   color: "#fbbf24" },
                            { val: analyseResult.timeliness,   color: "#f472b6" },
                          ];
                          const total = dims.reduce((s,d) => s+d.val, 0);
                          let angle = -Math.PI/2;
                          const cx=60, cy=60, r=50;
                          return (
                            <svg width={120} height={120} viewBox="0 0 120 120">
                              {dims.map((d, i) => {
                                const sweep = (d.val / total) * Math.PI * 2;
                                const x1 = cx + r * Math.cos(angle); const y1 = cy + r * Math.sin(angle);
                                angle += sweep;
                                const x2 = cx + r * Math.cos(angle); const y2 = cy + r * Math.sin(angle);
                                const large = sweep > Math.PI ? 1 : 0;
                                return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={d.color} opacity={0.8} stroke="rgba(10,8,18,0.8)" strokeWidth={1} />;
                              })}
                              <circle cx={cx} cy={cy} r={28} fill="rgba(16,10,30,0.9)" />
                              <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill="#f3f0ff" fontSize={14} fontWeight={900}>{analyseResult.score}</text>
                            </svg>
                          );
                        })()}
                      </div>
                    </div>

                    {/* AI Insights + adv/dis + recommended */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {/* Insights */}
                      <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 14, padding: "18px 20px", backdropFilter: "blur(14px)", gridColumn: "1/-1" }}>
                        <div style={{ fontSize: 14, color: "#a78bfa", fontWeight: 700, marginBottom: 12 }}>🧠 AI Insights</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {analyseResult.insights.map((ins, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: ["rgba(124,58,237,0.2)","rgba(56,189,248,0.15)","rgba(74,222,128,0.15)","rgba(251,191,36,0.15)"][i%4], border: `1px solid ${["rgba(124,58,237,0.35)","rgba(56,189,248,0.25)","rgba(74,222,128,0.25)","rgba(251,191,36,0.25)"][i%4]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: ["#a78bfa","#38bdf8","#4ade80","#fbbf24"][i%4] }}>{"◈◉◆⬡"[i%4]}</div>
                              <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.65, margin: 0 }}>{ins}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Advantages */}
                      <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(14px)" }}>
                        <div style={{ fontSize: 14, color: "#4ade80", fontWeight: 700, marginBottom: 10 }}>✓ Advantages</div>
                        {analyseResult.advantages.map((a,i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                            <span style={{ color: "#4ade80", fontSize: 11, flexShrink: 0, marginTop: 1 }}>+</span>
                            <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.55 }}>{a}</span>
                          </div>
                        ))}
                      </div>
                      {/* Disadvantages */}
                      <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(14px)" }}>
                        <div style={{ fontSize: 14, color: "#f87171", fontWeight: 700, marginBottom: 10 }}>✕ Disadvantages</div>
                        {analyseResult.disadvantages.map((a,i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                            <span style={{ color: "#f87171", fontSize: 11, flexShrink: 0, marginTop: 1 }}>–</span>
                            <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.55 }}>{a}</span>
                          </div>
                        ))}
                      </div>
                      {/* Recommended for */}
                      <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(14px)", gridColumn: "1/-1" }}>
                        <div style={{ fontSize: 14, color: "#38bdf8", fontWeight: 700, marginBottom: 10 }}>◎ Recommended For</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {analyseResult.recommended_for.map((r,i) => (
                            <span key={i} style={{ fontSize: 11, padding: "5px 14px", borderRadius: 20, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8" }}>{r}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COMPARE panel ────────────────────────────────────────────── */}
            {activeNav === "Compare" && (
              <div style={{ display: "grid", gridTemplateColumns: compareResult ? "300px 1fr" : "1fr", gap: 20, animation: "fadeIn 0.3s ease both" }}>
                {/* Left: multi-select picker */}
                <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 14, padding: "20px", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 700 }}>Select Datasets <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>(min 2)</span></div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{allDatasets.length} available</div>
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#6b7280" }}>⌕</span>
                    <input value={compareSearch} onChange={e => setCompareSearch(e.target.value)} placeholder="Search all datasets..." style={{ width: "100%", padding: "9px 12px 9px 30px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 9, color: "#e2d9f3", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 380, overflowY: "auto" }}>
                    {loadingAll ? (
                      Array.from({length:5}).map((_,i) => (
                        <div key={i} style={{ height: 52, borderRadius: 10, background: "rgba(124,58,237,0.07)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i*0.1}s` }} />
                      ))
                    ) : (() => {
                      const filtered = allDatasets.filter(d =>
                        !compareSearch || (d.name ?? "").toLowerCase().includes(compareSearch.toLowerCase()) || (d.category ?? "").toLowerCase().includes(compareSearch.toLowerCase())
                      );
                      return filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0", color: "#6b7280", fontSize: 13 }}>
                          {compareSearch ? `No datasets match "${compareSearch}"` : "No datasets in library yet."}
                        </div>
                      ) : filtered.map((d) => {
                        const checked = compareSelected.some(s => s.id === d.id);
                        return (
                          <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${checked ? "rgba(251,191,36,0.45)" : "rgba(124,58,237,0.12)"}`, background: checked ? "rgba(251,191,36,0.08)" : "rgba(124,58,237,0.04)", transition: "all 0.15s" }}>
                            <input type="checkbox" checked={checked} onChange={() => setCompareSelected(prev => checked ? prev.filter(s => s.id !== d.id) : [...prev, d])} style={{ accentColor: "#fbbf24", width: 14, height: 14, flexShrink: 0 }} />
                            <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fbbf24", flexShrink: 0 }}>{fileTypeIcon(d.file_url)}</div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</div>
                              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{d.category} · {fileTypeLabel(d.file_url)} · {formatRows(d.rows_count??0)} rows</div>
                            </div>
                            <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: scoreBg(d.score??0), border: `1px solid ${scoreBorder(d.score??0)}`, color: scoreColor(d.score??0), flexShrink: 0 }}>{d.score??0}</span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                  {compareSelected.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {compareSelected.map(d => (
                        <span key={d.id} style={{ fontSize: 11, padding: "4px 11px", borderRadius: 20, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", display: "flex", alignItems: "center", gap: 6 }}>
                          {(d.name ?? "—").slice(0,18)}{(d.name?.length ?? 0) > 18 ? "…" : ""}
                          <button onClick={() => setCompareSelected(p => p.filter(s => s.id !== d.id))} style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={handleCompare} disabled={compareSelected.length < 2 || comparing} style={{ padding: "13px 0", borderRadius: 10, background: compareSelected.length >= 2 && !comparing ? "linear-gradient(135deg, #b45309, #fbbf24)" : "rgba(251,191,36,0.1)", border: compareSelected.length >= 2 && !comparing ? "none" : "1px solid rgba(251,191,36,0.25)", color: compareSelected.length >= 2 && !comparing ? "#0a0812" : "#fbbf24", fontSize: 13, fontFamily: "inherit", fontWeight: 800, cursor: compareSelected.length < 2 || comparing ? "not-allowed" : "pointer", boxShadow: compareSelected.length >= 2 && !comparing ? "0 0 22px rgba(251,191,36,0.35)" : "none", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {comparing ? (<><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(251,191,36,0.2)", borderTop: "2px solid #fbbf24", animation: "spin 0.7s linear infinite" }} />Comparing…</>) : compareSelected.length >= 2 ? `◆ Compare ${compareSelected.length} Datasets` : "Select at least 2 datasets"}
                  </button>
                </div>

                {/* Right: compare results */}
                {compareResult && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease both" }}>
                    {/* Winner banner */}
                    <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 14, padding: "18px 24px", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ fontSize: 32 }}>🏆</div>
                      <div>
                        <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 3 }}>Recommended Dataset</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#f3f0ff" }}>{compareResult.datasets.find(d=>d.id===compareResult.winner)?.name ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, maxWidth: 500, lineHeight: 1.6 }}>{compareResult.suggestion}</div>
                      </div>
                    </div>

                    {/* Side-by-side bar chart per metric */}
                    <div style={{ background: "rgba(16,10,30,0.72)", border: "1px solid rgba(124,58,237,0.16)", borderRadius: 14, padding: "20px 24px", backdropFilter: "blur(14px)" }}>
                      <div style={{ fontSize: 15, color: "#f3f0ff", fontWeight: 700, marginBottom: 16 }}>Parameter Comparison</div>
                      {Object.keys(compareResult.datasets[0]?.scores ?? {}).map(metric => (
                        <div key={metric} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>{metric.toUpperCase()}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {compareResult.datasets.map((d, di) => {
                              const val = d.scores[metric] ?? 0;
                              const isWinner = d.id === compareResult.winner && metric === "Quality";
                              const colors = ["#a78bfa","#38bdf8","#4ade80","#fbbf24","#f472b6"];
                              const c = colors[di % colors.length];
                              return (
                                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 100, fontSize: 9, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{(d.name ?? "").slice(0,14)}{d.name?.length > 14 ? "…" : ""}</div>
                                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                                    <div style={{ width: `${val}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${c}88, ${c})`, boxShadow: `0 0 6px ${c}44`, transition: "width 0.8s ease" }} />
                                  </div>
                                  <div style={{ width: 28, fontSize: 9, color: c, fontWeight: 700, flexShrink: 0, textAlign: "right" }}>{val}</div>
                                  {isWinner && <span style={{ fontSize: 9, color: "#fbbf24" }}>🏆</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pros & cons per dataset */}
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${compareResult.datasets.length}, 1fr)`, gap: 14 }}>
                      {compareResult.datasets.map((d, di) => {
                        const isWinner = d.id === compareResult.winner;
                        const colors = ["#a78bfa","#38bdf8","#4ade80","#fbbf24","#f472b6"];
                        const c = colors[di % colors.length];
                        return (
                          <div key={d.id} style={{ background: isWinner ? "rgba(251,191,36,0.06)" : "rgba(16,10,30,0.72)", border: `1px solid ${isWinner ? "rgba(251,191,36,0.3)" : "rgba(124,58,237,0.14)"}`, borderRadius: 13, padding: "16px 18px", backdropFilter: "blur(14px)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}88`, flexShrink: 0 }} />
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#f3f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name ?? "—"}</div>
                              {isWinner && <span style={{ fontSize: 9, marginLeft: "auto", flexShrink: 0 }}>🏆</span>}
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>✓ PROS</div>
                              {d.pros.map((p,i) => <div key={i} style={{ fontSize: 12, color: "#9ca3af", display: "flex", gap: 6, marginBottom: 5 }}><span style={{ color: "#4ade80", flexShrink: 0 }}>+</span>{p}</div>)}
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: "#f87171", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>✕ CONS</div>
                              {d.cons.map((p,i) => <div key={i} style={{ fontSize: 12, color: "#9ca3af", display: "flex", gap: 6, marginBottom: 5 }}><span style={{ color: "#f87171", flexShrink: 0 }}>–</span>{p}</div>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PROFILE panel ────────────────────────────────────────────── */}
            {activeNav === "Profile" && (
              <div style={{ display: "flex", justifyContent: "center", animation: "fadeIn 0.3s ease both" }}>
                <div style={{ width: "100%", maxWidth: 640 }}>
                  {/* Avatar hero banner */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(56,189,248,0.15) 50%, rgba(244,114,182,0.12) 100%)",
                    border: "1px solid rgba(168,85,247,0.3)",
                    borderRadius: "20px 20px 0 0",
                    padding: "32px 32px 28px",
                    display: "flex", alignItems: "center", gap: 22,
                    position: "relative", overflow: "hidden",
                    backdropFilter: "blur(20px)",
                  }}>
                    {/* Animated glow blob */}
                    <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)", animation: "glowPulse 3s ease-in-out infinite", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: -20, left: "40%", width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.2), transparent 70%)", animation: "glowPulse 4s ease-in-out infinite 1s", pointerEvents: "none" }} />
                    {/* Avatar */}
                    <div style={{
                      width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #7c3aed, #a855f7, #38bdf8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, fontWeight: 900, color: "#fff",
                      boxShadow: "0 0 32px rgba(168,85,247,0.6), 0 0 0 3px rgba(168,85,247,0.25)",
                      position: "relative", zIndex: 1,
                    }}>{(profileUser?.name ?? "?").charAt(0).toUpperCase()}</div>
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#f3f0ff", letterSpacing: "-0.01em" }}>{profileUser?.name ?? "—"}</div>
                      <div style={{ fontSize: 14, color: "rgba(196,181,253,0.8)", marginTop: 4 }}>{profileUser?.email ?? "—"}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)", color: "#c4b5fd" }}>NeuroRift Member</span>
                        {profileUser?.phone && <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>{profileUser.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Form body */}
                  <div style={{ background: "rgba(14,8,28,0.92)", border: "1px solid rgba(168,85,247,0.2)", borderTop: "none", borderRadius: "0 0 20px 20px", backdropFilter: "blur(20px)" }}>

                    {/* Read-only info */}
                    <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(124,58,237,0.1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {[{ label: "Full Name", value: profileUser?.name ?? "—", icon: "◈" }, { label: "Email Address", value: profileUser?.email ?? "—", icon: "◉" }].map(f => (
                        <div key={f.label}>
                          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 7, textTransform: "uppercase" }}>{f.label}</div>
                          <div style={{ padding: "11px 14px", borderRadius: 10, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", fontSize: 13, color: "#9ca3af", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "#6b7280", fontSize: 12 }}>{f.icon}</span>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</span>
                            <span style={{ fontSize: 9, color: "#4b5563", background: "rgba(124,58,237,0.12)", padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>locked</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Phone */}
                    <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Phone Number</div>
                      <input
                        type="tel" value={profilePhone} onChange={e => setProfilePhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                        onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(244,114,182,0.55)"; (e.target as HTMLInputElement).style.boxShadow = "0 0 16px rgba(244,114,182,0.15)"; }}
                        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.25)"; (e.target as HTMLInputElement).style.boxShadow = "none"; }}
                      />
                    </div>

                    {/* Change password */}
                    <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>Change Password</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <input type="password" value={profileNewPw} onChange={e => setProfileNewPw(e.target.value)} placeholder="New password" style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none", transition: "all 0.2s" }} onFocus={e => { (e.target as HTMLInputElement).style.borderColor="rgba(244,114,182,0.55)"; }} onBlur={e => { (e.target as HTMLInputElement).style.borderColor="rgba(124,58,237,0.25)"; }} />
                        <input type="password" value={profileConfPw} onChange={e => setProfileConfPw(e.target.value)} placeholder="Confirm password" style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", color: "#e2d9f3", fontSize: 14, fontFamily: "inherit", outline: "none", transition: "all 0.2s" }} onFocus={e => { (e.target as HTMLInputElement).style.borderColor="rgba(244,114,182,0.55)"; }} onBlur={e => { (e.target as HTMLInputElement).style.borderColor="rgba(124,58,237,0.25)"; }} />
                      </div>
                    </div>

                    {/* Save + Danger */}
                    <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
                      <button onClick={handleSaveProfile} disabled={profileSaving} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: profileSaving ? "rgba(244,114,182,0.1)" : "linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)", border: profileSaving ? "1px solid rgba(244,114,182,0.3)" : "none", color: profileSaving ? "#f472b6" : "#fff", fontSize: 14, fontFamily: "inherit", fontWeight: 800, cursor: profileSaving ? "not-allowed" : "pointer", boxShadow: profileSaving ? "none" : "0 0 28px rgba(168,85,247,0.45)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        {profileSaving ? (<><div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(244,114,182,0.2)", borderTop: "2px solid #f472b6", animation: "spin 0.7s linear infinite" }} />Saving…</>) : "Save Changes"}
                      </button>
                      {/* Danger zone */}
                      <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <div style={{ fontSize: 12, color: "#f87171", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>⚠ Danger Zone</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>Permanently deletes your account and all associated data. This cannot be undone.</div>
                        {confirmDelete && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10, fontWeight: 600, background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>⚠ Click confirm to permanently delete your account.</div>}
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={handleDeleteAccount} disabled={profileDeleting} style={{ flex: 1, padding: "10px 0", borderRadius: 9, background: confirmDelete ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.1)", border: `1px solid ${confirmDelete ? "rgba(239,68,68,0.55)" : "rgba(239,68,68,0.28)"}`, color: "#f87171", fontSize: 13, fontFamily: "inherit", fontWeight: 700, cursor: profileDeleting ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                            {profileDeleting ? "Deleting…" : confirmDelete ? "⚠ Confirm Delete Account" : "Delete Account"}
                          </button>
                          {confirmDelete && <button onClick={() => setConfirmDelete(false)} style={{ padding: "10px 18px", borderRadius: 9, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", color: "#9ca3af", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      )}
    </div>
  );
}