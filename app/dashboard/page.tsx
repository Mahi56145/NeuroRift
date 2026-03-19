"use client";

import { useState } from "react";

const datasets = [
  { id: 1, name: "ImageNet-21K Subset", type: "Computer Vision", size: "84.2 GB", rows: "14.2M", tags: ["image", "classification"], status: "ready", accuracy: 94.2 },
  { id: 2, name: "CommonCrawl NLP Corpus", type: "NLP", size: "312 GB", rows: "890M", tags: ["text", "multilingual"], status: "processing", accuracy: 87.6 },
  { id: 3, name: "BioBench Genomics v3", type: "Bioinformatics", size: "22.1 GB", rows: "4.1M", tags: ["genomics", "medical"], status: "ready", accuracy: 91.8 },
  { id: 4, name: "TimeSeries-Finance 2024", type: "Time Series", size: "5.6 GB", rows: "120M", tags: ["finance", "temporal"], status: "ready", accuracy: 88.3 },
  { id: 5, name: "3D-ShapeNet Pro", type: "3D / Point Cloud", size: "47.9 GB", rows: "2.8M", tags: ["3d", "mesh"], status: "error", accuracy: 79.1 },
  { id: 6, name: "SatelliteEarth RGB-IR", type: "Remote Sensing", size: "198 GB", rows: "6.5M", tags: ["satellite", "geo"], status: "ready", accuracy: 92.5 },
];

const stats = [
  { label: "Total Datasets", value: "1,284", delta: "+12 this week", icon: "⬡" },
  { label: "Active Pipelines", value: "38", delta: "6 running now", icon: "◈" },
  { label: "Compute Used", value: "72.4%", delta: "↑ 4.2% today", icon: "◉" },
  { label: "Models Trained", value: "9,741", delta: "+221 this month", icon: "◆" },
];

const activity = [
  { time: "2m ago", event: "Training complete", detail: "ResNet-50 on BioBench v3", type: "success" },
  { time: "14m ago", event: "Dataset indexed", detail: "SatelliteEarth RGB-IR uploaded", type: "info" },
  { time: "1h ago", event: "Pipeline error", detail: "3D-ShapeNet preprocessing failed", type: "error" },
  { time: "3h ago", event: "New model deployed", detail: "GPT-mini-finance v2 → production", type: "success" },
  { time: "5h ago", event: "Collaboration invite", detail: "Dr. Meera Nair joined workspace", type: "info" },
];

const navItems = [
  { icon: "⬡", label: "Dashboard", active: true },
  { icon: "◈", label: "Datasets" },
  { icon: "◉", label: "Pipelines" },
  { icon: "◆", label: "Models" },
  { icon: "⬟", label: "Analytics" },
  { icon: "⬠", label: "Workspace" },
  { icon: "◇", label: "Settings" },
];

const sparkData = [40, 55, 48, 72, 60, 85, 78, 92, 88, 95, 82, 98];

function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const h = 36;
  const w = 120;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filtered = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0812",
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      color: "#e2d9f3",
      display: "flex",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Animated Background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,51,180,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(168,85,247,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 55% 40%, rgba(234,179,8,0.05) 0%, transparent 60%)
        `,
      }} />
      {/* Grid overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 220 : 64,
        minHeight: "100vh",
        background: "rgba(16,10,30,0.85)",
        borderRight: "1px solid rgba(124,58,237,0.18)",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
        transition: "width 0.3s cubic-bezier(.4,0,.2,1)",
        backdropFilter: "blur(24px)",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: "24px 18px 20px",
          borderBottom: "1px solid rgba(124,58,237,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflow: "hidden",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff", flexShrink: 0,
            boxShadow: "0 0 16px rgba(124,58,237,0.5)",
          }}>N</div>
          {sidebarOpen && (
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
              <span style={{ color: "#fff" }}>NEURO</span><span style={{ color: "#38bdf8" }}>RIFT</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => (
            <button key={item.label} onClick={() => setActiveNav(item.label)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 8, border: "none",
              background: activeNav === item.label
                ? "linear-gradient(90deg, rgba(124,58,237,0.28), rgba(124,58,237,0.08))"
                : "transparent",
              color: activeNav === item.label ? "#c4b5fd" : "#6b7280",
              cursor: "pointer", width: "100%", textAlign: "left",
              fontSize: 13, fontFamily: "inherit",
              borderLeft: activeNav === item.label ? "2px solid #7c3aed" : "2px solid transparent",
              transition: "all 0.2s",
              whiteSpace: "nowrap", overflow: "hidden",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ fontWeight: activeNav === item.label ? 600 : 400 }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: "16px 14px",
          borderTop: "1px solid rgba(124,58,237,0.12)",
          display: "flex", alignItems: "center", gap: 10, overflow: "hidden",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #a855f7, #38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>AK</div>
          {sidebarOpen && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3", whiteSpace: "nowrap" }}>Arjun Kumar</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Pro Plan</div>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", position: "relative", zIndex: 1 }}>
        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "16px 28px",
          borderBottom: "1px solid rgba(124,58,237,0.13)",
          background: "rgba(10,8,18,0.7)",
          backdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 20,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "transparent", border: "none", color: "#6b7280",
            cursor: "pointer", fontSize: 18, padding: 4,
          }}>☰</button>

          <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#6b7280" }}>⌕</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search datasets, models, pipelines..."
              style={{
                width: "100%", padding: "8px 12px 8px 32px",
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 8, color: "#e2d9f3",
                fontSize: 12, fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              padding: "6px 14px", borderRadius: 6,
              background: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.25)",
              color: "#fbbf24", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            }}>◉ 6 LIVE</div>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#a78bfa", fontSize: 15,
            }}>🔔</div>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: "28px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Page Title */}
          <div>
            <div style={{ fontSize: 11, color: "#7c3aed", letterSpacing: "0.2em", fontWeight: 600, marginBottom: 4 }}>// OVERVIEW</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#f3f0ff" }}>
              Mission Control
            </h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
              Friday, 20 March 2026 · Workspace: <span style={{ color: "#a78bfa" }}>NeuroRift-Main</span>
            </p>
          </div>

          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: "rgba(16,10,30,0.7)",
                border: "1px solid rgba(124,58,237,0.16)",
                borderRadius: 12, padding: "18px 20px",
                backdropFilter: "blur(12px)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  width: 60, height: 60,
                  background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)",
                }} />
                <div style={{ fontSize: 20, marginBottom: 8, color: "#7c3aed" }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#f3f0ff", letterSpacing: "-0.03em" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 6, fontWeight: 600 }}>{s.delta}</div>
              </div>
            ))}
          </div>

          {/* Middle Row: Compute Chart + Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
            {/* Compute usage */}
            <div style={{
              background: "rgba(16,10,30,0.7)",
              border: "1px solid rgba(124,58,237,0.16)",
              borderRadius: 12, padding: "20px 22px",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.18em", fontWeight: 600 }}>// THROUGHPUT</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f3f0ff", marginTop: 2 }}>Training Compute (12h)</div>
                </div>
                <Spark data={sparkData} />
              </div>
              {/* Usage bars */}
              {[
                { label: "GPU Cluster A — H100×8", pct: 88, color: "#7c3aed" },
                { label: "GPU Cluster B — A100×4", pct: 61, color: "#a855f7" },
                { label: "CPU Pool — 128 cores", pct: 43, color: "#38bdf8" },
                { label: "Storage I/O — NVMe", pct: 72, color: "#fbbf24" },
              ].map((r, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.label}</span>
                    <span style={{ fontSize: 11, color: r.color, fontWeight: 700 }}>{r.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                    <div style={{
                      height: "100%", width: `${r.pct}%`, borderRadius: 3,
                      background: `linear-gradient(90deg, ${r.color}, ${r.color}88)`,
                      boxShadow: `0 0 8px ${r.color}55`,
                      transition: "width 1s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Activity Feed */}
            <div style={{
              background: "rgba(16,10,30,0.7)",
              border: "1px solid rgba(124,58,237,0.16)",
              borderRadius: 12, padding: "20px 18px",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.18em", fontWeight: 600, marginBottom: 4 }}>// LOG</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f0ff", marginBottom: 16 }}>Recent Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activity.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                      background: a.type === "success" ? "#22c55e" : a.type === "error" ? "#ef4444" : "#38bdf8",
                      boxShadow: `0 0 8px ${a.type === "success" ? "#22c55e" : a.type === "error" ? "#ef4444" : "#38bdf8"}88`,
                    }} />
                    <div>
                      <div style={{ fontSize: 11, color: "#e2d9f3", fontWeight: 600 }}>{a.event}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{a.detail}</div>
                      <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2, letterSpacing: "0.05em" }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Datasets Table */}
          <div style={{
            background: "rgba(16,10,30,0.7)",
            border: "1px solid rgba(124,58,237,0.16)",
            borderRadius: 12,
            backdropFilter: "blur(12px)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "18px 22px", borderBottom: "1px solid rgba(124,58,237,0.1)",
            }}>
              <div>
                <div style={{ fontSize: 10, color: "#7c3aed", letterSpacing: "0.18em", fontWeight: 600 }}>// DATASETS</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f0ff", marginTop: 2 }}>Recent Datasets</div>
              </div>
              <button style={{
                padding: "7px 16px", borderRadius: 7,
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                border: "none", color: "#fff", fontSize: 11,
                fontFamily: "inherit", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.06em",
                boxShadow: "0 0 14px rgba(124,58,237,0.35)",
              }}>+ IMPORT DATASET</button>
            </div>

            {/* Table Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1.2fr 0.8fr 0.7fr",
              padding: "10px 22px",
              borderBottom: "1px solid rgba(124,58,237,0.08)",
              fontSize: 9, color: "#4b5563", letterSpacing: "0.14em", fontWeight: 600,
            }}>
              <span>DATASET NAME</span><span>TYPE</span><span>SIZE</span>
              <span>ROWS</span><span>TAGS</span><span>ACCURACY</span><span>STATUS</span>
            </div>

            {filtered.map((d, i) => (
              <div key={d.id} style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1.2fr 0.8fr 0.7fr",
                padding: "14px 22px",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(124,58,237,0.06)" : "none",
                alignItems: "center",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.06)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "#e2d9f3" }}>{d.name}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{d.type}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{d.size}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{d.rows}</span>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {d.tags.map((t) => (
                    <span key={t} style={{
                      fontSize: 9, padding: "2px 7px", borderRadius: 4,
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.22)",
                      color: "#a78bfa", letterSpacing: "0.06em",
                    }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", width: `${d.accuracy}%`, borderRadius: 2,
                      background: d.accuracy > 90 ? "#22c55e" : d.accuracy > 85 ? "#fbbf24" : "#ef4444",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{d.accuracy}%</span>
                </div>
                <span style={{
                  fontSize: 9, padding: "3px 9px", borderRadius: 4, fontWeight: 700,
                  letterSpacing: "0.1em",
                  background: d.status === "ready"
                    ? "rgba(34,197,94,0.12)"
                    : d.status === "processing"
                    ? "rgba(251,191,36,0.12)"
                    : "rgba(239,68,68,0.12)",
                  color: d.status === "ready" ? "#22c55e" : d.status === "processing" ? "#fbbf24" : "#ef4444",
                  border: `1px solid ${d.status === "ready" ? "rgba(34,197,94,0.25)" : d.status === "processing" ? "rgba(251,191,36,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}>
                  {d.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 10, color: "#374151", paddingBottom: 8, letterSpacing: "0.12em" }}>
            © 2026 NEURORIFT · All systems nominal
          </div>
        </div>
      </main>
    </div>
  );
}