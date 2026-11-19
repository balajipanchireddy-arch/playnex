import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifySession, clearSessionCookie } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', session.uid).where('status', '==', 'active').get();
  const roles = rolesSnap.docs.map(d => d.data().roleId as string);
  const isAdmin = roles.includes('admin');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-[#075779]/95 backdrop-blur text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-extrabold text-xl tracking-tight">PlayNex</Link>
          
          <nav className="hidden md:flex gap-4 text-sm font-semibold">
            {/* Admins can see every portal. Normal users only see their specific portals. */}
            {(isAdmin || roles.includes('player')) && <Link href="/player" className="hover:text-brand transition">Player</Link>}
            {(isAdmin || roles.includes('staff')) && <Link href="/staff" className="hover:text-brand transition">Staff</Link>}
            {(isAdmin || roles.includes('academy')) && <Link href="/academy" className="hover:text-brand transition">Academy</Link>}
            {(isAdmin || roles.includes('store')) && <Link href="/store" className="hover:text-brand transition">Store</Link>}
            {isAdmin && <Link href="/admin" className="hover:text-brand transition">Admin</Link>}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/70 hidden sm:inline">Role: {isAdmin ? 'ADMIN' : roles.join(', ')}</span>
          <form action={async () => { 'use server'; clearSessionCookie(); redirect('/login'); }}>
            <button className="bg-white/15 border border-white/30 rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-white/25 transition">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
