import Link from 'next/link';
const ROLES = [
  { key:'player',  emoji:'👤', title:'Player',        desc:'Find grounds, teammates, gear and competitions.' },
  { key:'staff',   emoji:'🧑‍🏫', title:'Staff',         desc:'Manage assigned tasks and academy work.' },
  { key:'academy', emoji:'🏟️', title:'Academy',       desc:'Run programs, batches, staff and enrolments.' },
  { key:'store',   emoji:'🏪', title:'Sports store',  desc:'Manage inventory, orders and customer requests.' },
] as const;
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2 font-extrabold text-2xl tracking-tight">
          <span className="grid place-items-center w-8 h-8 rounded-[10px] bg-white border border-line">
            <span className="w-4 h-4 rounded-full bg-brand" />
          </span>
          PlayNex
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-ink2 hover:text-ink">Sign in</Link>
          <Link href="/register" className="btn btn-sm">Get started</Link>
        </nav>
      </header>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f5fbfe] via-[#d9f1f9] to-[#a7e0f0] px-7 py-14 sm:px-14 sm:py-16 shadow-[0_18px_45px_rgba(0,48,72,0.16)]">
        <div className="relative max-w-2xl">
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[0.98] tracking-tight">
            Find your game.<br />Find your people. <span className="text-brand">Play more.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink2 max-w-xl">
            Discover nearby grounds, connect with players, find sports equipment and keep up with competitions — all in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn">⚡ Create your account</Link>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-6 -bottom-10 text-[160px] sm:text-[220px] opacity-[0.14] -rotate-[18deg]">🏅</div>
      </section>
      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink2 mb-4">Choose how you use PlayNex</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(r => (
            <Link key={r.key} href={`/register?role=${r.key}`}
                  className="card text-left transition hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(0,48,72,0.2)]">
              <div className="grid place-items-center w-14 h-14 rounded-2xl bg-[#e8f7fb] text-2xl">{r.emoji}</div>
              <h3 className="mt-3 text-lg font-extrabold">{r.title}</h3>
              <p className="mt-1 text-sm text-ink2">{r.desc}</p>
              <span className="mt-4 inline-block text-xs font-bold text-brand">Get started →</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-ink2 text-center">Admin access is assigned by existing administrators only.</p>
      </section>
    </main>
  );
}
