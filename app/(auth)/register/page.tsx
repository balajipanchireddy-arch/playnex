'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get('role') ?? 'player') as 'player'|'staff'|'academy'|'store';
  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try { await sendEmailVerification(cred.user); } catch {}
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, fullName, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Registration failed');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Registration failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="card mt-4">
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="text-sm text-ink2 mt-1">Join PlayNex in under a minute.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label">I am a</label>
          <select className="input" value={role} onChange={e=>setRole(e.target.value as any)}>
            <option value="player">Player</option>
            <option value="staff">Staff</option>
            <option value="academy">Academy</option>
            <option value="store">Store</option>
          </select>
        </div>
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={fullName} onChange={e=>setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-sm text-ink2 text-center">
        Already have an account? <Link href="/login" className="text-brand font-semibold">Sign in</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <Link href="/" className="text-sm text-ink2 hover:text-ink">← Back</Link>
      <Suspense fallback={<div className="card mt-4 text-center py-10">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
