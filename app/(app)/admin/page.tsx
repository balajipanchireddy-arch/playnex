'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ShieldAlert,
  Trophy, 
  Landmark, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ArrowUpRight, 
  MapPin, 
  X,
  Sparkles,
  Users
} from 'lucide-react';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function fetchPending() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verifications');
      if (res.status === 403 || res.status === 401) {
        setIsForbidden(true);
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setRequests(data.data);
      } else {
        notify('err', data.error?.message || 'Error loading verification queue.');
      }
    } catch {
      notify('err', 'Network error fetching pending requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    fetchPending(); 
  }, []);

  async function handleReview(id: string, type: 'store' | 'academy', status: 'approved' | 'rejected') {
    setReviewingId(id);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, status })
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `${type === 'store' ? 'Store' : 'Academy'} ${status} successfully!`);
        setRequests(requests.filter(r => r.id !== id));
      } else {
        notify('err', data.error?.message || 'Review action failed.');
      }
    } catch {
      notify('err', 'Network error during review.');
    } finally {
      setReviewingId(null);
    }
  }

  if (isForbidden) {
    return (
      <div className="card max-w-md mx-auto text-center py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
          Administrator privileges are required to view and manage the master control portal.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" className="btn btn-secondary text-xs">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const portalCards = [
    {
      title: 'Player Arena',
      desc: 'Ground bookings, tournaments, and equipment catalog',
      href: '/player',
      icon: Trophy,
      color: 'from-amber-500 to-orange-500',
      badge: 'ATHLETES'
    },
    {
      title: 'Academy Management',
      desc: 'Venue listings, hourly booking slots, and tournament hosting',
      href: '/academy',
      icon: Landmark,
      color: 'from-emerald-500 to-teal-500',
      badge: 'GROUNDS'
    },
    {
      title: 'Sports Store Portal',
      desc: 'Inventory control, product catalog, and order fulfillment',
      href: '/store',
      icon: ShoppingBag,
      color: 'from-sky-500 to-blue-500',
      badge: 'COMMERCE'
    },
  ];

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
          notification.type === 'ok' 
            ? 'bg-emerald-900/90 text-white border-emerald-700/80' 
            : 'bg-rose-900/90 text-white border-rose-700/80'
        }`}>
          {notification.type === 'ok' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notification.text}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 rounded-lg p-1 text-white/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Admin Hero Header */}
      <div className="card bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800 p-6 sm:p-8 relative overflow-hidden">
        <div 
          aria-hidden 
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" 
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-lg shadow-purple-500/25">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 border border-white/10 mb-1">
                <Sparkles className="h-3 w-3" />
                Root Authority
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Admin Master Control
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Ecosystem oversight, partner approvals, and unified portal administration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-3.5 py-1 text-xs font-extrabold text-purple-300">
              {requests.length} Pending Verifications
            </span>
          </div>
        </div>
      </div>

      {/* Quick Jump Portals */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">
          Direct Portal Access
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {portalCards.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link
                key={portal.href}
                href={portal.href}
                className="group card card-hover p-6 border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${portal.color} text-white flex items-center justify-center shadow-md transition group-hover:scale-105`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="badge badge-neutral text-[10px] font-extrabold">
                      {portal.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 transition">
                    {portal.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {portal.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-600">
                  <span>Enter Portal</span>
                  <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Verification Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Pending Partner Verifications ({requests.length})
            </h2>
          </div>
          <button 
            onClick={fetchPending} 
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            Refresh queue
          </button>
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 mt-3">Loading pending partner requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="card text-center py-12">
            <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">Verification Queue Clear</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All sports stores and academy grounds are up to date. No pending approvals required.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const isStore = req.type === 'store';
              const isBusy = reviewingId === req.id;
              return (
                <div 
                  key={req.id} 
                  className="card p-5 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isStore ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isStore ? <ShoppingBag className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-base text-slate-900">{req.displayName}</h4>
                        <span className={`badge text-[10px] uppercase font-black ${
                          isStore ? 'badge-brand' : 'badge-ok'
                        }`}>
                          {req.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">ID: {req.id}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {req.address || 'Address pending update'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleReview(req.id, req.type, 'approved')}
                      disabled={isBusy}
                      className="btn btn-sm btn-emerald text-xs"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(req.id, req.type, 'rejected')}
                      disabled={isBusy}
                      className="btn-danger btn-sm text-xs"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
