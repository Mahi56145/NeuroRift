"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Node {
  x: number; y: number; vx: number; vy: number;
  r: number; pulse: number; pulseSpeed: number;
}

interface Orb {
  x: number; y: number; targetX: number; targetY: number;
  size: number; color: string; opacity: number; speed: number;
  offsetX: number; offsetY: number;
}

export default function LandingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef   = useRef<Orb[]>([]);
  const mouseRef  = useRef({ x: -999, y: -999 });
  const rafRef    = useRef<number>(0);
  const nodesRef  = useRef<Node[]>([]);
  const [mounted, setMounted] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [userName, setUserName]   = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const cursorDotRef   = useRef<HTMLDivElement>(null);
  const cursorRingRef  = useRef<HTMLDivElement>(null);

  // ── Init orbs ──────────────────────────────────────────────────────────────
  const initOrbs = useCallback((w: number, h: number) => {
    orbsRef.current = [
      { x: w * 0.18, y: h * 0.28, targetX: w * 0.18, targetY: h * 0.28, size: 320, color: "#7c3aed", opacity: 0.13, speed: 0.025, offsetX: 0, offsetY: 0 },
      { x: w * 0.82, y: h * 0.35, targetX: w * 0.82, targetY: h * 0.35, size: 280, color: "#a855f7", opacity: 0.11, speed: 0.02,  offsetX: 0, offsetY: 0 },
      { x: w * 0.5,  y: h * 0.65, targetX: w * 0.5,  targetY: h * 0.65, size: 360, color: "#6d28d9", opacity: 0.09, speed: 0.018, offsetX: 0, offsetY: 0 },
      { x: w * 0.12, y: h * 0.72, targetX: w * 0.12, targetY: h * 0.72, size: 200, color: "#38bdf8", opacity: 0.07, speed: 0.03,  offsetX: 0, offsetY: 0 },
      { x: w * 0.88, y: h * 0.78, targetX: w * 0.88, targetY: h * 0.78, size: 240, color: "#8b5cf6", opacity: 0.08, speed: 0.022, offsetX: 0, offsetY: 0 },
    ];
  }, []);

  // ── Init neural nodes ──────────────────────────────────────────────────────
  const initNodes = useCallback((w: number, h: number) => {
    nodesRef.current = Array.from({ length: 55 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2.8 + 1,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.018 + 0.008,
    }));
  }, []);

  // ── Draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const t  = Date.now() * 0.001;

    // Draw orbs
    orbsRef.current.forEach((orb, idx) => {
      const influence = 220 + idx * 40;
      const dx = mx - orb.x;
      const dy = my - orb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < influence && mx > 0) {
        orb.targetX = orb.x - dx * 0.12;
        orb.targetY = orb.y - dy * 0.12;
      } else {
        const baseX = [W * 0.18, W * 0.82, W * 0.5, W * 0.12, W * 0.88][idx];
        const baseY = [H * 0.28, H * 0.35, H * 0.65, H * 0.72, H * 0.78][idx];
        orb.targetX = baseX + Math.sin(t * 0.4 + idx * 1.3) * 40;
        orb.targetY = baseY + Math.cos(t * 0.3 + idx * 0.9) * 30;
      }

      orb.x += (orb.targetX - orb.x) * orb.speed;
      orb.y += (orb.targetY - orb.y) * orb.speed;

      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.size);
      grad.addColorStop(0, hexToRgba(orb.color, orb.opacity * 1.4));
      grad.addColorStop(0.5, hexToRgba(orb.color, orb.opacity * 0.7));
      grad.addColorStop(1, hexToRgba(orb.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Update + draw neural nodes
    const nodes = nodesRef.current;
    nodes.forEach((n) => {
      n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;

      // Mouse repulsion
      const dxm = n.x - mx, dym = n.y - my;
      const dm  = Math.sqrt(dxm * dxm + dym * dym);
      if (dm < 100 && mx > 0) {
        n.vx += (dxm / dm) * 0.4;
        n.vy += (dym / dm) * 0.4;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 2.5) { n.vx = (n.vx / speed) * 2.5; n.vy = (n.vy / speed) * 2.5; }
      }
    });

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 145) {
          const alpha = (1 - d / 145) * 0.18;
          ctx.strokeStyle = `rgba(124,58,237,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Mouse proximity connections
    if (mx > 0) {
      nodes.forEach((n) => {
        const dx = n.x - mx, dy = n.y - my;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 160) {
          const alpha = (1 - d / 160) * 0.45;
          ctx.strokeStyle = `rgba(167,139,250,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
      });
    }

    // Draw nodes
    nodes.forEach((n) => {
      const pulse = (Math.sin(n.pulse) + 1) * 0.5;
      const bright = 0.4 + pulse * 0.6;

      // Glow
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
      g.addColorStop(0, `rgba(167,139,250,${0.12 * bright})`);
      g.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(196,181,253,${0.55 + pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (0.85 + pulse * 0.25), 0, Math.PI * 2);
      ctx.fill();
    });

    // Mouse cursor glow
    if (mx > 0) {
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
      mg.addColorStop(0, "rgba(167,139,250,0.12)");
      mg.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ── Setup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    // Auth check
    import("@supabase/supabase-js").then(({ createClient }) => {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
      );
      sb.auth.getSession().then(({ data }) => {
        const user = data.session?.user ?? null;
        if (user) {
          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User";
          setUserName(name);
        }
        setAuthReady(true);
      });
    });
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initOrbs(canvas.width, canvas.height);
      initNodes(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      clearTimeout(t);
    };
  }, [draw, initOrbs, initNodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
    if (cursorDotRef.current) {
      cursorDotRef.current.style.left = e.clientX + "px";
      cursorDotRef.current.style.top  = e.clientY + "px";
    }
    if (cursorRingRef.current) {
      cursorRingRef.current.style.left = e.clientX + "px";
      cursorRingRef.current.style.top  = e.clientY + "px";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -999, y: -999 };
  }, []);

  const features = [
    { icon: "↑", title: "DATASET UPLOAD",   desc: "Upload CSV, PDF, and image datasets instantly with automatic indexing and metadata extraction.", color: "#a78bfa", glow: "rgba(167,139,250,0.2)"  },
    { icon: "🧠", title: "AI INSIGHTS",      desc: "Get intelligent analysis reports on any dataset — completeness, consistency, accuracy and more.", color: "#38bdf8", glow: "rgba(56,189,248,0.2)"   },
    { icon: "◎", title: "DATASET EXPLORER", desc: "Browse, search and filter the entire dataset library with quality scores and instant preview.",    color: "#4ade80", glow: "rgba(74,222,128,0.2)"   },
    { icon: "◆", title: "COMPARE",          desc: "Side-by-side dataset comparison with dimension-level quality breakdowns and scoring.",            color: "#fbbf24", glow: "rgba(251,191,36,0.2)"   },
    { icon: "⬡", title: "ANALYTICS",        desc: "Track training compute, model performance and dataset quality scores over time.",                 color: "#f472b6", glow: "rgba(244,114,182,0.2)"  },
    { icon: "◈", title: "COLLABORATE",      desc: "Invite teammates, share datasets and build ML pipelines together in a shared workspace.",         color: "#c084fc", glow: "rgba(192,132,252,0.2)"  },
  ];

  const stats = [
    { value: "10K+",  label: "Datasets",   color: "#a78bfa" },
    { value: "99.9%", label: "Uptime",     color: "#4ade80" },
    { value: "50ms",  label: "Avg Latency",color: "#38bdf8" },
    { value: "500+",  label: "Teams",      color: "#fbbf24" },
  ];

  return (
    <div
      style={{ minHeight: "100vh", background: "#080612", color: "#e2d9f3", fontFamily: "'IBM Plex Mono','Fira Code',monospace", position: "relative", overflowX: "hidden", cursor: "none" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes gradText  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes scanline  { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glowPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes borderAnim{ 0%,100%{border-color:rgba(124,58,237,0.2)} 50%{border-color:rgba(124,58,237,0.5)} }
        @keyframes float1    { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
        @keyframes float2    { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer   { 0%{opacity:0.4} 50%{opacity:1} 100%{opacity:0.4} }
        @keyframes cursorPulse{0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.2)} }

        .feat-card:hover {
          transform: translateY(-6px) !important;
          box-shadow: 0 16px 48px rgba(124,58,237,0.25) !important;
          border-color: rgba(124,58,237,0.45) !important;
        }
        .cta-primary:hover {
          transform: scale(1.04) !important;
          box-shadow: 0 0 40px rgba(124,58,237,0.6) !important;
        }
        .cta-secondary:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.5) !important;
          transform: scale(1.03) !important;
        }
        .nav-link:hover { color: #c4b5fd !important; }
        .stat-item:hover { transform: scale(1.05) !important; }
      `}</style>

      {/* Custom cursor */}
      {mounted && (
        <>
          <div ref={cursorDotRef} style={{
            position: "fixed", zIndex: 9999, pointerEvents: "none",
            left: "-99px", top: "-99px",
            transform: "translate(-50%, -50%)",
            width: 10, height: 10, borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.8), 0 0 14px rgba(167,139,250,0.7)",
            willChange: "left, top",
          }} />
          <div ref={cursorRingRef} style={{
            position: "fixed", zIndex: 9998, pointerEvents: "none",
            left: "-99px", top: "-99px",
            transform: "translate(-50%, -50%)",
            width: 38, height: 38, borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.55)",
            boxShadow: "0 0 12px rgba(124,58,237,0.35)",
            transition: "left 0.06s linear, top 0.06s linear",
            willChange: "left, top",
          }} />
        </>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />

      {/* Grid overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)`,
        backgroundSize: "44px 44px",
      }} />

      {/* Scan line */}
      <div style={{
        position: "fixed", left: 0, right: 0, height: 1, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)",
        animation: "scanline 12s linear infinite",
      }} />

      <div style={{ position: "relative", zIndex: 3 }}>

        {/* ── NAV ────────────────────────────────────────────────────────────── */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 48px",
          borderBottom: "1px solid rgba(124,58,237,0.1)",
          background: "rgba(8,6,18,0.7)",
          backdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 100,
          animation: "fadeIn 0.5s ease both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 17, color: "#fff",
              boxShadow: "0 0 22px rgba(124,58,237,0.6)",
            }}>N</div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.1em" }}>
              <span style={{ color: "#fff" }}>Neuro</span>
              <span style={{ color: "#38bdf8" }}>Rift</span>
            </span>
          </div>

          {authReady && (
            userName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, #a855f7, #38bdf8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff",
                    boxShadow: "0 0 14px rgba(124,58,237,0.45)",
                    flexShrink: 0,
                  }}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, color: "#c4b5fd", fontFamily: "inherit", letterSpacing: "0.06em" }}>
                    Hi, <span style={{ color: "#f3f0ff", fontWeight: 700 }}>{userName}</span>
                  </span>
                </div>
                <button
                  className="cta-primary"
                  onClick={() => router.push("/dashboard")}
                  style={{
                    padding: "9px 24px", borderRadius: 50,
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    border: "none", color: "#fff",
                    fontSize: 12, fontFamily: "inherit", fontWeight: 800,
                    cursor: "pointer", letterSpacing: "0.06em",
                    boxShadow: "0 0 18px rgba(124,58,237,0.4)",
                    transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                  }}
                >Dashboard →</button>
              </div>
            ) : (
              <button
                className="cta-primary"
                onClick={() => router.push("/auth")}
                style={{
                  padding: "9px 24px", borderRadius: 50,
                  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                  border: "none", color: "#fff",
                  fontSize: 12, fontFamily: "inherit", fontWeight: 800,
                  cursor: "pointer", letterSpacing: "0.06em",
                  boxShadow: "0 0 18px rgba(124,58,237,0.4)",
                  transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                }}
              >Sign In</button>
            )
          )}
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "80px 32px 60px",
          position: "relative",
        }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 18px", borderRadius: 20,
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.3)",
            color: "#a78bfa", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.16em", marginBottom: 40,
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.7s ease",
            animation: mounted ? "borderAnim 3s ease-in-out infinite" : "none",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 8px rgba(167,139,250,0.8)", animation: "glowPulse 2s ease-in-out infinite" }} />
            AI/ML DATASET PLATFORM · NEURORIFT 2026
          </div>

          {/* Main heading */}
          <h1 style={{
            fontSize: "clamp(48px, 8vw, 96px)",
            fontWeight: 900,
            margin: "0 0 28px",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s ease 0.1s",
          }}>
            <span style={{
              display: "block",
              background: "linear-gradient(135deg, #e2d9f3 0%, #a78bfa 40%, #38bdf8 80%, #e2d9f3 100%)",
              backgroundSize: "300% 300%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "gradText 5s ease infinite",
            }}>EXPLORE YOUR</span>
            <span style={{
              display: "block",
              background: "linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)",
              backgroundSize: "300% 300%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "gradText 5s ease 0.5s infinite",
            }}>DATA UNIVERSE</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "clamp(14px, 2vw, 18px)",
            color: "#9ca3af",
            maxWidth: 560,
            lineHeight: 1.7,
            margin: "0 0 52px",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.8s ease 0.2s",
          }}>
            AI/ML Dataset Explorer &amp; Analysis Platform. Upload, analyze, compare and discover datasets intelligently.
          </p>

          {/* CTAs */}
          <div style={{
            display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(14px)",
            transition: "all 0.8s ease 0.3s",
          }}>
            <button
              className="cta-primary"
              onClick={() => router.push(userName ? "/dashboard" : "/auth")}
              style={{
                padding: "16px 38px", borderRadius: 50,
                background: "linear-gradient(135deg, #7c3aed, #a855f7, #38bdf8)",
                backgroundSize: "200% 200%",
                border: "none", color: "#fff",
                fontSize: 14, fontFamily: "inherit", fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.06em",
                boxShadow: "0 0 28px rgba(124,58,237,0.5)",
                transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                animation: "gradText 4s ease infinite",
              }}
            >Go to Dashboard</button>

            <button
              className="cta-secondary"
              onClick={() => router.push(userName ? "/dashboard" : "/auth")}
              style={{
                padding: "16px 38px", borderRadius: 50,
                background: "transparent",
                border: "2px solid rgba(255,255,255,0.25)",
                color: "#e2d9f3", fontSize: 14,
                fontFamily: "inherit", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.06em",
                transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              {userName ? "Open Dashboard" : "Get Started"}
              <span style={{ fontSize: 16, transition: "transform 0.2s" }}>→</span>
            </button>
          </div>

          {/* Scroll hint */}
          <div style={{
            position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            opacity: heroVisible ? 0.5 : 0,
            transition: "opacity 1s ease 0.8s",
            animation: mounted ? "float2 2.5s ease-in-out infinite" : "none",
          }}>
            <div style={{ width: 1, height: 36, background: "linear-gradient(to bottom, transparent, rgba(124,58,237,0.6))" }} />
            <span style={{ fontSize: 8, color: "#6b7280", letterSpacing: "0.2em" }}>SCROLL</span>
          </div>
        </section>

        {/* ── STATS STRIP ────────────────────────────────────────────────────── */}
        <section style={{
          padding: "0 48px 80px",
          animation: "fadeUp 0.6s ease both 0.4s",
        }}>
          <div style={{
            maxWidth: 960, margin: "0 auto",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.15)",
            borderRadius: 18,
            overflow: "hidden",
            backdropFilter: "blur(12px)",
          }}>
            {stats.map((s, i) => (
              <div key={i} className="stat-item" style={{
                padding: "28px 20px", textAlign: "center",
                borderRight: i < stats.length - 1 ? "1px solid rgba(124,58,237,0.1)" : "none",
                transition: "transform 0.2s ease",
                cursor: "default",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: `radial-gradient(ellipse 60% 60% at 50% 0%, ${s.color}12, transparent 70%)`,
                }} />
                <div style={{
                  fontSize: 32, fontWeight: 900, color: s.color,
                  letterSpacing: "-0.03em", lineHeight: 1,
                  textShadow: `0 0 20px ${s.color}66`,
                }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8, letterSpacing: "0.12em" }}>
                  {s.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ───────────────────────────────────────────────────────── */}
        <section style={{ padding: "0 48px 100px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.22em", fontWeight: 700, marginBottom: 12 }}>
                // CAPABILITIES
              </div>
              <h2 style={{
                fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900,
                letterSpacing: "-0.03em", color: "#f3f0ff",
                margin: 0,
              }}>Everything you need to master your data</h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 18,
            }}>
              {features.map((f, i) => (
                <div
                  key={i}
                  className="feat-card"
                  style={{
                    background: "rgba(16,10,30,0.78)",
                    border: "1px solid rgba(124,58,237,0.14)",
                    borderRadius: 16, padding: "28px 26px",
                    backdropFilter: "blur(14px)",
                    transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                    position: "relative", overflow: "hidden",
                    animation: `fadeUp 0.5s ease both ${0.1 + i * 0.08}s`,
                    cursor: "default",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 1,
                    background: `linear-gradient(90deg, transparent, ${f.color}55, transparent)`,
                  }} />
                  <div style={{
                    position: "absolute", top: 0, right: 0, width: 80, height: 80,
                    background: `radial-gradient(circle, ${f.glow}, transparent 70%)`,
                  }} />
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: `linear-gradient(135deg, ${f.color}28, ${f.color}0a)`,
                    border: `1px solid ${f.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: f.color, marginBottom: 18,
                    boxShadow: `0 0 18px ${f.glow}`,
                  }}>{f.icon}</div>
                  <div style={{ fontSize: 10, color: f.color, letterSpacing: "0.18em", fontWeight: 700, marginBottom: 8 }}>
                    {f.title}
                  </div>
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, margin: 0 }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA SECTION ────────────────────────────────────────────────────── */}
        <section style={{ padding: "0 48px 120px" }}>
          <div style={{
            maxWidth: 800, margin: "0 auto", textAlign: "center",
            background: "rgba(16,10,30,0.8)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 24, padding: "60px 48px",
            backdropFilter: "blur(16px)",
            position: "relative", overflow: "hidden",
            animation: "fadeUp 0.6s ease both 0.3s",
          }}>
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124,58,237,0.15), transparent 65%)",
            }} />
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(56,189,248,0.4), transparent)",
            }} />
            <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.22em", fontWeight: 700, marginBottom: 18 }}>
              // GET STARTED TODAY
            </div>
            <h2 style={{
              fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900,
              letterSpacing: "-0.03em", color: "#f3f0ff",
              margin: "0 0 16px",
            }}>Start exploring your datasets</h2>
            <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, margin: "0 0 36px" }}>
              Join the NeuroRift platform and unlock AI-powered insights for every dataset in your collection.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="cta-primary"
                onClick={() => router.push(userName ? "/dashboard" : "/auth")}
                style={{
                  padding: "14px 36px", borderRadius: 50,
                  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                  border: "none", color: "#fff",
                  fontSize: 13, fontFamily: "inherit", fontWeight: 800,
                  cursor: "pointer", letterSpacing: "0.06em",
                  boxShadow: "0 0 24px rgba(124,58,237,0.45)",
                  transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                }}
              >{userName ? "Go to Dashboard →" : "Create Free Account"}</button>
              <button
                className="cta-secondary"
                onClick={() => router.push("/datasets")}
                style={{
                  padding: "14px 36px", borderRadius: 50,
                  background: "transparent",
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#a78bfa", fontSize: 13,
                  fontFamily: "inherit", fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.06em",
                  transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                }}
              >Browse Datasets →</button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <footer style={{
          padding: "28px 48px",
          borderTop: "1px solid rgba(124,58,237,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(8,6,18,0.8)", backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 12, color: "#fff",
            }}>N</div>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: "#fff" }}>Neuro</span><span style={{ color: "#38bdf8" }}>Rift</span>
            </span>
          </div>
          <span style={{ fontSize: 10, color: "#374151", letterSpacing: "0.12em" }}>
            © 2026 NEURORIFT · All systems nominal
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Explore",   path: "/datasets"  },
              { label: "Dashboard", path: "/dashboard" },
              { label: "Login",     path: "/auth"       },
            ].map((l) => (
              <button key={l.label} className="nav-link" onClick={() => router.push(l.path)} style={{
                background: "none", border: "none", color: "#6b7280", fontSize: 11,
                fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em",
                transition: "color 0.2s",
              }}>{l.label}</button>
            ))}
          </div>
        </footer>

      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}