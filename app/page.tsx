import Link from 'next/link';
import {
  Zap,
  Users,
  GraduationCap,
  Store,
  Trophy,
  ArrowRight,
  MapPin,
  Package,
  Calendar,
  Sparkles,
  ShieldCheck,
  Gamepad2,
  Flame,
  ChevronRight,
  Bot
} from 'lucide-react';

const ROLES = [
  {
    key: 'player',
    icon: Users,
    title: 'Player & Athlete Arena',
    desc: 'Discover nearby turfs, book instant hourly slots, enter tournaments, and team up with local players.',
    badge: 'Popular',
    iconBg: 'bg-blue-50 text-blue-600',
    highlight: 'Find Matches & Gear'
  },
  {
    key: 'academy',
    icon: GraduationCap,
    title: 'Academy & Venues',
    desc: 'List your sports facilities, manage live hourly time-slots, toggle arena closures, and host championships.',
    badge: 'For Operators',
    iconBg: 'bg-emerald-50 text-emerald-600',
    highlight: 'Manage Venues & Slots'
  },
  {
    key: 'store',
    icon: Store,
    title: 'Pro Sports Store',
    desc: 'Showcase authentic sporting gear, manage live stock levels, and fulfill orders directly to local athletes.',
    badge: 'Merchants',
    iconBg: 'bg-purple-50 text-purple-600',
    highlight: 'Sell Equipment'
  },
] as const;

const SHOWCASE_GAMES = [
  {
    name: 'Football / Turf Soccer',
    category: 'Team Sports',
    tag: 'Trending',
    icon: '⚽',
    image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Badminton Championship',
    category: 'Racquet Sports',
    tag: 'Daily Open',
    icon: '🏸',
    image: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Box Cricket League',
    category: 'Team Sports',
    tag: 'Weekend Cup',
    icon: '🏏',
    image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Battlegrounds Mobile (BGMI)',
    category: 'Esports',
    tag: 'Prize Pool',
    icon: '🎮',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Valorant Showdown',
    category: 'Esports',
    tag: '5v5 Ranked',
    icon: '🎯',
    image: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Basketball Streetball',
    category: 'Team Sports',
    tag: '3v3 Hoops',
    icon: '🏀',
    image: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=800&auto=format&fit=crop&q=80',
  },
];

const FEATURES = [
  {
    icon: MapPin,
    title: 'Live Ground Booking',
    desc: 'Browse multi-sport turfs with real-time hourly availability matrices from morning to night.'
  },
  {
    icon: Trophy,
    title: 'Competitive Tournaments',
    desc: 'Register for local tournaments, cups, and esports leagues with transparent bracket tracking.'
  },
  {
    icon: Package,
    title: 'Curated Pro Gear',
    desc: 'Order verified equipment, apparel, and accessories directly from trusted merchant sports shops.'
  },
  {
    icon: Bot,
    title: 'PlayNex AI Co-Pilot',
    desc: 'Intelligent multi-role assistant to guide tournament rules, booking management, and live stats.'
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#172033]">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative">
              <img
                src="/playnex-mark.png"
                alt="PlayNex Logo"
                className="relative h-10 w-10 rounded-xl object-cover shadow-xs border border-[#E2E8F0] transition group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-[#172033] group-hover:text-[#2563EB] transition">
                Play<span className="text-[#2563EB]">Nex</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Sports & Gaming
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-[#64748B] hover:text-[#172033] transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn btn-sm"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="relative rounded-3xl bg-white px-6 py-12 sm:px-14 sm:py-16 text-[#172033] shadow-sm border border-[#E2E8F0] overflow-hidden">
              <div className="relative max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3.5 py-1 text-xs font-semibold text-[#1E40AF] border border-blue-200 mb-6">
                  <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span>The Premier Sports & Gaming Tech Ecosystem</span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-black leading-[1.12] tracking-tight text-[#172033]">
                  Elevate your game.<br />
                  Dominate your arena.<br />
                  <span className="text-[#2563EB]">
                    Play without boundaries.
                  </span>
                </h1>

                <p className="mt-5 text-base sm:text-lg text-[#64748B] max-w-2xl leading-relaxed">
                  The unified platform connecting passionate athletes, turf arenas, and local pro sports shops. Book hourly venues, compete in tournaments, equip authentic gear, and level up with PlayNex AI.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/register"
                    className="btn px-6 py-3 text-base"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    Join PlayNex Free
                  </Link>
                  <Link
                    href="/login"
                    className="btn-secondary px-6 py-3 text-base"
                  >
                    Member Sign In
                  </Link>
                </div>

                {/* Trust stats strip */}
                <div className="mt-10 pt-8 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-2xl font-black text-[#172033]">100%</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Real-time Slot Booking</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#2563EB]">Multi-Sport</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Physical + Esports</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-purple-700">AI Powered</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Smart Match Assistant</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-700">Verified</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Arenas & Merchants</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Explore Games & Esports Showcase */}
        <section className="py-12 sm:py-16 bg-white border-y border-[#E2E8F0]">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                  <Gamepad2 className="h-4 w-4" />
                  Centralized Game Management
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] mt-1">
                  Explore Active Games & Esports
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] max-w-md">
                Tournaments, hourly matches, and verified gear organized across top sports and competitive gaming titles.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SHOWCASE_GAMES.map((game, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="h-44 w-full relative overflow-hidden bg-slate-100">
                    <img
                      src={game.image}
                      alt={game.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 right-3 badge bg-white/90 text-[#172033] border border-[#E2E8F0] shadow-xs text-[10px] uppercase font-bold">
                      {game.tag}
                    </span>
                    <span className="absolute bottom-3 left-4 text-2xl drop-shadow">
                      {game.icon}
                    </span>
                  </div>

                  <div className="p-5">
                    <span className="badge badge-neutral text-[10px] mb-2 uppercase">
                      {game.category}
                    </span>
                    <h3 className="text-base font-bold text-[#172033] group-hover:text-[#2563EB] transition">
                      {game.name}
                    </h3>
                    <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                      <span className="text-[#64748B] flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-amber-500" />
                        Championships active
                      </span>
                      <Link
                        href="/register?role=player"
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition"
                      >
                        Compete <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles Selection Section */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
                  Role Specific Portals
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] mt-1">
                  Choose how you experience PlayNex
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] max-w-md">
                Whether you are an active athlete, turf manager, or gear merchant, PlayNex delivers a tailored workspace.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.key}
                    href={`/register?role=${r.key}`}
                    className="group card card-hover flex flex-col justify-between p-7 border-[#E2E8F0] bg-white relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <div className={`w-12 h-12 rounded-2xl ${r.iconBg} flex items-center justify-center transition group-hover:scale-105`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="badge badge-brand text-[10px] font-bold uppercase">
                          {r.badge}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-[#172033] group-hover:text-[#2563EB] transition">
                        {r.title}
                      </h3>
                      <p className="text-sm text-[#64748B] mt-2.5 leading-relaxed">
                        {r.desc}
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#172033] transition">
                        {r.highlight}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] group-hover:translate-x-1 transition">
                        Get Started
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-4 text-center">
              <p className="text-xs text-[#64748B] flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                Administrative privileges and moderation are managed by verified platform coordinators.
              </p>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="py-12 bg-white border-y border-[#E2E8F0]">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
                Engineered for Performance
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] mt-1">
                Everything you need to play, host, and shop
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="rounded-2xl border border-[#E2E8F0] bg-[#F5F7FA] p-6 transition hover:bg-white hover:shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-base text-[#172033]">{f.title}</h3>
                    <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8 text-[#64748B] text-xs">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-[#172033] text-sm">
            <img src="/playnex-mark.png" alt="PlayNex Logo" className="h-6 w-6 rounded-md object-cover border border-[#E2E8F0]" />
            Play<span className="text-[#2563EB]">Nex</span>
          </div>
          <p>© {new Date().getFullYear()} PlayNex Platform. The Connected Sports & Gaming Ecosystem.</p>
          <div className="flex gap-4 font-medium">
            <Link href="/login" className="hover:text-[#172033] transition">Sign in</Link>
            <Link href="/register" className="hover:text-[#172033] transition">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
