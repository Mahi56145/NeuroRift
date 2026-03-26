"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  UploadCloud, BarChart3, Layers, LogOut, Database, Flame,
  Trophy, Zap, Star, Activity, ExternalLink, Calendar,
  ChevronRight, Download, Eye, X, Edit, Trash2, Save
} from "lucide-react";

interface Dataset {
  id: string; name: string; category: string | null;
  rows_count: number | null; columns_count: number | null;
  score: number | null; size: string | null; created_at: string;
  created_by: string | null; file_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
function getXPLevel(uploads: number, analyses: number) {
  const xp = uploads * 100 + analyses * 50;
  if (xp >= 1000) return { level: Math.floor(xp / 1000) + 5, title: "Neural Architect", xp, next: Math.ceil(xp / 1000) * 1000 };
  if (xp >= 500) return { level: 4, title: "Data Wrangler", xp, next: 1000 };
  if (xp >= 200) return { level: 3, title: "Dataset Explorer", xp, next: 500 };
  if (xp >= 50) return { level: 2, title: "Data Apprentice", xp, next: 200 };
  return { level: 1, title: "Newcomer", xp, next: 50 };
}
function getStreak() {
  const today = new Date().toDateString();
  const streakData = JSON.parse(localStorage.getItem("nr_streak") || '{"count":0,"last":""}');
  const last = streakData.last;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (last === today) return streakData.count;
  if (last === yesterday) {
    const newCount = streakData.count + 1;
    localStorage.setItem("nr_streak", JSON.stringify({ count: newCount, last: today }));
    return newCount;
  }
  localStorage.setItem("nr_streak", JSON.stringify({ count: 1, last: today }));
  return 1;
}
function getAnalysesCount() { return parseInt(localStorage.getItem("nr_analyses") || "0"); }
function incrementAnalyses() { localStorage.setItem("nr_analyses", String(getAnalysesCount() + 1)); }

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#fbbf24" : "#f87171";
  const r = 13, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
      <circle cx="17" cy="17" r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <text x="17" y="21" textAnchor="middle" fontSize="7.5" fontWeight="900" fill={color}>{score}</text>
    </svg>
  );
}

// ─── Floating 3D Action Button ────────────────────────────────────────────────
function Float3DButton({ btn, index }: { btn: { id: string; label: string; icon: React.ElementType; color: string; glow: string; path: string; desc: string }; index: number }) {
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const Icon = btn.icon;

  const handleMouse = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * 20, y: x * -20 });
  };

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4 + index * 0.12, type: "spring", stiffness: 200, damping: 18 }}
      onClick={() => router.push(btn.path)}
      onMouseMove={handleMouse}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      style={{
        border: "none", background: "none", padding: 0, cursor: "pointer",
        perspective: "800px", flex: 1,
      }}
    >
      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y, translateZ: hovered ? 12 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          background: hovered
            ? `linear-gradient(135deg,rgba(8,4,18,0.95),${btn.color}18)`
            : "rgba(8,4,18,0.88)",
          border: `1.5px solid ${hovered ? btn.color + "55" : "rgba(124,58,237,0.12)"}`,
          borderRadius: 24, padding: "32px 28px",
          backdropFilter: "blur(20px)",
          position: "relative", overflow: "hidden",
          boxShadow: hovered ? `0 20px 60px ${btn.color}20, 0 0 0 1px ${btn.color}22, inset 0 1px 0 ${btn.color}18` : "0 4px 20px rgba(0,0,0,0.4)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Gradient stripe top */}
        <motion.div animate={{ opacity: hovered ? 1 : 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${btn.color},transparent)` }} />
        {/* Corner glow */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle,${btn.color}${hovered ? "18" : "08"},transparent 70%)`, transition: "all 0.3s" }} />

        {/* Icon with float */}
        <motion.div
          animate={{ y: hovered ? -4 : 0 }}
          transition={{ type: "spring", stiffness: 400 }}
          style={{ width: 56, height: 56, borderRadius: 18, background: `${btn.color}12`, border: `1.5px solid ${btn.color}${hovered ? "50" : "22"}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, color: btn.color, boxShadow: hovered ? `0 0 24px ${btn.glow}` : "none", transition: "border-color 0.25s, box-shadow 0.25s" }}
        >
          <Icon size={26} />
        </motion.div>

        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, color: hovered ? "#fff" : "#e2d9f3", transition: "color 0.2s" }}>{btn.label}</h3>
        <p style={{ margin: "0 0 22px", color: "#6b7280", fontSize: 11, lineHeight: 1.7 }}>{btn.desc}</p>

        <motion.div
          animate={{ x: hovered ? 4 : 0 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: btn.color, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}
        >
          Launch <ChevronRight size={13} />
        </motion.div>
      </motion.div>
    </motion.button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string; id: string; mobile?: string } | null>(null);
  const [tab, setTab] = useState<"uploaded" | "recent">("uploaded");
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [analysesCount, setAnalysesCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [xpInfo, setXpInfo] = useState<ReturnType<typeof getXPLevel> | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const ptRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; color: string }[]>([]);

  useEffect(() => {
    setMounted(true);
    const s = getStreak(), a = getAnalysesCount();
    setStreak(s); setAnalysesCount(a);

    // Calculate and preserve longest streak
    const maxS = parseInt(localStorage.getItem("nr_max_streak") || "0");
    const updatedMax = Math.max(s, maxS);
    setLongestStreak(updatedMax);
    if (updatedMax > maxS) {
      localStorage.setItem("nr_max_streak", updatedMax.toString());
    }

    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) { router.push("/auth"); return; }
      const meta = u.user_metadata || {};
      const name = meta.full_name || meta.name || u.email?.split("@")[0] || "User";
      const mobile = meta.mobile || "";
      setUser({ name, email: u.email ?? "", id: u.id, mobile });
      setEditName(name);
      setEditMobile(mobile);

      // --- Cloud Sync: Analyses ---
      const cloudAnalyses = parseInt(meta.nr_analyses || "0");
      const trueAnalyses = Math.max(cloudAnalyses, a);
      if (trueAnalyses > a) {
        localStorage.setItem("nr_analyses", String(trueAnalyses));
        setAnalysesCount(trueAnalyses);
      }
      if (trueAnalyses > cloudAnalyses) {
        supabase.auth.updateUser({ data: { nr_analyses: trueAnalyses } });
      }

      // --- Cloud Sync: Max Streak ---
      const cloudMaxStreak = parseInt(meta.nr_max_streak || "0");
      const trueMaxStreak = Math.max(cloudMaxStreak, updatedMax);
      if (trueMaxStreak > updatedMax) {
        localStorage.setItem("nr_max_streak", String(trueMaxStreak));
        setLongestStreak(trueMaxStreak);
      }
      if (trueMaxStreak > cloudMaxStreak) {
        supabase.auth.updateUser({ data: { nr_max_streak: trueMaxStreak } });
      }
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("datasets").select("*").order("created_at", { ascending: false });
      if (data) setDatasets(data as Dataset[]);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uploads = datasets.filter((d) => d.created_by === user.id).length;
    setXpInfo(getXPLevel(uploads, analysesCount));
  }, [datasets, user, analysesCount]);

  // Canvas
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    ptRef.current = Array.from({ length: 50 }, () => ({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, size: Math.random() * 1.8 + 0.4, color: ["#7c3aed", "#38bdf8", "#a855f7", "#4ade80"][Math.floor(Math.random() * 4)] }));
    const draw = () => {
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ptRef.current.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > canvas.width) p.vx *= -1; if (p.y < 0 || p.y > canvas.height) p.vy *= -1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color + "88"; ctx.fill(); });
      for (let i = 0; i < ptRef.current.length; i++) for (let j = i + 1; j < ptRef.current.length; j++) { const dx = ptRef.current[i].x - ptRef.current[j].x, dy = ptRef.current[i].y - ptRef.current[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < 110) { ctx.strokeStyle = `rgba(124,58,237,${(1 - d / 110) * 0.1})`; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(ptRef.current[i].x, ptRef.current[i].y); ctx.lineTo(ptRef.current[j].x, ptRef.current[j].y); ctx.stroke(); } }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, [mounted]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/auth"); };

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !user) return;
    if (newPassword && newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    setIsUpdating(true);
    const updates: any = { data: { full_name: editName, mobile: editMobile } };
    if (newPassword) updates.password = newPassword;

    const { error } = await supabase.auth.updateUser(updates);
    if (!error) {
      setUser({ ...user, name: editName, mobile: editMobile });
      setShowProfileModal(false);
      setNewPassword("");
      setConfirmPassword("");
    } else {
      alert(error.message);
    }
    setIsUpdating(false);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure? This action is irreversible and will delete your account forever.")) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      if (res.ok) {
        await supabase.auth.signOut();
        router.push("/auth");
      } else {
        alert("Failed to delete account. Ensure backend route is ready.");
      }
    } catch {
      alert("Error initiating account deletion.");
    }
    setIsUpdating(false);
  };

  // Data subsets
  const userUploads = datasets.filter((d) => d.created_by === user?.id);
  const recentIds: string[] = mounted ? JSON.parse(localStorage.getItem("recent_datasets") || "[]") : [];
  const recentDatasets = recentIds.map((id) => datasets.find((d) => d.id === id)).filter(Boolean) as Dataset[];
  const displayDatasets = tab === "uploaded" ? userUploads : recentDatasets;

  const navBtns = [
    { id: "upload", label: "Contribute Engine", icon: UploadCloud, color: "#38bdf8", glow: "rgba(56,189,248,0.5)", path: "/dashboard/upload", desc: "Contribute raw data into the neural vault with AI-powered metadata generation." },
    { id: "analyse", label: "Deep Analyse", icon: BarChart3, color: "#4ade80", glow: "rgba(74,222,128,0.5)", path: "/dashboard/analyse", desc: "Groq AI dissects every dataset dimension with detailed intelligence reports." },
    { id: "compare", label: "Cross Compare", icon: Layers, color: "#fbbf24", glow: "rgba(251,191,36,0.5)", path: "/dashboard/compare", desc: "Head-to-head battle arena to benchmark quality, features, and use cases." },
  ];

  const uploads = userUploads.length;
  const avgScore = datasets.length ? Math.round(datasets.reduce((s, d) => s + (d.score ?? 0), 0) / datasets.length) : 0;

  return (
    <div style={{ backgroundColor: "#05020c", color: "#e2d9f3", minHeight: "100vh", overflowX: "hidden", fontFamily: "'IBM Plex Mono','Fira Code',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700;900&display=swap');
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes spinR { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulseGlow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes xpFill { from{width:0} }
        @keyframes streakFlame { 0%,100%{transform:scale(1) rotate(-5deg)} 50%{transform:scale(1.2) rotate(5deg)} }
        @keyframes shimmer { 0%{left:-100%} 100%{left:200%} }
        .shimmer-card { position:relative; overflow:hidden; }
        .shimmer-card::after { content:''; position:absolute; top:0; left:-100%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent); animation:shimmer 3s ease infinite; pointer-events:none; }
        .ds-card { transition: transform 0.22s ease, box-shadow 0.22s ease !important; }
        .ds-card:hover { transform:translateY(-4px) !important; box-shadow:0 12px 40px rgba(124,58,237,0.2) !important; }
        .tab-btn { transition: all 0.2s; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:rgba(124,58,237,0.3); border-radius:4px; }
      `}</style>

      {mounted && <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "3%", left: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.11),transparent 70%)", filter: "blur(60px)", animation: "floatY 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "8%", right: "3%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.07),transparent 70%)", filter: "blur(55px)", animation: "floatY 9s ease-in-out 3s infinite" }} />
      </div>

      {/* NAVBAR */}
      <motion.header initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7 }}
        style={{ position: "fixed", top: 0, width: "100%", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 68, background: "rgba(5,2,12,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(124,58,237,0.13)", boxSizing: "border-box" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 38, height: 38 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid #7c3aed", animation: "spinR 8s linear infinite" }} />
            <div style={{ position: "absolute", inset: 5, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", boxShadow: "0 0 18px rgba(124,58,237,0.55)" }}>NR</div>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.14em" }}><span style={{ color: "#fff" }}>NEURO</span><span style={{ color: "#38bdf8" }}>RIFT</span></div>
          </div>
        </div>

        {/* User + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 6px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 50 }}>
              <div
                onClick={() => { setEditName(user.name); setShowProfileModal(true); }}
                title="Edit Profile"
                style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", boxShadow: "0 0 12px rgba(124,58,237,0.5)", cursor: "pointer", transition: "transform 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span onClick={() => { setEditName(user.name); setShowProfileModal(true); }} style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 700, cursor: "pointer" }}>{user.name.split(" ")[0]}</span>
              {xpInfo && <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 20, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", fontWeight: 700 }}>LVL {xpInfo.level}</span>}
            </motion.div>
          )}
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 50, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em" }}>
            <LogOut size={11} /> Logout
          </motion.button>
        </div>
      </motion.header>

      {/* Floating Explore Button (Below Profile) */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        onClick={() => router.push("/datasets")}
        style={{
          position: "fixed", top: 86, right: 40, zIndex: 90,
          padding: "10px 24px", borderRadius: 50, border: "none",
          background: "linear-gradient(135deg, #38bdf8, #7c3aed)",
          color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 0 24px rgba(56,189,248,0.45)", transition: "all 0.2s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <Database size={14} /> EXPLORE DATABASES
      </motion.button>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1300, margin: "0 auto", padding: "96px 40px 80px" }}>

        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: "clamp(32px,4.5vw,58px)", fontWeight: 900, margin: "0 0 10px", background: "linear-gradient(135deg,#fff 0%,#a78bfa 40%,#38bdf8 80%)", backgroundSize: "200%", animation: "gradShift 5s ease infinite", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {user ? `Welcome back,\n${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p style={{ color: "#6b7280", fontSize: 12, letterSpacing: "0.04em" }}>Your AI-powered dataset intelligence platform · NeuroRift 2026</p>
        </motion.div>

        {/* USER STATS + STREAK ROW */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.4fr", gap: 14, marginBottom: 44 }}>
          {/* Streak */}
          <div className="shimmer-card" style={{ background: "rgba(8,4,18,0.85)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(251,191,36,0.5),transparent)" }} />
            <div>
              <Flame size={18} color="#fbbf24" style={{ marginBottom: 12, animation: "streakFlame 1.5s ease-in-out infinite" }} />
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 0 20px rgba(251,191,36,0.5)" }}>{streak}</div>
              <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6, letterSpacing: "0.14em" }}>CURRENT STREAK</div>
            </div>
            <div style={{ fontSize: 9, color: "#fbbf24", opacity: 0.8, letterSpacing: "0.08em", fontWeight: 700, marginTop: "auto", paddingTop: 8 }}>LONGEST: {longestStreak} DAYS</div>
          </div>
          {/* Contributions */}
          <div className="shimmer-card" style={{ background: "rgba(8,4,18,0.85)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.5),transparent)" }} />
            <UploadCloud size={18} color="#38bdf8" style={{ marginBottom: 12, filter: "drop-shadow(0 0 6px #38bdf8)" }} />
            <div style={{ fontSize: 28, fontWeight: 900, color: "#38bdf8", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 0 20px rgba(56,189,248,0.5)" }}>{loading ? "—" : uploads}</div>
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6, letterSpacing: "0.14em" }}>CONTRIBUTIONS</div>
          </div>
          {/* Analyses */}
          <div className="shimmer-card" style={{ background: "rgba(8,4,18,0.85)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)" }} />
            <Activity size={18} color="#4ade80" style={{ marginBottom: 12, filter: "drop-shadow(0 0 6px #4ade80)" }} />
            <div style={{ fontSize: 28, fontWeight: 900, color: "#4ade80", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 0 20px rgba(74,222,128,0.5)" }}>{analysesCount}</div>
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6, letterSpacing: "0.14em" }}>ANALYSES RUN</div>
          </div>
          {/* Avg Score */}
          <div className="shimmer-card" style={{ background: "rgba(8,4,18,0.85)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)" }} />
            <Star size={18} color="#a78bfa" style={{ marginBottom: 12, filter: "drop-shadow(0 0 6px #a78bfa)" }} />
            <div style={{ fontSize: 28, fontWeight: 900, color: "#a78bfa", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 0 20px rgba(167,139,250,0.5)" }}>{loading ? "—" : avgScore}</div>
            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6, letterSpacing: "0.14em" }}>AVG SCORE</div>
          </div>
          {/* XP Bar */}
          {xpInfo && (
            <div className="shimmer-card" style={{ background: "rgba(8,4,18,0.85)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(251,191,36,0.4),transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={16} color="#fbbf24" />
                  <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, letterSpacing: "0.08em" }}>LEVEL {xpInfo.level}</span>
                </div>
                <span style={{ fontSize: 9, color: "#6b7280" }}>{xpInfo.xp} / {xpInfo.next} XP</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f0ff", marginBottom: 12 }}>{xpInfo.title}</div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (xpInfo.xp / xpInfo.next) * 100)}%` }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.6 }}
                  style={{ height: "100%", borderRadius: 6, background: "linear-gradient(90deg,#7c3aed,#fbbf24)", boxShadow: "0 0 10px rgba(251,191,36,0.5)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 8, color: "#4b5563" }}>
                <span>{uploads * 100}XP (contributions)</span><span>{analysesCount * 50}XP (analyses)</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* FLOATING 3D ACTION BUTTONS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", gap: 18 }}>
            {navBtns.map((btn, i) => <Float3DButton key={btn.id} btn={btn} index={i} />)}
          </div>
        </motion.div>

        {/* YOUR DATASETS + TOGGLE */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#7c3aed", boxShadow: "0 0 10px #7c3aed" }} />
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>Recent History</h2>
            </div>

            {/* Toggle */}
            <div style={{ display: "flex", background: "rgba(8,4,18,0.8)", borderRadius: 50, padding: 4, border: "1px solid rgba(124,58,237,0.15)" }}>
              {(["uploaded", "recent"] as const).map((t) => (
                <button key={t} className="tab-btn" onClick={() => setTab(t)}
                  style={{ padding: "7px 20px", borderRadius: 50, background: tab === t ? "rgba(124,58,237,0.22)" : "transparent", border: tab === t ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent", color: tab === t ? "#a78bfa" : "#6b7280", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
                  {t === "uploaded" ? <><UploadCloud size={11} /> CONTRIBUTED</> : <><Eye size={11} /> RECENTLY VIEWED</>}
                </button>
              ))}
            </div>

            <button onClick={() => router.push("/datasets")}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 50, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)", color: "#a78bfa", fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
              Explore All <ChevronRight size={11} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 160, borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(124,58,237,0.07)", animation: "pulseGlow 1.5s ease-in-out infinite" }} />)}
            </div>
          ) : displayDatasets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563", borderRadius: 20, border: "1px dashed rgba(124,58,237,0.12)", background: "rgba(8,4,18,0.5)" }}>
              <Database size={40} style={{ margin: "0 auto 14px", opacity: 0.2 }} />
              <p style={{ fontSize: 13, marginBottom: 16 }}>
                {tab === "uploaded" ? "You haven't uploaded any datasets yet" : "No recently viewed datasets"}
              </p>
              {tab === "uploaded" && (
                <button onClick={() => router.push("/dashboard/upload")}
                  style={{ padding: "10px 24px", borderRadius: 50, background: "linear-gradient(135deg,#7c3aed,#38bdf8)", border: "none", color: "#fff", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
                  Upload Your First Dataset →
                </button>
              )}
              {tab === "recent" && (
                <button onClick={() => router.push("/datasets")}
                  style={{ padding: "10px 24px", borderRadius: 50, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa", fontSize: 11, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
                  Browse Datasets →
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
              {displayDatasets.slice(0, 8).map((ds, i) => {
                const cc = getCatColor(ds.category);
                return (
                  <motion.div key={ds.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="ds-card" style={{ background: "rgba(8,4,18,0.88)", border: "1px solid rgba(124,58,237,0.1)", borderRadius: 18, padding: "20px", backdropFilter: "blur(14px)", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${cc}55,transparent)` }} />
                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                          <div style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 20, background: cc + "14", border: `1px solid ${cc}28`, color: cc, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>{ds.category ?? "Unknown"}</div>
                          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f3f0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.name}</h3>
                        </div>
                        {ds.score != null && <ScoreRing score={ds.score} />}
                      </div>
                      {/* Metrics */}
                      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                        {[["Rows", ds.rows_count?.toLocaleString() ?? "—", "#38bdf8"], ["Cols", ds.columns_count ?? "—", "#a78bfa"], ["Size", ds.size ?? "—", "#4ade80"]].map(([l, v, c]) => (
                          <div key={String(l)}><div style={{ fontSize: 12, fontWeight: 800, color: String(c) }}>{v}</div><div style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.1em" }}>{l}</div></div>
                        ))}
                      </div>
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={async () => {
                          incrementAnalyses();
                          const next = analysesCount + 1;
                          setAnalysesCount(next);
                          supabase.auth.updateUser({ data: { nr_analyses: next } });
                          router.push(`/dashboard/analyse?id=${ds.id}`);
                        }}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 10, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", color: "#4ade80", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <BarChart3 size={9} /> Analyse
                        </button>
                        <button onClick={() => router.push(`/dashboard/compare?a=${ds.id}`)}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)", color: "#fbbf24", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <Layers size={9} /> Compare
                        </button>
                        {ds.file_url && (
                          <button onClick={() => window.open(ds.file_url!, "_blank")}
                            style={{ padding: "7px 12px", borderRadius: 10, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: 9, fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
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
        </motion.div>

        {/* Calendar streak visual */}
        {streak > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            style={{ marginTop: 48, background: "rgba(8,4,18,0.85)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: 20, padding: "24px 28px", backdropFilter: "blur(14px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Calendar size={14} color="#fbbf24" />
              <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.18em", fontWeight: 700 }}>ACTIVITY HISTORY — PAST 3 MONTHS</span>
              <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#fbbf24" }}>🔥 Keep it going!</span>
            </div>
            <div style={{ overflowX: "auto", paddingBottom: 16, scrollbarWidth: "thin" }}>
              <div style={{ display: "flex", gap: 10, width: "fit-content", padding: "4px 8px" }}>
                {Array.from({ length: 91 }).map((_, i) => {
                  const daysAgo = i; // 0 is today, 90 is three months ago
                  const d = new Date();
                  d.setDate(d.getDate() - daysAgo);
                  const isActive = daysAgo < streak;
                  const dayNum = d.getDate();
                  const monthStr = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
                  const yearStr = d.getFullYear();

                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.015 }}
                      style={{
                        flexShrink: 0, width: 54, height: 72, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        background: isActive ? "rgba(251,191,36,0.12)" : "rgba(8,4,18,0.5)",
                        border: `1px solid ${isActive ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.06)"}`,
                        boxShadow: isActive && daysAgo === 0 ? "0 0 20px rgba(251,191,36,0.2) inset, 0 0 10px rgba(251,191,36,0.4)" : "none",
                      }}>
                      <div style={{ fontSize: 9, color: isActive ? "#fbbf24" : "#6b7280", fontWeight: 800, letterSpacing: "0.08em" }}>{monthStr}</div>
                      <div style={{ fontSize: 22, color: isActive ? "#fff" : "#9ca3af", fontWeight: 900, margin: "2px 0" }}>{dayNum}</div>
                      <div style={{ fontSize: 8, color: isActive ? "rgba(251,191,36,0.7)" : "#4b5563", letterSpacing: "0.1em" }}>{yearStr}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* PROFILE EDIT UI (MODAL) */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{ width: "100%", maxWidth: 360, background: "rgba(10,5,24,0.95)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 24, padding: "28px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", boxShadow: "0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)" }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#7c3aed,transparent)" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Edit Profile</h2>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Manage your NeuroRift account</div>
                  </div>
                </div>
                <button onClick={() => setShowProfileModal(false)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#9ca3af", width: 32, height: 32, borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)")}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 26, maxHeight: "55vh", overflowY: "auto", paddingRight: 6 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ca3af", marginBottom: 6, letterSpacing: "0.05em" }}>ACCOUNT EMAIL</label>
                  <input type="text" value={user?.email || ""} disabled style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "#6b7280", fontFamily: "inherit", fontSize: 13, cursor: "not-allowed" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 6, letterSpacing: "0.05em" }}>DISPLAY NAME</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)")} onBlur={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.2)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 6, letterSpacing: "0.05em" }}>MOBILE (OPTIONAL)</label>
                  <input type="tel" autoComplete="off" placeholder="Mobile number" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.6)")} onBlur={(e) => (e.target.style.borderColor = "rgba(124,58,237,0.2)")} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#38bdf8", marginBottom: 6, letterSpacing: "0.05em" }}>NEW PASSWORD (OPTIONAL)</label>
                  <input type="password" autoComplete="new-password" placeholder="Leave blank to keep current" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.6)")} onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")} />
                </div>
                {newPassword && (
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#38bdf8", marginBottom: 6, letterSpacing: "0.05em" }}>CONFIRM NEW PASSWORD</label>
                    <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.2s" }} onFocus={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.6)")} onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: isUpdating ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isUpdating ? 0.7 : 1 }}
                >
                  <Save size={14} /> {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(239,68,68,0.15)" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#ef4444" }}>Danger Zone</h3>
                <p style={{ margin: "0 0 16px", fontSize: 11, color: "#fca5a5", opacity: 0.8, lineHeight: 1.5 }}>Deleting your account is permanent. All associated datasets and metadata will be permanently lost.</p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isUpdating}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: isUpdating ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                >
                  <Trash2 size={14} /> Delete Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}