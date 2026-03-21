"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function NeuroRiftLanding() {
const router = useRouter();

// Features data based on image content, used for the status-block-style rendering
const features = [
{ title: "Dataset Upload", subtitle: "Upload CSV and PDF datasets with automatic storage and preview.", nodeColor: "text-cyan-400" },
{ title: "AI Insights", subtitle: "Get intelligent summaries and insights from your datasets.", nodeColor: "text-pink-400" },
{ title: "Dataset Explorer", subtitle: "Browse, download, and compare datasets across categories.", nodeColor: "text-purple-400" },
];

return (
<>
<div className="relative min-h-screen text-white overflow-hidden bg-black font-sans">

{/* Background: An intricate, complex neural-network/data-mesh visualization */}
<div className="absolute inset-0 z-0">
<Image
src="/images/bg.png" // Replace with actual high-res mesh asset path
alt="Intricate, Glowing AI Network and Data Mesh"
fill
className="object-cover"
priority
/>
{/* Advanced layering for royal/premium depth */}
<div className="absolute inset-0 bg-black/80 mix-blend-multiply" />
<div className="absolute inset-0 bg-purple-950/40 mix-blend-hard-light" />
{/* Cinematic glow from within the mesh */}
<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(128,0,255,0.2),_transparent_70%)]" />
</div>

{/* Content */}
<div className="relative z-10 flex flex-col min-h-screen">

{/* 1. High-Tech Navbar */}
<header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 backdrop-blur-sm lg:px-12">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-cyan-400 relative">
{/* Visual mesh accent in the logo */}
<div className="absolute w-4 h-4 rounded-full bg-cyan-500/30 animate-pulse"></div>
<span className="text-xl font-bold tracking-tighter text-cyan-200">N</span>
</div>
<h1 className="text-xl font-bold tracking-wide">
Neuro<span className="text-cyan-400">Rift</span>
</h1>
</div>

<div className="flex gap-8 text-sm text-gray-300">
<button onClick={() => router.push("/dashboard")} className="hover:text-cyan-200 transition-colors">Dashboard</button>
<button onClick={() => router.push("/auth")} className="hover:text-pink-200 transition-colors">Login</button>
</div>
</header>

{/* 2. Central Hero Section (Occupying the dark central void) */}
<main className="flex-grow flex flex-col items-center justify-center text-center px-6 lg:px-12 py-12 md:py-16">
<div className="max-w-5xl space-y-6">
<h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight bg-gradient-to-r from-pink-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent animate-gradient-shift">
EXPLORE YOUR <br /> DATA UNIVERSE
</h2>

<p className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-3xl mx-auto backdrop-blur-[1px] p-4 rounded-xl bg-purple-950/20">
AI/ML Dataset Explorer & Analysis Platform.
Upload, analyze, compare and discover datasets intelligently.
</p>

<div className="flex gap-6 mt-8 flex-wrap justify-center">
<button
onClick={() => router.push("/dashboard")}
className="px-10 py-4 text-base font-semibold rounded-full bg-cyan-500 text-black hover:bg-cyan-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(30,255,255,0.4)]"
>
Go to Dashboard
</button>

<button
onClick={() => router.push("/auth")}
className="px-10 py-4 text-base font-semibold rounded-full border-2 border-white text-gray-200 hover:bg-white hover:text-black transition-all flex items-center gap-2 group"
>
Get Started
<span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
</button>
</div>
</div>
</main>

{/* 3. Integrated Status/Feature Grid with Gold Accents */}
<aside className="px-6 py-10 lg:px-12 backdrop-blur-sm border-t border-gray-800">
<div className="grid md:grid-cols-3 gap-6 text-sm">
{features.map((feature, idx) => (
<div key={idx} className="p-6 bg-gray-900/40 rounded-xl border border-gray-800 relative group flex flex-col gap-2">
{/* Uppercase feature label */}
<span className={`text-xs tracking-wide uppercase font-medium ${feature.nodeColor}`}>{feature.title}</span>
{/* Feature content with pulsing node and preserved content case */}
<div className="flex items-center gap-2">
<span className="text-lg font-bold text-white flex items-center gap-2">
<span className={`w-2 h-2 rounded-full bg-current ${feature.nodeColor} animate-pulse inline-block`}></span>
{feature.title}
</span>
</div>
<p className="text-gray-400 text-sm leading-relaxed">{feature.subtitle}</p>

{/* Premium interactive gold corner highlights */}
<div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-gold-400 rounded-tl-sm group-hover:w-4 group-hover:h-4 transition-all"></div>
<div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-gold-400 rounded-br-sm group-hover:w-4 group-hover:h-4 transition-all"></div>
</div>
))}
</div>
</aside>

{/* 4. Refined Footer */}
<footer className="text-center text-gray-600 text-xs py-6 border-t border-gray-900 flex flex-col items-center gap-2 px-6 lg:px-12 bg-gray-900/60 backdrop-blur-sm">
<div className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-gold-600 relative mb-1">
<div className="absolute w-3 h-3 rounded-full bg-gold-700/30"></div>
<span className="text-xs font-bold text-gold-300">N</span>
</div>
<p>© 2026 NEURORIFT. All rights reserved.</p>
<p className="mt-1 text-gray-700">AI • Data • Intelligence</p>
</footer>

</div>
</div>
</>
);
}