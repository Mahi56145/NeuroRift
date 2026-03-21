'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function NeuroRiftLogin() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [loading, setLoading] = useState(false);

    const [identifier, setIdentifier] = useState('');
    const [signInPassword, setSignInPassword] = useState('');

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const router = useRouter();

    const resolveEmailFromIdentifier = async (value: string) => {
        if (value.includes('@')) {
            return value.trim();
        }

        const usernameKey = value.trim().toLowerCase();
        if (!usernameKey) {
            return '';
        }

        // Optional username -> email lookup through a common profile table.
        // If your project uses a different table, update this query accordingly.
        const { data, error } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', usernameKey)
            .maybeSingle();

        if (error || !data?.email) {
            return '';
        }

        return data.email;
    };

    const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!identifier || !signInPassword) {
            alert('Enter email/username and password');
            return;
        }

        setLoading(true);
        const emailToUse = await resolveEmailFromIdentifier(identifier);

        if (!emailToUse) {
            setLoading(false);
            alert('Username not found. Use your email or check your username.');
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: emailToUse,
            password: signInPassword,
        });

        setLoading(false);

        if (error) {
            alert(error.message);
            return;
        }

        router.push('/dashboard');
    };

    const handleSignupSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!name || !username || !signUpEmail || !signUpPassword || !confirmPassword) {
            alert('Please fill all signup fields');
            return;
        }

        if (signUpPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        setLoading(true);
        const normalizedUsername = username.trim().toLowerCase();

        const { error } = await supabase.auth.signUp({
            email: signUpEmail.trim(),
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
            alert(error.message);
            return;
        }

        alert('Account created. Verify your email, then sign in.');
        setMode('signin');
        setIdentifier(signUpEmail.trim());
        setSignInPassword('');
    };

    const primaryButtonLabel = loading
        ? mode === 'signin'
            ? 'Signing In...'
            : 'Creating Account...'
        : mode === 'signin'
            ? 'SIGN IN'
            : 'CREATE ACCOUNT';

    return (
        <div className="h-dvh text-white bg-[#110022] overflow-hidden flex flex-col relative isolate font-sans">
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <Image
                    src="/images/bg.png"
                    alt="Neural data mesh background"
                    fill
                    className="object-cover scale-[1.03] saturate-125 contrast-110 brightness-110"
                    priority
                />
                <div className="absolute inset-0 bg-black/60 mix-blend-multiply" />
                <div className="absolute inset-0 bg-purple-950/30 mix-blend-hard-light" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(128,0,255,0.22),_transparent_70%)]" />
                <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute bottom-0 left-8 h-64 w-64 rounded-full bg-pink-500/15 blur-3xl" />
                <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
            </div>

            <header className="fixed top-0 left-0 p-[20px_30px] z-10">
                <span className="text-[1.5rem] font-extrabold text-white uppercase tracking-[0.1rem]">
                    Neuro<span className="text-[#00BCD4]">Rift</span>
                </span>
            </header>

            <main className="relative z-10 flex-grow flex justify-center items-center p-[68px_18px_24px_18px] md:p-[74px_20px_26px_20px]">
                <div className="relative max-w-[430px] w-full auth-card-wrap" style={{ perspective: '1000px' }}>
                    <div className="absolute -inset-5 rounded-[34px] bg-[#c7a72b]/20 blur-2xl animate-pulse" />

                    <div
                        className="relative z-[1] rounded-[28px] p-[2px] auth-frame"
                        style={{
                            background: 'linear-gradient(135deg, #B59410 0%, #F5E050 30%, #E6C200 70%, #90780A 100%)',
                        }}
                    >
                        <div
                            className="relative z-[2] backdrop-blur-[12px] rounded-[26px] p-[24px_22px] text-center auth-card"
                            style={{ backgroundColor: 'rgba(30, 0, 60, 0.52)' }}
                        >
                            <div className="mb-4 p-1 rounded-full bg-white/10 border border-white/15 flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setMode('signin')}
                                    className={`w-1/2 rounded-full py-2 text-sm font-semibold transition-all ${
                                        mode === 'signin'
                                            ? 'bg-cyan-400/20 text-cyan-200 shadow-[0_0_18px_rgba(0,229,255,0.25)]'
                                            : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('signup')}
                                    className={`w-1/2 rounded-full py-2 text-sm font-semibold transition-all ${
                                        mode === 'signup'
                                            ? 'bg-pink-400/20 text-pink-200 shadow-[0_0_18px_rgba(255,0,190,0.25)]'
                                            : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <h1 className="text-[1.75rem] md:text-[1.9rem] font-extrabold mb-[5px] uppercase leading-tight">
                                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                            </h1>

                            <p className="mb-[14px] text-[0.9rem] md:text-[0.95rem] text-white/80">
                                {mode === 'signin' ? 'Enter your credentials' : 'Set up your NeuroRift profile'}
                            </p>

                            {mode === 'signin' ? (
                                <form className="w-full" onSubmit={handleLoginSubmit}>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="Email or Username"
                                        required
                                        className="w-full mb-[12px] p-[12px_15px] bg-black/20 border-2 border-[#7B1FA2] rounded-[24px] outline-none text-[0.92rem] transition-all duration-300 hover:border-[#b85bff] focus:border-[#00FFFF]"
                                    />

                                    <input
                                        type="password"
                                        value={signInPassword}
                                        onChange={(e) => setSignInPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        className="w-full mb-[13px] p-[12px_15px] bg-black/20 border-2 border-[#7B1FA2] rounded-[24px] outline-none text-[0.92rem] transition-all duration-300 hover:border-[#b85bff] focus:border-[#00FFFF]"
                                    />

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full p-[13px] rounded-[24px] text-[0.92rem] font-bold mt-[5px] bg-gradient-to-r from-[#2a0b57] via-[#3b0a68] to-[#5b0f86] text-white shadow-[0_0_22px_rgba(112,34,189,0.45)] hover:shadow-[0_0_30px_rgba(140,45,220,0.6)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {primaryButtonLabel}
                                    </button>
                                </form>
                            ) : (
                                <form className="w-full" onSubmit={handleSignupSubmit}>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Name"
                                        required
                                        className="w-full mb-[8px] p-[10px_14px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.9rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                                    />

                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Username"
                                        required
                                        className="w-full mb-[8px] p-[10px_14px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.9rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                                    />

                                    <input
                                        type="email"
                                        value={signUpEmail}
                                        onChange={(e) => setSignUpEmail(e.target.value)}
                                        placeholder="Email"
                                        required
                                        className="w-full mb-[8px] p-[10px_14px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.9rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                                    />

                                    <input
                                        type="password"
                                        value={signUpPassword}
                                        onChange={(e) => setSignUpPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        className="w-full mb-[8px] p-[10px_14px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.9rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                                    />

                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm Password"
                                        required
                                        className="w-full mb-[10px] p-[10px_14px] bg-black/20 border-2 border-[#7B1FA2] rounded-[22px] outline-none text-[0.9rem] transition-all duration-300 hover:border-[#d171ff] focus:border-[#FF5CCE]"
                                    />

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full p-[12px] rounded-[22px] text-[0.9rem] font-bold mt-[2px] bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white shadow-[0_0_22px_rgba(217,70,239,0.45)] hover:shadow-[0_0_34px_rgba(217,70,239,0.65)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {primaryButtonLabel}
                                    </button>
                                </form>
                            )}

                            <div className="mt-3 text-[0.88rem] text-white/70">
                                {mode === 'signin' ? (
                                    <button
                                        type="button"
                                        onClick={() => setMode('signup')}
                                        className="hover:text-[#00FFFF] transition-all"
                                    >
                                        New here? Create Account
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setMode('signin')}
                                        className="hover:text-[#00FFFF] transition-all"
                                    >
                                        Already have an account? Sign In
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="fixed bottom-0 inset-x-0 text-[0.78rem] text-white/70 text-center pb-2">
                © 2026 NEURORIFT
            </footer>

            <style jsx>{`
                .auth-frame {
                    animation: frameGlow 4.5s ease-in-out infinite;
                }

                @keyframes frameGlow {
                    0%,
                    100% {
                        box-shadow: 0 0 24px rgba(212, 175, 55, 0.33);
                    }
                    50% {
                        box-shadow: 0 0 38px rgba(245, 224, 80, 0.5);
                    }
                }
            `}</style>
        </div>
    );
}
