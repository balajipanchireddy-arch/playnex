import { redirect } from 'next/navigation';
import { verifySession, clearSessionCookie } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { isAdmin as hasAdminAccess } from '@/lib/auth/admin';
import Navbar from '@/components/Navbar';
import WelcomeNotificationModal from '@/components/WelcomeNotificationModal';
import PlayNexAI from '@/components/PlayNexAI';

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
  const isAdmin = await hasAdminAccess(session.uid);

  // Both confirmed platform administrators get admin nav without redundant role docs.
  if (isAdmin && !roles.includes('admin')) {
    roles.push('admin');
  }

  async function handleSignOut() {
    'use server';
    clearSessionCookie();
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#172033]">
      <Navbar
        roles={roles}
        isAdmin={isAdmin}
        userEmail={session.email}
        signOutAction={handleSignOut}
      />

      <WelcomeNotificationModal />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>

      {/* Floating PlayNex AI Assistant */}
      <PlayNexAI />

      <footer className="border-t border-[#E5E7EB] bg-white py-6 text-center text-xs text-[#667085]">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} PlayNex. The Connected Sports &amp; Gaming Ecosystem.</p>
          <p className="text-[#667085]">Play harder. Manage smarter. Grow faster.</p>
        </div>
      </footer>
    </div>
  );
}
