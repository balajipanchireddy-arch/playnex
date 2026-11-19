'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { 
  Zap, 
  Mail, 
  Lock, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  ArrowRight 
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Sign in failed');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Invalid email or password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 relative">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to homepage
        </Link>

        <div className="card shadow-xl border-slate-200/90 p-8 sm:p-9 relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div 
            aria-hidden 
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" 
          />

          {/* Brand header */}
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/playnex-mark.png"
              alt="PlayNex Logo"
              className="h-11 w-11 rounded-xl object-cover shadow-md"
            />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Welcome back
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in to your PlayNex account
              </p>
            </div>
          </div>

          {err && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  className="input pl-10"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  className="input pl-10"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn w-full mt-2" 
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account yet?{' '}
              <Link 
                href="/register" 
                className="font-bold text-brand-600 hover:text-brand-700 transition"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
