import { redirect } from 'next/navigation';
import { verifySession, clearSessionCookie } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import Navbar from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const rolesSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', session.uid)
    .where('status', '==', 'active')
    .get();

  const roles = rolesSnap.docs.map((d: any) => d.data().roleId as string);
  const isAdmin = roles.includes('admin');

  async function handleSignOut() {
    'use server';
    clearSessionCookie();
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      <Navbar 
        roles={roles} 
        isAdmin={isAdmin} 
        userEmail={session.email} 
        signOutAction={handleSignOut} 
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-slate-200/80 bg-white/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} PlayNex. The Connected Sports Ecosystem.</p>
          <p className="text-slate-400">Play harder. Manage smarter. Grow faster.</p>
        </div>
      </footer>
    </div>
  );
}
