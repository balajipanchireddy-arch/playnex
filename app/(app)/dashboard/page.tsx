import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { isSuperAdmin } from '@/lib/auth/admin';
import { 
  Trophy, 
  Landmark, 
  ShoppingBag, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles,
  HelpCircle,
  ClipboardCheck
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RoleConfig {
  title: string;
  desc: string;
  href: string;
  icon: any;
  iconBg: string;
  badge: string;
}

const ROLE_DETAILS: Record<string, RoleConfig> = {
  player: {
    title: 'Player Arena',
    desc: 'Browse turfs, reserve hourly match slots, enter tournaments, and order sports gear.',
    href: '/player',
    icon: Trophy,
    iconBg: 'bg-blue-50 text-blue-600',
    badge: 'ATHLETE',
  },
  staff: {
    title: 'Staff Operations',
    desc: 'On-ground athlete check-ins, arena facility oversight, and real-time slot monitoring.',
    href: '/staff',
    icon: ClipboardCheck,
    iconBg: 'bg-teal-50 text-teal-700',
    badge: 'STAFF',
  },
  academy: {
    title: 'Academy & Venues',
    desc: 'Manage your sporting venues, schedule hourly availability, and host championship tournaments.',
    href: '/academy',
    icon: Landmark,
    iconBg: 'bg-emerald-50 text-emerald-600',
    badge: 'OPERATOR',
  },
  store: {
    title: 'Sports Store & Gear',
    desc: 'Maintain inventory levels, track customer equipment orders, and manage fulfilled shipments.',
    href: '/store',
    icon: ShoppingBag,
    iconBg: 'bg-purple-50 text-purple-600',
    badge: 'MERCHANT',
  },
  admin: {
    title: 'Admin Master Control',
    desc: 'Platform moderation, pending store/academy verification approvals, and ecosystem metrics.',
    href: '/admin',
    icon: ShieldCheck,
    iconBg: 'bg-amber-50 text-amber-700',
    badge: 'MANAGEMENT',
  },
};

export default async function DashboardPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  // Super Admin is identified using the trusted Firebase UID.
  if (await isSuperAdmin(session.uid)) {
    redirect('/admin');
  }

  const rolesSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', session.uid)
    .where('status', '==', 'active')
    .get();

  const rawRoles = rolesSnap.docs.map((d: any) => d.data().roleId as string);
  const roles = rawRoles;

  if (!roles.length) {
    return (
      <div className="card max-w-lg mx-auto text-center py-12 px-6 border-[#E2E8F0] bg-white">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-[#172033]">No Active Roles Assigned</h2>
        <p className="text-sm text-[#64748B] mt-2 max-w-sm mx-auto">
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

  if (roles.includes('admin')) {
    redirect('/admin');
  }

  if (roles.length === 1) {
    redirect(ROLE_DETAILS[roles[0]]?.href ?? '/player');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="card bg-white text-[#172033] p-8 sm:p-10 shadow-sm border border-[#E2E8F0] relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-semibold text-[#1E40AF] border border-blue-200 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
            <span>Multi-Role Access Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#172033]">
            Welcome back to Play<span className="text-[#2563EB]">Nex</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#64748B] leading-relaxed">
            Select the workspace you would like to manage for this session. You can switch portals anytime from the top navigation.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">
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
                className="group card card-hover flex flex-col justify-between p-6 sm:p-7 border-[#E2E8F0] bg-white relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${config.iconBg} flex items-center justify-center transition group-hover:scale-105`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="badge badge-brand text-[10px] font-bold uppercase">
                      {config.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#172033] group-hover:text-[#2563EB] transition">
                    {config.title}
                  </h3>
                  <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
                    {config.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-bold text-[#2563EB]">
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
