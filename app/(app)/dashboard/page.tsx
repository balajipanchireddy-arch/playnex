import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { 
  Trophy, 
  Landmark, 
  ShoppingBag, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RoleConfig {
  title: string;
  desc: string;
  href: string;
  icon: any;
  color: string;
  badge: string;
}

const ROLE_DETAILS: Record<string, RoleConfig> = {
  player: {
    title: 'Player Arena',
    desc: 'Browse turfs, reserve hourly match slots, enter tournaments, and order sports gear.',
    href: '/player',
    icon: Trophy,
    color: 'from-amber-500 to-orange-600',
    badge: 'ATHLETE',
  },
  academy: {
    title: 'Academy & Grounds',
    desc: 'Manage your sporting venues, schedule hourly availability, and host championship tournaments.',
    href: '/academy',
    icon: Landmark,
    color: 'from-emerald-500 to-teal-600',
    badge: 'OPERATOR',
  },
  store: {
    title: 'Sports Store & Gear',
    desc: 'Maintain inventory levels, track customer equipment orders, and manage fulfilled shipments.',
    href: '/store',
    icon: ShoppingBag,
    color: 'from-sky-500 to-blue-600',
    badge: 'MERCHANT',
  },
  admin: {
    title: 'Admin Master Control',
    desc: 'Platform moderation, pending store/academy verification approvals, and ecosystem metrics.',
    href: '/admin',
    icon: ShieldCheck,
    color: 'from-purple-500 to-indigo-600',
    badge: 'MANAGEMENT',
  },
};

export default async function DashboardPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const rolesSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', session.uid)
    .where('status', '==', 'active')
    .get();

  const rawRoles = rolesSnap.docs.map((d: any) => d.data().roleId as string);
  // Exactly 4 portals: player, academy, store, admin
  const roles = rawRoles.filter((r: string) => r !== 'staff');

  if (!roles.length) {
    return (
      <div className="card max-w-lg mx-auto text-center py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Active Roles Assigned</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          Your account is currently waiting for role allocation. Please reach out to an administrator for permissions.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn btn-secondary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  // If user is Admin, direct to admin overview
  if (roles.includes('admin')) {
    redirect('/admin');
  }

  // If user only has one active role, route immediately to that view
  if (roles.length === 1) {
    redirect(ROLE_DETAILS[roles[0]]?.href ?? '/player');
  }

  // If user has multiple roles, show an executive selection hub
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-300 border border-white/10 mb-4 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Multi-Role Access Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back to PlayNex
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300">
            Select the workspace you would like to manage for this session. You can switch portals anytime from the top navigation.
          </p>
        </div>
        <div 
          aria-hidden 
          className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" 
        />
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">
          Available Workspaces ({roles.length})
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {roles.map((roleKey: string) => {
            const config = ROLE_DETAILS[roleKey];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <Link
                key={roleKey}
                href={config.href}
                className="group card card-hover flex flex-col justify-between p-6 sm:p-7 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${config.color} text-white flex items-center justify-center shadow-md transition group-hover:scale-110`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="badge badge-neutral text-[10px] font-extrabold">
                      {config.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand-600 transition">
                    {config.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    {config.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-600">
                  <span>Launch Workspace</span>
                  <ArrowRight className="h-4 w-4 transition transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
