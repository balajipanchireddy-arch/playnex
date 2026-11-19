'use client';

import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Trophy, 
  Megaphone, 
  X, 
  ArrowRight, 
  CheckCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function WelcomeNotificationModal() {
  const [unreadNotif, setUnreadNotif] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function checkUnread() {
      // Check if user already saw popup in this session
      const hasSeenSession = sessionStorage.getItem('playnex_welcome_notif_seen');
      if (hasSeenSession) return;

      try {
        const res = await fetch('/api/notifications');
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          const unread = json.data.find((n: any) => !n.read);
          if (unread) {
            setUnreadNotif(unread);
            setShow(true);
            sessionStorage.setItem('playnex_welcome_notif_seen', 'true');
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    checkUnread();
  }, []);

  async function handleDismiss(markRead: boolean) {
    if (markRead && unreadNotif?.id) {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: unreadNotif.id }),
      });
    }
    setShow(false);
  }

  if (!show || !unreadNotif) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-md border-slate-200/90 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Glow Accent */}
        <div 
          aria-hidden 
          className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-brand-500/15 blur-2xl pointer-events-none" 
        />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-brand-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-ping" />
                Latest PlayNex Alert
              </span>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Welcome Back!
              </h3>
            </div>
          </div>

          <button
            onClick={() => handleDismiss(false)}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <span className="badge badge-brand text-[10px] uppercase font-black">
              {unreadNotif.category || 'Announcement'}
            </span>
            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {unreadNotif.createdAt ? new Date(unreadNotif.createdAt).toLocaleDateString() : 'Today'}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900">
            {unreadNotif.title}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            {unreadNotif.message}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 relative z-10">
          <button
            onClick={() => handleDismiss(false)}
            className="btn btn-sm btn-secondary text-xs"
          >
            Remind Later
          </button>
          <button
            onClick={() => handleDismiss(true)}
            className="btn btn-sm text-xs flex items-center gap-1"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark as Read
          </button>
        </div>
      </div>
    </div>
  );
}

