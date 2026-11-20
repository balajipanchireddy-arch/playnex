'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trophy, 
  Megaphone, 
  Activity, 
  Info, 
  CheckCircle2, 
  ShoppingBag,
  Landmark,
  Package,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }

  useEffect(() => {
    fetchNotifications();

    try {
      const unsub = onSnapshot(collection(db, 'notifications'), () => {
        fetchNotifications();
      }, (err) => {
        console.warn('Real-time notifications sync fallback to polling:', err.message);
      });
      return () => unsub();
    } catch {
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    try {
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function markAllAsRead() {
    try {
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteNotification(id: string) {
    try {
      setNotifications(notifications.filter(n => n.id !== id));
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to dismiss notification:', e);
    }
  }

  async function clearAllNotifications() {
    try {
      setNotifications([]);
      await fetch('/api/notifications?clearAll=true', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear notifications:', e);
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'tournament': return Trophy;
      case 'academy': return Landmark;
      case 'store': return ShoppingBag;
      case 'order': return Package;
      case 'announcement': return Megaphone;
      case 'registration': return CheckCircle2;
      case 'match': return Activity;
      default: return Info;
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'tournament': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'academy': return 'bg-teal-50 text-teal-700 border border-teal-200';
      case 'store': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'order': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'registration': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default: return 'bg-[#DBEAFE] text-[#1E40AF] border border-blue-200';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] shadow-xs hover:text-[#172033] hover:bg-slate-50 transition"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xl z-50 text-[#172033] animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 px-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#172033]">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-bad text-[10px] py-0 px-2">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="h-3 w-3" />
                  Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 py-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-[#94A3B8] mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-[#172033]">No notifications yet</p>
                <p className="text-[10px] text-[#64748B]">Updates from Admin, Academies, and Stores will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = getCategoryIcon(n.category);
                const badgeClass = getCategoryBadgeClass(n.category);
                return (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl transition ${
                      !n.read ? 'bg-blue-50/60 border border-blue-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 ${badgeClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[#172033] leading-snug">
                              {n.title}
                            </p>
                            {!n.read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-semibold text-[#94A3B8]">
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </span>
                            {n.link && (
                              <Link
                                href={n.link}
                                onClick={() => {
                                  markAsRead(n.id);
                                  setOpen(false);
                                }}
                                className="text-[10px] font-bold text-[#2563EB] hover:underline flex items-center gap-0.5"
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[#94A3B8] hover:text-emerald-600 p-1 transition"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="text-[#94A3B8] hover:text-rose-500 p-1 transition"
                          title="Dismiss notification"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
