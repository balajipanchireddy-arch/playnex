'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Store,
  GraduationCap,
  Package,
  ExternalLink,
  Trash2,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.data || []);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    let unsubSnapshot: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }
      if (user?.uid) {
        try {
          const q = query(
            collection(db, 'notifications'),
            where('recipientId', '==', user.uid)
          );
          unsubSnapshot = onSnapshot(
            q,
            () => {
              fetchNotifications();
            },
            () => {
              // Silent fallback to polling
            }
          );
        } catch {
          // Ignore snapshot setup failure
        }
      }
    });

    const interval = setInterval(fetchNotifications, 20000);
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
      clearInterval(interval);
    };
  }, [fetchNotifications]);

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
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
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
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'tournament':
        return Trophy;
      case 'academy':
        return GraduationCap;
      case 'store':
        return Store;
      case 'order':
      case 'rental':
        return Package;
      case 'announcement':
        return Megaphone;
      case 'registration':
        return CheckCircle2;
      case 'match':
        return Activity;
      case 'verification':
        return ShieldCheck;
      case 'chat':
        return MessageSquare;
      default:
        return Info;
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'tournament':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'academy':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'store':
      case 'rental':
        return 'bg-sky-50 text-sky-700 border border-sky-200';
      case 'order':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'verification':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'registration':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-[#E8F5EE] text-[#0E7055] border border-green-200';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) fetchNotifications();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#667085] shadow-xs hover:text-[#172033] hover:bg-slate-50 transition"
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-xl z-50 text-[#172033] animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-3 px-2 border-b border-[#E5E7EB]">
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
                  className="text-[11px] font-semibold text-[#16A36A] hover:text-[#0E7055] flex items-center gap-1 transition"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="h-3 w-3" />
                  Read all
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
                  title="Clear your notifications"
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
                <Bell className="h-8 w-8 text-[#98A2B3] mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-[#172033]">No notifications yet</p>
                <p className="text-[10px] text-[#667085]">
                  Personal alerts for bookings, matches, orders, and verifications appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = getCategoryIcon(n.category);
                const badgeClass = getCategoryBadgeClass(n.category);
                return (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl transition ${
                      !n.read ? 'bg-[#E8F5EE]/60 border border-green-100' : 'hover:bg-slate-50'
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
                              <span className="h-1.5 w-1.5 rounded-full bg-[#16A36A] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#667085] mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-semibold text-[#98A2B3]">
                              {n.createdAt
                                ? new Date(n.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recent'}
                            </span>
                            {n.link && (
                              <Link
                                href={n.link}
                                onClick={() => {
                                  markAsRead(n.id);
                                  setOpen(false);
                                }}
                                className="text-[10px] font-bold text-[#16A36A] hover:underline flex items-center gap-0.5"
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
                            className="text-[#98A2B3] hover:text-emerald-600 p-1 transition"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="text-[#98A2B3] hover:text-rose-500 p-1 transition"
                          title="Delete notification"
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
