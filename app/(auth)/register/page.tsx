'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { 
  Zap, 
  User, 
  Mail, 
  Lock, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Trophy,
  Landmark,
  ShoppingBag
} from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawRole = params.get('role');
  const initialRole = (rawRole === 'academy' || rawRole === 'store' ? rawRole : 'player') as 'player' | 'academy' | 'store';
  
  const [role, setRole] = useState<'player' | 'academy' | 'store'>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { 
        await sendEmailVerification(cred.user); 
      } catch {}
      
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, fullName, role }),
      });
      
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Registration failed');
      
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  const rolePills = [
    { id: 'player', label: 'Player', icon: Trophy, desc: 'Play & Book' },
    { id: 'academy', label: 'Academy', icon: Landmark, desc: 'Manage Grounds' },
    { id: 'store', label: 'Store', icon: ShoppingBag, desc: 'Sell Gear' },
  ] as const;

  return (
    <div className="card shadow-xl border-slate-200/90 p-8 sm:p-9 relative overflow-hidden">
      {/* Decorative Blur */}
      <div 
        aria-hidden 
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" 
      />

      {/* Brand header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white shadow-md shadow-brand-500/25">
          <Zap className="h-5 w-5 fill-current" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Create account
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Join the PlayNex sports network today
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
        {/* Role Selector Grid */}
        <div>
          <label className="label">I am joining as a</label>
          <div className="grid grid-cols-3 gap-2.5">
            {rolePills.map((item) => {
              const Icon = item.icon;
              const isSelected = role === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setRole(item.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-1 ${isSelected ? 'text-brand-600' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold leading-tight">{item.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 hidden sm:inline">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Full Name or Organization</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <input
              className="input pl-10"
              required
              placeholder="e.g. Alex Morgan or Apex Arena"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        </div>

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
          <label className="label">Password</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              className="input pl-10"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
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
              <span>Creating your account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500">
          Already registered?{' '}
          <Link 
            href="/login" 
            className="font-bold text-brand-600 hover:text-brand-700 transition"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 relative">
      <div className="w-full max-w-md">
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to homepage
        </Link>
        <Suspense fallback={<div className="card text-center py-12">Loading registration...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </main>
  );
}
