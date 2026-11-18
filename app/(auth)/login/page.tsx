'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Sign in failed');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Sign in failed');
    } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <Link href="/" className="text-sm text-ink2 hover:text-ink">← Back</Link>
      <div className="card mt-4">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="text-sm text-ink2 mt-1">Sign in to your PlayNex account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-bad">{err}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-4 text-sm text-ink2 text-center">
          New here? <Link href="/register" className="text-brand font-semibold">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
