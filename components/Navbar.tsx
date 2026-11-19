'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Zap, 
  LayoutDashboard, 
  Trophy, 
  Landmark, 
  ShoppingBag, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

interface NavbarProps {
  roles: string[];
  isAdmin: boolean;
  userEmail?: string;
  signOutAction: () => Promise<void>;
}

export default function Navbar({ roles, isAdmin, userEmail, signOutAction }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    {
      href: '/dashboard',
      label: 'Hub',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      href: '/player',
      label: 'Player Arena',
      icon: Trophy,
      visible: isAdmin || roles.includes('player'),
    },
    {
      href: '/academy',
      label: 'Academy & Turfs',
      icon: Landmark,
      visible: isAdmin || roles.includes('academy'),
    },
    {
      href: '/store',
      label: 'Sports Store',
      icon: ShoppingBag,
      visible: isAdmin || roles.includes('store'),
    },
    {
      href: '/admin',
      label: 'Admin Control',
      icon: ShieldCheck,
      visible: isAdmin,
    },
  ].filter(link => link.visible);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Logo */}
        <div className="flex items-center gap-8">
          <Link 
            href="/dashboard" 
            className="group flex items-center gap-2.5 transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white shadow-md shadow-brand-500/25 transition group-hover:scale-105 group-hover:shadow-glow">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-brand-600 transition">
                Play<span className="text-brand-600">Nex</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Sports Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/10 border border-brand-200/60'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-slate-600'}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Notification Bell + User Pill & Sign Out Action */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <NotificationBell />

          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3.5 py-1.5 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <UserCheck className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700 max-w-[150px] truncate">
                {userEmail || (isAdmin ? 'Admin' : roles.join(', '))}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-brand-700 border border-slate-200 shadow-xs uppercase">
                {isAdmin ? 'ADMIN' : roles[0] || 'USER'}
              </span>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                title="Sign out of account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs active:bg-slate-50"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200/80 bg-white/95 px-4 pt-3 pb-6 shadow-xl backdrop-blur-lg animate-in slide-in-from-top duration-200">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/60">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <p className="font-bold text-slate-800">{userEmail || 'Signed in'}</p>
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                  Role: {isAdmin ? 'ADMIN' : roles.join(', ')}
                </p>
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </form>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl p-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 border border-brand-200/60'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {link.label}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
