import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
const LABELS: Record<string,string> = { player:'Player', staff:'Staff', academy:'Academy', store:'Store', admin:'Admin' };
const HREF: Record<string,string> = { player:'/player', staff:'/player', academy:'/academy', store:'/store', admin:'/admin' };
export default async function DashboardPage() {
  const session = await verifySession();
  if (!session) redirect('/login');
  const rolesSnap = await adminDb.collection('userRoles').where('userId','==',session.uid).where('status','==','active').get();
  const roles = rolesSnap.docs.map(d => d.data().roleId as string);
  if (!roles.length) return <div className="card">No roles assigned. Contact an administrator.</div>;
  if (roles.length === 1) redirect(HREF[roles[0]] ?? '/player');
  return (
    <div className="card">
      <h1 className="text-2xl font-extrabold">Choose a dashboard</h1>
      <p className="text-sm text-ink2 mt-1">You have access to more than one role.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {roles.map(r => (
          <Link key={r} href={HREF[r] ?? '/player'}
                className="border border-line rounded-2xl p-5 hover:bg-[#f1f8fa] transition">
            <div className="text-lg font-extrabold">{LABELS[r] ?? r}</div>
            <div className="text-sm text-ink2 mt-1">Open {LABELS[r] ?? r} dashboard →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
