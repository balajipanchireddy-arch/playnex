'use client';

import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Store,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserCheck,
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

  // Staff is now inside Academy — no separate top-level Staff link
  const navLinks = [
    {
      href: '/dashboard',
      label: 'Hub',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      href: '/player',
      label: 'Player',
      iconImage: '/icons/players.jpg',
      icon: Users,
      visible: isAdmin || roles.includes('player'),
    },
    {
      href: '/academy',
      label: 'Academy',
      iconImage: '/icons/academy.jpg',
      icon: GraduationCap,
      visible: isAdmin || roles.includes('academy') || roles.includes('staff'),
    },
    {
      href: '/store',
      label: 'Store',
      iconImage: '/icons/store.png',
      icon: Store,
      visible: isAdmin || roles.includes('store'),
    },
    {
      href: '/admin',
      label: 'Admin',
      icon: ShieldCheck,
      visible: isAdmin,
    },
  ].filter((link) => link.visible);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E7EB] bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand & Logo */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <Link href="/dashboard" className="group flex items-center gap-2.5 transition">
            <div className="relative transition group-hover:scale-105 shrink-0">
              <Image
                src="/playnex-mark.png"
                alt="PlayNex Logo"
                width={36}
                height={36}
                className="relative h-9 w-9 rounded-xl object-cover shadow-xs border border-[#E5E7EB]"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-[#101828] group-hover:text-[#16A36A] transition">
                Play<span className="text-[#16A36A]">Nex</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Sports &amp; Gaming
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + '/');

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#E8F5EE] text-[#0E7055] border border-green-200'
                      : 'text-[#667085] hover:bg-slate-50 hover:text-[#172033]'
                  }`}
                >
                  {link.iconImage ? (
                    <img
                      src={link.iconImage}
                      alt={link.label}
                      className="h-5 w-5 rounded-md object-cover border border-[#E5E7EB] shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />

          <div className="hidden sm:flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-slate-50 px-3 py-1">
              <span className="flex h-2 w-2 rounded-full bg-[#16A36A] animate-pulse" />
              <UserCheck className="h-3.5 w-3.5 text-[#667085]" />
              <span className="text-xs font-semibold text-[#172033] max-w-[120px] lg:max-w-[160px] truncate">
                {userEmail || (isAdmin ? 'Admin' : roles.join(', '))}
              </span>
              <span className="rounded-full bg-[#C5E9D7] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#0E7055] border border-green-200 uppercase">
                {isAdmin ? 'ADMIN' : roles[0] || 'USER'}
              </span>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-semibold text-[#667085] shadow-xs hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#172033] shadow-xs active:bg-slate-100"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 pt-3 pb-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#16A36A] animate-pulse" />
              <div className="text-xs">
                <p className="font-bold text-[#172033] max-w-[180px] truncate">
                  {userEmail || 'Signed in'}
                </p>
                <p className="text-[10px] text-[#16A36A] uppercase font-bold tracking-wider">
                  Role: {isAdmin ? 'ADMIN' : roles.join(', ')}
                </p>
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </form>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + '/');

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl p-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#E8F5EE] text-[#0E7055] border border-green-200'
                      : 'text-[#667085] hover:bg-slate-50 hover:text-[#172033]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {link.iconImage ? (
                      <img
                        src={link.iconImage}
                        alt={link.label}
                        className="h-7 w-7 rounded-lg object-cover border border-[#E5E7EB] shadow-2xs shrink-0"
                      />
                    ) : (
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive
                            ? 'bg-[#16A36A] text-white'
                            : 'bg-slate-100 text-[#667085]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    {link.label}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#98A2B3]" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
