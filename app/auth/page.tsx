'use client';

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// ─── Canvas Types ─────────────────────────────────────────────────────────────
interface Orb  { x:number; y:number; targetX:number; targetY:number; size:number; color:string; opacity:number; speed:number; }
interface Node { x:number; y:number; vx:number; vy:number; r:number; pulse:number; pulseSpeed:number; }

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NeuroRiftAuth() {
  const router = useRouter();

  // ── Mode & form state ───────────────────────────────────────────────────────
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Sign-in fields
  const [identifier, setIdentifier]     = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign-up fields
  const [name, setName]           = useState('');
  const [username, setUsername]   = useState('');
  const [signUpEmail, setSignUpEmail]     = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Canvas refs ─────────────────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const orbsRef    = useRef<Orb[]>([]);
  const nodesRef   = useRef<Node[]>([]);
  const mouseRef   = useRef({ x: -999, y: -999 });
  const rafRef     = useRef<number>(0);
  const cursorDot  = useRef<HTMLDivElement>(null);
  const cursorRing = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // ── Canvas setup ────────────────────────────────────────────────────────────
  const initOrbs = useCallback((w: number, h: number) => {
    orbsRef.current = [
      { x:w*0.10, y:h*0.20, targetX:w*0.10, targetY:h*0.20, size:320, color:'#7c3aed', opacity:0.14, speed:0.025 },
      { x:w*0.88, y:h*0.28, targetX:w*0.88, targetY:h*0.28, size:280, color:'#a855f7', opacity:0.11, speed:0.020 },
      { x:w*0.50, y:h*0.68, targetX:w*0.50, targetY:h*0.68, size:360, color:'#6d28d9', opacity:0.09, speed:0.017 },
      { x:w*0.14, y:h*0.78, targetX:w*0.14, targetY:h*0.78, size:200, color:'#38bdf8', opacity:0.07, speed:0.030 },
      { x:w*0.86, y:h*0.78, targetX:w*0.86, targetY:h*0.78, size:240, color:'#8b5cf6', opacity:0.08, speed:0.022 },
    ];
  }, []);

  const initNodes = useCallback((w: number, h: number) => {
    nodesRef.current = Array.from({ length: 55 }, () => ({
      x: Math.random() * w,  y: Math.random() * h,
      vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.35,
      r: Math.random()*2.8+1,
      pulse: Math.random()*Math.PI*2,
      pulseSpeed: Math.random()*0.018+0.008,
    }));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width:W, height:H } = canvas;
    ctx.clearRect(0,0,W,H);
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const t  = Date.now() * 0.001;

    // Orbs
    orbsRef.current.forEach((orb, idx) => {
      const dx = mx - orb.x, dy = my - orb.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const influence = 220 + idx*40;
      if (dist < influence && mx > 0) {
        orb.targetX = orb.x - dx*0.12;
        orb.targetY = orb.y - dy*0.12;
      } else {
        const bx = [W*0.10, W*0.88, W*0.50, W*0.14, W*0.86][idx];
        const by = [H*0.20, H*0.28, H*0.68, H*0.78, H*0.78][idx];
        orb.targetX = bx + Math.sin(t*0.4 + idx*1.3)*40;
        orb.targetY = by + Math.cos(t*0.3 + idx*0.9)*30;
      }
      orb.x += (orb.targetX - orb.x)*orb.speed;
      orb.y += (orb.targetY - orb.y)*orb.speed;
      const g = ctx.createRadialGradient(orb.x,orb.y,0,orb.x,orb.y,orb.size);
      g.addColorStop(0, hexToRgba(orb.color, orb.opacity*1.4));
      g.addColorStop(0.5, hexToRgba(orb.color, orb.opacity*0.7));
      g.addColorStop(1, hexToRgba(orb.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI*2); ctx.fill();
    });

    // Nodes — update
    const nodes = nodesRef.current;
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      const dxm = n.x-mx, dym = n.y-my;
      const dm  = Math.sqrt(dxm*dxm + dym*dym);
      if (dm < 100 && mx > 0) {
        n.vx += (dxm/dm)*0.4; n.vy += (dym/dm)*0.4;
        const sp = Math.sqrt(n.vx*n.vx + n.vy*n.vy);
        if (sp > 2.5) { n.vx=(n.vx/sp)*2.5; n.vy=(n.vy/sp)*2.5; }
      }
    });

    // Node connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const dx = nodes[i].x-nodes[j].x, dy = nodes[i].y-nodes[j].y;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < 145) {
          ctx.strokeStyle = `rgba(124,58,237,${(1-d/145)*0.18})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.stroke();
        }
      }
    }

    // Mouse proximity lines
    if (mx > 0) {
      nodes.forEach(n => {
        const dx = n.x-mx, dy = n.y-my;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < 160) {
          ctx.strokeStyle = `rgba(167,139,250,${(1-d/160)*0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(mx,my); ctx.stroke();
        }
      });
    }

    // Draw nodes
    nodes.forEach(n => {
      const pulse = (Math.sin(n.pulse)+1)*0.5;
      const g2 = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r*5);
      g2.addColorStop(0, `rgba(167,139,250,${0.12*(0.4+pulse*0.6)})`);
      g2.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r*5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(196,181,253,${0.55+pulse*0.45})`;
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r*(0.85+pulse*0.25),0,Math.PI*2); ctx.fill();
    });

    // Cursor glow on canvas
    if (mx > 0) {
      const mg = ctx.createRadialGradient(mx,my,0,mx,my,60);
      mg.addColorStop(0,'rgba(167,139,250,0.12)'); mg.addColorStop(1,'rgba(167,139,250,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx,my,60,0,Math.PI*2); ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initOrbs(canvas.width, canvas.height);
      initNodes(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [draw, initOrbs, initNodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
    if (cursorDot.current) {
      cursorDot.current.style.left = e.clientX + 'px';
      cursorDot.current.style.top  = e.clientY + 'px';
    }
    if (cursorRing.current) {
      cursorRing.current.style.left = e.clientX + 'px';
      cursorRing.current.style.top  = e.clientY + 'px';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -999, y: -999 };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const clearMessages = () => { setFormError(null); setFormSuccess(null); };

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    clearMessages();
  };

  const resolveEmailFromIdentifier = async (value: string): Promise<string> => {
    if (value.includes('@')) return value.trim();
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', value.trim().toLowerCase())
      .maybeSingle();
    if (error || !data?.email) return '';
    return data.email;
  };

  // ── Sign In ──────────────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();

    if (!identifier.trim() || !signInPassword) {
      setFormError('Please enter your email/username and password.');
      return;
    }

    setLoading(true);

    const emailToUse = await resolveEmailFromIdentifier(identifier);
    if (!emailToUse) {
      setLoading(false);
      setFormError('Username not found. Try signing in with your email instead.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: signInPassword,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) {
        setFormError('Incorrect email or password. Please try again.');
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setFormError('Please verify your email before signing in. Check your inbox.');
      } else {
        setFormError(error.message);
      }
      return;
    }

    router.push('/dashboard');
  };

  // ── Sign Up ──────────────────────────────────────────────────────────────────
  const handleSignupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim() || !username.trim() || !signUpEmail.trim() || !signUpPassword || !confirmPassword) {
      setFormError('Please fill in all fields.');
      return;
    }

    if (signUpPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (signUpPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    // ✅ FIX 1: Normalize BEFORE validation
    const normalizedEmail = signUpEmail.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setFormError('Invalid email format. Example: name@gmail.com');
      return;
    }

    setLoading(true);

    // ✅ Check username duplicate
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (existingUsername) {
      setLoading(false);
      setFormError(`Username "@${normalizedUsername}" is already taken.`);
      return;
    }

    // ✅ Check email duplicate
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingEmail) {
      setLoading(false);
      setFormError('Email already registered. Please sign in.');
      return;
    }

    // ✅ Create account
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: signUpPassword,
      options: {
        data: {
          full_name: name.trim(),
          username: normalizedUsername,
        },
      },
    });

    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // ✅ Success
    setFormSuccess('Account created! Check your email to verify.');
    setMode('signin');
    setIdentifier(normalizedEmail);

    setName('');
    setUsername('');
    setSignUpEmail('');
    setSignUpPassword('');
    setConfirmPassword('');
  };

  const primaryLabel = loading
    ? (mode === 'signin' ? 'Signing In…' : 'Creating Account…')
    : (mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-dvh text-white bg-[#110022] overflow-hidden flex flex-col relative isolate"
      style={{ fontFamily: "'IBM Plex Mono','Fira Code',monospace", cursor: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Original bg image layer ──────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/images/bg.png"
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', transform: 'scale(1.03)',
            filter: 'saturate(1.25) contrast(1.1) brightness(1.1)',
          }}
        />
        <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-purple-950/30 mix-blend-hard-light" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(128,0,255,0.22),_transparent_70%)]" />
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-8 h-64 w-64 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      {/* ── Custom cursor ────────────────────────────────────────────────────── */}
      {mounted && (
        <>
          <div
            ref={cursorDot}
            style={{
              position: 'fixed', zIndex: 9999, pointerEvents: 'none',
              left: '-99px', top: '-99px',
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.8), 0 0 14px rgba(167,139,250,0.7)',
              willChange: 'left, top',
            }}
          />
          <div
            ref={cursorRing}
            style={{
              position: 'fixed', zIndex: 9998, pointerEvents: 'none',
              left: '-99px', top: '-99px',
              transform: 'translate(-50%, -50%)',
              width: 38, height: 38, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.55)',
              boxShadow: '0 0 12px rgba(124,58,237,0.35)',
              transition: 'left 0.06s linear, top 0.06s linear',
              willChange: 'left, top',
            }}
          />
        </>
      )}

      {/* ── Canvas (orbs + nodes on top of bg) ───────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      />

      {/* ── Scan line ────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: 0, right: 0, height: 1, zIndex: 3, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2), transparent)',
        animation: 'scanline 12s linear infinite',
      }} />

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 p-[20px_30px] z-10">
        <span className="text-[1.5rem] font-extrabold text-white uppercase tracking-[0.1rem]">
          Neuro<span className="text-[#00BCD4]">Rift</span>
        </span>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-grow flex justify-center items-center p-[60px_18px_20px_18px]">
        <div className="relative w-full" style={{ maxWidth: '390px', perspective: '1000px' }}>

          {/* Gold ambient glow — behind the frame */}
          <div style={{
            position: 'absolute', inset: '-18px', borderRadius: '36px',
            background: 'rgba(199,167,43,0.18)', filter: 'blur(28px)',
            animation: 'pulseGlow 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Gold border frame — thin 1.5px gradient stroke */}
          <div
            className="auth-frame"
            style={{
              position: 'relative', zIndex: 1, borderRadius: '22px', padding: '1.5px',
              background: 'linear-gradient(135deg, #B59410 0%, #F5E050 30%, #E6C200 70%, #90780A 100%)',
            }}
          >
            {/* Inner card — compact padding, tighter gaps */}
            <div
              style={{
                borderRadius: '20.5px',
                padding: '22px 26px 20px',
                background: 'rgba(14,8,28,0.94)',
                backdropFilter: 'blur(28px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
            >

              {/* Tab toggle */}
              <div style={{
                display: 'flex', width: '100%', marginBottom: '16px',
                borderRadius: '50px', padding: '3px',
                background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)',
              }}>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  style={{
                    width: '50%', borderRadius: '50px', padding: '7px 0',
                    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: mode === 'signin' ? 'rgba(0,229,255,0.14)' : 'transparent',
                    color: mode === 'signin' ? '#a5f3fc' : 'rgba(255,255,255,0.6)',
                    boxShadow: mode === 'signin' ? '0 0 16px rgba(0,229,255,0.22)' : 'none',
                  }}
                >Sign In</button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  style={{
                    width: '50%', borderRadius: '50px', padding: '7px 0',
                    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: mode === 'signup' ? 'rgba(255,0,190,0.14)' : 'transparent',
                    color: mode === 'signup' ? '#f9a8d4' : 'rgba(255,255,255,0.6)',
                    boxShadow: mode === 'signup' ? '0 0 16px rgba(255,0,190,0.22)' : 'none',
                  }}
                >Sign Up</button>
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: '1.55rem', fontWeight: 900, marginBottom: '2px',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                alignSelf: 'flex-start', lineHeight: 1.2,
              }}>
                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p style={{
                marginBottom: '12px', fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.6)', alignSelf: 'flex-start',
              }}>
                {mode === 'signin' ? 'Enter your credentials' : 'Set up your NeuroRift profile'}
              </p>

              {/* ── Error / Success banners ─────────────────────────────────── */}
              {formError && (
                <div style={{
                  width: '100%', marginBottom: '10px', padding: '9px 13px',
                  borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                  color: '#f87171', animation: 'fadeInBanner 0.25s ease',
                }}>
                  ✕ &nbsp;{formError}
                </div>
              )}
              {formSuccess && (
                <div style={{
                  width: '100%', marginBottom: '10px', padding: '9px 13px',
                  borderRadius: '11px', fontSize: '0.78rem', fontWeight: 600,
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                  color: '#4ade80', animation: 'fadeInBanner 0.25s ease',
                }}>
                  ✓ &nbsp;{formSuccess}
                </div>
              )}

              {/* ── Sign In form ─────────────────────────────────────────────── */}
              {mode === 'signin' && (
                <form style={{ width: '100%' }} onSubmit={handleLoginSubmit}>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); clearMessages(); }}
                    placeholder="Email or Username"
                    required
                    className="w-full mb-[10px] p-[11px_15px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.88rem] transition-all duration-300 hover:border-[#b85bff] focus:border-[#00FFFF]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={e => { setSignInPassword(e.target.value); clearMessages(); }}
                    placeholder="Password"
                    required
                    className="w-full mb-[12px] p-[11px_15px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.88rem] transition-all duration-300 hover:border-[#b85bff] focus:border-[#00FFFF]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-[12px] rounded-[22px] text-[0.88rem] font-bold bg-gradient-to-r from-[#2a0b57] via-[#3b0a68] to-[#5b0f86] text-white shadow-[0_0_22px_rgba(112,34,189,0.45)] hover:shadow-[0_0_30px_rgba(140,45,220,0.6)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  >
                    {loading && (
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full mr-2"
                        style={{ animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
                    )}
                    {primaryLabel}
                  </button>
                </form>
              )}

              {/* ── Sign Up form ─────────────────────────────────────────────── */}
              {mode === 'signup' && (
                <form style={{ width: '100%' }} onSubmit={handleSignupSubmit}>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); clearMessages(); }}
                    placeholder="Full Name"
                    required
                    className="w-full mb-[7px] p-[9px_13px] bg-black/20 border-2 border-[#7B1FA2] rounded-[20px] outline-none text-[0.86rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value.replace(/\s/g,'')); clearMessages(); }}
                    placeholder="Username"
                    required
                    className="w-full mb-[7px] p-[9px_13px] bg-black/20 border-2 border-[#7B1FA2] rounded-[20px] outline-none text-[0.86rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <input
                    type="email"
                    value={signUpEmail}
                    onChange={e => { setSignUpEmail(e.target.value); clearMessages(); }}
                    placeholder="Email"
                    required
                    className="w-full mb-[7px] p-[9px_13px] bg-black/20 border-2 border-[#7B1FA2] rounded-[20px] outline-none text-[0.86rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={e => { setSignUpPassword(e.target.value); clearMessages(); }}
                    placeholder="Password (min 6 chars)"
                    required
                    className="w-full mb-[7px] p-[9px_13px] bg-black/20 border-2 border-[#7B1FA2] rounded-[20px] outline-none text-[0.86rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); clearMessages(); }}
                    placeholder="Confirm Password"
                    required
                    className="w-full mb-[9px] p-[9px_13px] bg-black/20 border-2 border-[#7B1FA2] rounded-[20px] outline-none text-[0.86rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                    style={{ fontFamily: 'inherit' }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-[11px] rounded-[20px] text-[0.88rem] font-bold bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white shadow-[0_0_22px_rgba(217,70,239,0.45)] hover:shadow-[0_0_34px_rgba(217,70,239,0.65)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  >
                    {loading && (
                      <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full mr-2"
                        style={{ animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
                    )}
                    {primaryLabel}
                  </button>
                </form>
              )}

              {/* Mode switch link */}
              <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
                {mode === 'signin' ? (
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#00FFFF')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                  >New here? <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Create Account</strong></button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#00FFFF')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                  >Already have an account? <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Sign In</strong></button>
                )}
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="fixed bottom-0 inset-x-0 text-[0.75rem] text-white/40 text-center pb-2 z-10">
        © 2026 NEURORIFT · All systems nominal
      </footer>

      {/* ── Styles ───────────────────────────────────────────────────────────── */}
      <style jsx>{`
        .auth-frame { animation: frameGlow 4.5s ease-in-out infinite; }

        @keyframes frameGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.3); }
          50%       { box-shadow: 0 0 38px rgba(245,224,80,0.52); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes fadeInBanner {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}