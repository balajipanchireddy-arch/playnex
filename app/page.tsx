import Link from 'next/link';
import { 
  Zap, 
  Trophy, 
  Landmark, 
  ShoppingBag, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Users,
  Compass
} from 'lucide-react';

const ROLES = [
  { 
    key: 'player',  
    icon: Trophy,
    title: 'Player & Athlete',        
    desc: 'Discover nearby turfs, book instant hourly slots, enter tournaments, and team up with local players.',
    badge: 'Popular',
    color: 'from-amber-500 to-orange-500',
    highlight: 'Find Matches & Gear'
  },
  { 
    key: 'academy', 
    icon: Landmark, 
    title: 'Academy & Grounds',       
    desc: 'List your sports facilities, manage live hourly time-slots, toggle arena closures, and host tournaments.',
    badge: 'For Owners',
    color: 'from-emerald-500 to-teal-600',
    highlight: 'Manage Venues & Slots'
  },
  { 
    key: 'store',   
    icon: ShoppingBag, 
    title: 'Sports Store',  
    desc: 'Showcase authentic sporting gear, manage live stock levels, and fulfill orders directly to local athletes.',
    badge: 'Merchants',
    color: 'from-sky-500 to-blue-600',
    highlight: 'Sell Equipment'
  },
] as const;

const FEATURES = [
  {
    icon: MapPin,
    title: 'Live Ground Booking',
    desc: 'Browse multi-sport turfs with real-time hourly availability from morning to night.'
  },
  {
    icon: Calendar,
    title: 'Competitive Tournaments',
    desc: 'Register for local tournaments, cups, and leagues with entry fee tracking.'
  },
  {
    icon: ShoppingBag,
    title: 'Curated Sports Gear',
    desc: 'Order verified equipment, apparel, and accessories directly from trusted pro shops.'
  },
  {
    icon: Users,
    title: 'Player Matchmaking',
    desc: 'Toggle your availability status to connect with teams and athletes seeking players.'
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <img src="/playnex-mark.png" alt="PlayNex Logo" className="h-10 w-10 rounded-xl object-cover shadow-md transition group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Play<span className="text-brand-600">Nex</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                The Sports Arena
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              Sign in
            </Link>
            <Link 
              href="/register" 
              className="btn btn-sm shadow-sm hover:shadow"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 px-6 py-14 sm:px-16 sm:py-20 text-white shadow-2xl border border-slate-800 overflow-hidden">
              {/* Decorative Glow Elements */}
              <div 
                aria-hidden 
                className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-500/20 blur-3xl" 
              />
              <div 
                aria-hidden 
                className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl" 
              />

              <div className="relative max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-brand-300 border border-white/10 mb-6 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                  <span>The Premier Sports Community Network</span>
                </div>

                <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight">
                  Find your game.<br />
                  Find your people.<br />
                  <span className="bg-gradient-to-r from-brand-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                    Play without limits.
                  </span>
                </h1>

                <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                  The unified ecosystem for passionate athletes, turf arenas, and local sports shops. Book hourly venues, compete in tournaments, and equip yourself with top gear.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link 
                    href="/register" 
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-teal-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110 active:scale-98"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    Join PlayNex Free
                  </Link>
                  <Link 
                    href="/login" 
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-base font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition backdrop-blur-sm"
                  >
                    Member Sign In
                  </Link>
                </div>

                {/* Trust stats pill */}
                <div className="mt-10 pt-8 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-6 text-slate-300">
                  <div>
                    <p className="text-2xl font-black text-white">100%</p>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time Slot Booking</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">Multi-Sport</p>
                    <p className="text-xs text-slate-400 mt-0.5">Football, Cricket & More</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-2xl font-black text-white">Verified</p>
                    <p className="text-xs text-slate-400 mt-0.5">Grounds & Pro Shops</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles Selection Section */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Role Specific Portals
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                  Choose how you use PlayNex
                </h2>
              </div>
              <p className="text-sm text-slate-500 max-w-md">
                Whether you are an active athlete or a venue manager, PlayNex is tailor-made for your sporting workflow.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <Link 
                    key={r.key} 
                    href={`/register?role=${r.key}`}
                    className="group card card-hover flex flex-col justify-between p-7 border-slate-200/90 relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${r.color} text-white flex items-center justify-center shadow-md transition group-hover:scale-110`}>
                          <Icon className="h-7 w-7" />
                        </div>
                        <span className="badge badge-neutral text-[10px] font-extrabold uppercase">
                          {r.badge}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand-600 transition">
                        {r.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">
                        {r.desc}
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition">
                        {r.highlight}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:translate-x-1 transition">
                        Get Started
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-center">
              <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                Administrative privileges are managed by authorized platform coordinators.
              </p>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="py-12 bg-white border-y border-slate-200/70">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Engineered for Performance
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Everything you need to play, host, and shop
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition hover:bg-white hover:border-slate-200 hover:shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-base text-slate-900">{f.title}</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10 text-slate-500 text-xs">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <img src="/playnex-mark.png" alt="PlayNex Logo" className="h-6 w-6 rounded-md object-cover" />
            PlayNex
          </div>
          <p>© {new Date().getFullYear()} PlayNex Platform. All rights reserved.</p>
          <div className="flex gap-4 font-medium">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="hover:text-slate-900">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
