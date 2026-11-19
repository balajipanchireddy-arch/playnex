'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Landmark,
  ShoppingBag,
  Calendar,
  Bell,
  BarChart3,
  History,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Filter,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  Edit3,
  Send,
  ArrowUpRight,
  UserCheck,
  X,
  Eye,
  Megaphone,
  Radio,
  FileText,
  AlertTriangle,
  Loader2,
  Gamepad2
} from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

type SidebarTab =
  | 'dashboard'
  | 'users'
  | 'players'
  | 'academies'
  | 'stores'
  | 'tournaments'
  | 'games'
  | 'matches'
  | 'notifications'
  | 'analytics'
  | 'activity'
  | 'settings';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Core Data
  const [analytics, setAnalytics] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allNotifications, setAllNotifications] = useState<any[]>([]);
  const [gamesList, setGamesList] = useState<any[]>([]);

  // Modals & Action States
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showSendAnnouncement, setShowSendAnnouncement] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState<any | null>(null);
  const [gameToDelete, setGameToDelete] = useState<any | null>(null);
  const [viewingParticipants, setViewingParticipants] = useState<{ tournament: any; list: any[] } | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<any | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Game Form State
  const [gName, setGName] = useState('');
  const [gCategory, setGCategory] = useState('Racquet Sports');
  const [gDesc, setGDesc] = useState('');
  const [gLogo, setGLogo] = useState('');
  const [gBanner, setGBanner] = useState('');
  const [gStatus, setGStatus] = useState<'active' | 'inactive'>('active');

  // Tournament Form State
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState('Basketball');
  const [tCategory, setTCategory] = useState('Open Championship');
  const [tType, setTType] = useState<'individual' | 'team'>('individual');
  const [tDesc, setTDesc] = useState('');
  const [tVenue, setTVenue] = useState('');
  const [tDate, setTDate] = useState('');
  const [tDeadline, setTDeadline] = useState('');
  const [tMax, setTMax] = useState('32');
  const [tFee, setTFee] = useState('500');
  const [tRules, setTRules] = useState('');
  const [tStatus, setTStatus] = useState<string>('Registration Open');

  // Announcement Form State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState<'announcement' | 'tournament' | 'system'>('announcement');
  const [notifRole, setNotifRole] = useState<'all' | 'player' | 'academy' | 'store'>('all');
  const [notifSport, setNotifSport] = useState<string>('All');
  const [notifLink, setNotifLink] = useState('');

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function loadAdminData() {
    setLoading(true);
    try {
      const [analyticsRes, tourRes, verifRes, usersRes, notifRes, gamesRes] = await Promise.all([
        fetch('/api/admin/analytics'),
        fetch('/api/tournaments'),
        fetch('/api/admin/verifications'),
        fetch('/api/admin/users'),
        fetch('/api/notifications'),
        fetch('/api/games?all=true'),
      ]);

      if (analyticsRes.status === 403 || analyticsRes.status === 401) {
        setIsForbidden(true);
        return;
      }

      const [aData, tData, vData, uData, nData, gData] = await Promise.all([
        analyticsRes.json(),
        tourRes.json(),
        verifRes.json(),
        usersRes.json(),
        notifRes.json(),
        gamesRes.json(),
      ]);

      if (aData.ok) setAnalytics(aData.data);
      if (tData.ok) setTournaments(tData.data || []);
      if (vData.ok) setPendingRequests(vData.data || []);
      if (uData.ok) setUsersList(uData.data || []);
      if (nData.ok) setAllNotifications(nData.data || []);
      if (gData.ok) setGamesList(gData.data || []);
    } catch (e) {
      notify('err', 'Network error loading admin portal.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const payload = {
        name: tName,
        sport: tSport,
        category: tCategory,
        participationType: tType,
        description: tDesc,
        venue: tVenue,
        date: tDate,
        registrationDeadline: tDeadline || tDate,
        maxParticipants: Number(tMax),
        entryFee: Number(tFee),
        rules: tRules,
        status: tStatus,
      };

      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.ok) {
        notify('ok', `Tournament "${tName}" created! Relevant players notified automatically.`);
        setShowCreateTournament(false);
        resetTournamentForm();
        loadAdminData();
      } else {
        notify('err', json.error?.message || 'Failed to create tournament.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleUpdateTournamentStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Tournament status updated to ${status}. Registered players notified automatically.`);
        setTournaments(tournaments.map(t => t.id === id ? { ...t, status } : t));
      } else {
        notify('err', json.error?.message || 'Update failed');
      }
    } catch {
      notify('err', 'Network error');
    }
  }

  async function handleConfirmDelete() {
    if (!tournamentToDelete) return;
    const target = tournamentToDelete;
    setDeletingId(target.id);

    try {
      const res = await fetch(`/api/tournaments/${target.id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.ok) {
        notify('ok', `Tournament "${target.name}" deleted successfully. Affected players notified.`);
        setTournaments(prev => prev.filter(t => t.id !== target.id));
        setTournamentToDelete(null);

        // Update analytics totals in state immediately
        if (analytics?.totals) {
          setAnalytics({
            ...analytics,
            totals: {
              ...analytics.totals,
              tournaments: Math.max(0, (analytics.totals.tournaments || 1) - 1),
              registrations: Math.max(0, (analytics.totals.registrations || 0) - (target.registeredCount || 0)),
            }
          });
        }
      } else {
        notify('err', json.error?.message || 'Failed to delete tournament.');
      }
    } catch {
      notify('err', 'Network error during deletion.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleViewParticipants(tournament: any) {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/registrations`);
      const json = await res.json();
      if (json.ok) {
        setViewingParticipants({ tournament, list: json.data || [] });
      }
    } catch {
      notify('err', 'Failed to fetch participant list.');
    }
  }

  async function handleReviewPartner(id: string, type: 'store' | 'academy', status: 'approved' | 'rejected') {
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, status }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `${type === 'store' ? 'Store' : 'Academy'} ${status}!`);
        setPendingRequests(pendingRequests.filter(r => r.id !== id));
        loadAdminData();
      } else {
        notify('err', json.error?.message || 'Review failed.');
      }
    } catch {
      notify('err', 'Network error.');
    }
  }

  async function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifTitle,
          message: notifMessage,
          category: notifCategory,
          targetRole: notifRole,
          targetSport: notifSport !== 'All' ? notifSport : undefined,
          link: notifLink || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', 'Announcement broadcasted to targeted audience!');
        setShowSendAnnouncement(false);
        setNotifTitle('');
        setNotifMessage('');
        setNotifLink('');
        loadAdminData();
      } else {
        notify('err', json.error?.message || 'Failed to send announcement.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setSubmittingAction(false);
    }
  }

  function resetTournamentForm() {
    setTName('');
    setTDesc('');
    setTVenue('');
    setTDate('');
    setTDeadline('');
    setTMax('32');
    setTFee('500');
    setTRules('');
    setTStatus('Registration Open');
  }

  function openCreateGame() {
    setEditingGame(null);
    setGName('');
    setGCategory('Racquet Sports');
    setGDesc('');
    setGLogo('');
    setGBanner('');
    setGStatus('active');
    setShowGameModal(true);
  }

  function openEditGame(game: any) {
    setEditingGame(game);
    setGName(game.name || '');
    setGCategory(game.category || 'Racquet Sports');
    setGDesc(game.description || '');
    setGLogo(game.logoUrl || '');
    setGBanner(game.bannerUrl || '');
    setGStatus(game.status || 'active');
    setShowGameModal(true);
  }

  async function handleSaveGame(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const url = editingGame ? `/api/games/${editingGame.id}` : '/api/games';
      const method = editingGame ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gName,
          category: gCategory,
          description: gDesc,
          logoUrl: gLogo,
          bannerUrl: gBanner,
          status: gStatus,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', editingGame ? `Game "${gName}" updated.` : `Game "${gName}" added to catalog.`);
        setShowGameModal(false);
        const refreshed = await fetch('/api/games?all=true').then(r => r.json());
        if (refreshed.ok) setGamesList(refreshed.data || []);
      } else {
        notify('err', data.error?.message || 'Failed to save game');
      }
    } catch {
      notify('err', 'Network error saving game');
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleDeleteGame() {
    if (!gameToDelete) return;
    try {
      const res = await fetch(`/api/games/${gameToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Game "${gameToDelete.name}" deleted.`);
        setGamesList(gamesList.filter(g => g.id !== gameToDelete.id));
      } else {
        notify('err', data.error?.message || 'Failed to delete game');
      }
    } catch {
      notify('err', 'Network error deleting game');
    } finally {
      setGameToDelete(null);
    }
  }

  async function handleToggleGameStatus(game: any) {
    const newStatus = game.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Game "${game.name}" marked ${newStatus}.`);
        setGamesList(gamesList.map(g => g.id === game.id ? { ...g, status: newStatus } : g));
      } else {
        notify('err', 'Failed to toggle status');
      }
    } catch {
      notify('err', 'Network error toggling game status');
    }
  }

  if (isForbidden) {
    return (
      <div className="card max-w-md mx-auto text-center py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="h-7 w-7" />
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'games', label: 'Game Management', icon: Gamepad2, badge: gamesList.length },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy, badge: tournaments.length },
    { id: 'users', label: 'User Management', icon: Users, badge: usersList.length },
    { id: 'players', label: 'Players', icon: Trophy, badge: analytics?.totals?.players },
    { id: 'academies', label: 'Academies', icon: Landmark, badge: analytics?.totals?.academies },
    { id: 'stores', label: 'Stores', icon: ShoppingBag, badge: analytics?.totals?.stores },
    { id: 'matches', label: 'Matches', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: allNotifications.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 -mt-8 sm:-mt-10 -mx-4 sm:-mx-6 lg:-mx-8 p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
          notification.type === 'ok'
            ? 'bg-emerald-950/90 text-white border-emerald-700/80'
            : 'bg-rose-950/90 text-white border-rose-700/80'
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

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[#E2E8F0] gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-[#172033]">PlayNex Executive Portal</span>
              <span className="badge bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase">
                Root Admin
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">Unified platform authority: Player, Academy, Store, and Tournament management.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { resetTournamentForm(); setShowCreateTournament(true); }}
            className="btn btn-sm text-xs flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Tournament
          </button>
          <button
            onClick={() => setShowSendAnnouncement(true)}
            className="btn btn-sm btn-secondary text-xs flex items-center gap-1.5"
          >
            <Megaphone className="h-3.5 w-3.5 text-amber-600" />
            Send Announcement
          </button>
        </div>
      </div>

      {/* Layout: Left Sidebar + Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Modern Left Sidebar */}
        <aside className="lg:col-span-1 space-y-1 bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-sm h-fit">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-3 py-2">
            Control Center
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as SidebarTab)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#DBEAFE] text-[#1E40AF] border border-blue-200 shadow-xs'
                    : 'text-[#64748B] hover:bg-slate-50 hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-[#64748B]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Content Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Total Users</p>
                  <p className="text-2xl font-black text-[#172033] mt-1">{analytics?.totals?.users || 0}</p>
                  <span className="text-[10px] text-slate-500">Platform-wide</span>
                </div>
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Athletes</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{analytics?.totals?.players || 0}</p>
                  <span className="text-[10px] text-slate-500">Active players</span>
                </div>
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Tournaments</p>
                  <p className="text-2xl font-black text-purple-400 mt-1">{tournaments.length}</p>
                  <span className="text-[10px] text-slate-500">Live tournaments</span>
                </div>
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Registrations</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{analytics?.totals?.registrations || 0}</p>
                  <span className="text-[10px] text-slate-500">Athlete entries</span>
                </div>
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Academies</p>
                  <p className="text-2xl font-black text-teal-400 mt-1">{analytics?.totals?.academies || 0}</p>
                  <span className="text-[10px] text-slate-500">Sports venues</span>
                </div>
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-4 rounded-2xl">
                  <p className="text-[11px] font-medium text-slate-400">Pending Review</p>
                  <p className="text-2xl font-black text-rose-400 mt-1">{pendingRequests.length}</p>
                  <span className="text-[10px] text-slate-500">Awaiting approval</span>
                </div>
              </div>

              {/* Analytics & Distribution Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform Roles Distribution */}
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      Platform Portal Distribution
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">Live Firestore</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Player Arena (Athletes)', count: analytics?.roles?.player || 0, color: 'bg-amber-500' },
                      { label: 'Academies & Arenas', count: analytics?.roles?.academy || 0, color: 'bg-teal-500' },
                      { label: 'Sports Gear Stores', count: analytics?.roles?.store || 0, color: 'bg-sky-500' },
                      { label: 'System Administrators', count: analytics?.roles?.admin || 0, color: 'bg-purple-500' },
                    ].map((item) => {
                      const total = analytics?.totals?.users || 1;
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">{item.label}</span>
                            <span className="text-slate-400 font-bold">{item.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tournaments by Sport */}
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      Tournaments by Sport
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">{tournaments.length} active</span>
                  </div>

                  {tournaments.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No tournaments created yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {['Basketball', 'Football', 'Cricket', 'Tennis'].map((sp) => {
                        const count = tournaments.filter(t => t.sport === sp).length;
                        const pct = Math.round((count / (tournaments.length || 1)) * 100);
                        return (
                          <div key={sp} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-300 font-medium">{sp}</span>
                              <span className="text-slate-400 font-bold">{count} tournaments</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(pct, 5)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Verifications Queue */}
              <div className="bg-white border border-[#E2E8F0] shadow-sm p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-rose-400" />
                    Pending Partner Verifications ({pendingRequests.length})
                  </h3>
                  <span className="text-xs text-slate-500">Requires administrator action</span>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                    All partner accounts are verified and up to date!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            req.type === 'store' ? 'bg-sky-500/20 text-sky-400' : 'bg-teal-500/20 text-teal-400'
                          }`}>
                            {req.type === 'store' ? <ShoppingBag className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#172033]">{req.displayName}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" /> {req.address || 'Address pending'} • Type: {req.type}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleReviewPartner(req.id, req.type, 'approved')}
                            className="btn btn-sm btn-emerald text-[11px] py-1 px-3"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewPartner(req.id, req.type, 'rejected')}
                            className="btn btn-sm btn-danger text-[11px] py-1 px-3"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Logs */}
              <div className="bg-white border border-[#E2E8F0] shadow-sm p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-400" />
                    Live System Activity & Cross-Portal Notifications
                  </h3>
                  <span className="text-xs text-slate-500">Audit trail</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {analytics?.activityLogs?.length === 0 ? (
                    <p className="py-4 text-center text-slate-500 text-xs">No activity recorded yet.</p>
                  ) : (
                    analytics?.activityLogs?.slice(0, 6).map((log: any) => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-slate-200 font-medium">{log.details}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Action: {log.action} • {log.userName ? `By: ${log.userName}` : 'System'}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TOURNAMENTS MANAGEMENT */}
          {activeTab === 'tournaments' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-[#172033]">Championship Tournaments ({tournaments.length})</h2>
                  <p className="text-xs text-slate-400">Published tournaments notify athletes automatically in real time.</p>
                </div>
                <button
                  onClick={() => { resetTournamentForm(); setShowCreateTournament(true); }}
                  className="btn btn-sm text-xs bg-brand-600 hover:bg-brand-500 text-white border-0 flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Host New Tournament
                </button>
              </div>

              {tournaments.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-12 text-center rounded-2xl">
                  <Trophy className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">No tournaments published yet</p>
                  <p className="text-xs text-slate-600 mt-1">Host your first competitive tournament across PlayNex.</p>
                  <button
                    onClick={() => setShowCreateTournament(true)}
                    className="btn btn-sm btn-emerald text-xs mt-4"
                  >
                    Create Tournament
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {tournaments.map((t) => (
                    <div key={t.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/40 transition">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-black uppercase">
                            {t.sport}
                          </span>
                          <span className={`badge text-[10px] font-black uppercase ${
                            t.status === 'Registration Open' ? 'badge-ok' :
                            t.status === 'Upcoming' ? 'badge-brand' :
                            t.status === 'Completed' ? 'badge-neutral' : 'badge-warn'
                          }`}>
                            {t.status || 'Active'}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">₹{t.entryFee || t.price || 0} entry</span>
                        </div>

                        <h3 className="text-base font-extrabold text-[#172033]">{t.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500" /> {t.venue || t.loc}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-500" /> {t.date}
                          </span>
                          <span className="text-purple-400 font-bold">
                            {t.registeredCount || 0} / {t.maxParticipants || 32} athletes registered
                          </span>
                        </p>
                        {t.rules && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">Rules: {t.rules}</p>
                        )}
                      </div>

                      {/* Management Actions - Fully visible Delete button for every status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleViewParticipants(t)}
                          className="btn btn-sm text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 flex items-center gap-1"
                          title="View registered athletes"
                        >
                          <Eye className="h-3.5 w-3.5 text-brand-400" />
                          <span>Participants ({t.registeredCount || 0})</span>
                        </button>

                        {t.status === 'Draft' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'Registration Open')}
                            className="btn btn-sm btn-emerald text-xs"
                          >
                            Publish
                          </button>
                        )}

                        {t.status === 'Registration Open' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'Registration Closed')}
                            className="btn btn-sm bg-amber-600/30 text-amber-300 border-amber-600/40 text-xs"
                          >
                            Close Entry
                          </button>
                        )}

                        {t.status !== 'Completed' && t.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'Completed')}
                            className="btn btn-sm text-xs bg-slate-800 text-slate-300 border-slate-700"
                          >
                            Mark Completed
                          </button>
                        )}

                        {/* Visible Delete Tournament Button */}
                        <button
                          onClick={() => setTournamentToDelete(t)}
                          className="btn btn-sm btn-danger text-xs flex items-center gap-1.5"
                          title="Delete tournament permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: GAME MANAGEMENT */}
          {activeTab === 'games' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[#172033]">Game & Esports Catalog ({gamesList.length})</h2>
                    <span className="badge bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] uppercase font-black">
                      Centralized
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Manage official sports & gaming titles. Academies and players automatically reference this database.
                  </p>
                </div>
                <button
                  onClick={openCreateGame}
                  className="btn btn-sm text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-0 flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
                >
                  <Plus className="h-4 w-4" />
                  Add New Game
                </button>
              </div>

              {gamesList.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] shadow-sm p-12 text-center rounded-2xl">
                  <Gamepad2 className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">No games added yet</p>
                  <p className="text-xs text-slate-600 mt-1">Add your first sport or esports game to the platform.</p>
                  <button
                    onClick={openCreateGame}
                    className="btn btn-sm btn-emerald text-xs mt-4"
                  >
                    Add Game
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gamesList.map((g) => (
                    <div
                      key={g.id}
                      className="group rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-card hover:border-slate-700 hover:shadow-card-hover transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Cover Image */}
                        <div className="h-32 w-full relative overflow-hidden bg-slate-100">
                          {g.bannerUrl ? (
                            <img
                              src={g.bannerUrl}
                              alt={g.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 flex items-center justify-center">
                              <Gamepad2 className="h-10 w-10 text-slate-700" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                          <button
                            onClick={() => handleToggleGameStatus(g)}
                            className={`absolute top-2.5 right-2.5 badge text-[10px] font-black uppercase cursor-pointer transition ${
                              g.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                            }`}
                            title="Click to toggle status"
                          >
                            {g.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            {g.logoUrl && (
                              <img
                                src={g.logoUrl}
                                alt={g.name}
                                className="h-6 w-6 rounded-md object-cover border border-slate-700"
                              />
                            )}
                            <span className="badge bg-slate-800 text-slate-300 border-slate-700 text-[10px] uppercase font-bold">
                              {g.category}
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold text-[#172033] group-hover:text-cyan-400 transition">
                            {g.name}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {g.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleToggleGameStatus(g)}
                          className="text-[11px] font-semibold text-slate-400 hover:text-white transition"
                        >
                          {g.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditGame(g)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit game"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setGameToDelete(g)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
                            title="Delete game"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#172033]">Registered Users ({usersList.length})</h2>
                  <p className="text-xs text-slate-400">All registered platform users across the 4 core roles.</p>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl overflow-hidden divide-y divide-slate-100">
                {usersList.map((u) => (
                  <div key={u.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 font-black flex items-center justify-center text-xs">
                        {u.fullName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172033]">{u.fullName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {u.roles?.map((r: string) => (
                        <span key={r} className="badge bg-slate-800 text-slate-300 border-slate-700 text-[10px] uppercase font-bold">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS & ANNOUNCEMENTS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#172033]">Platform Announcements ({allNotifications.length})</h2>
                  <p className="text-xs text-slate-400">Broadcast updates to all players, specific sports, academies, or stores.</p>
                </div>
                <button
                  onClick={() => setShowSendAnnouncement(true)}
                  className="btn btn-sm text-xs bg-brand-600 hover:bg-brand-500 text-white border-0 flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Broadcast Alert
                </button>
              </div>

              <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl divide-y divide-slate-100">
                {allNotifications.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">No announcements broadcasted yet.</p>
                ) : (
                  allNotifications.map((n) => (
                    <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] uppercase font-black">
                            Audience: {n.targetRole || 'all'} {n.targetSport ? `(${n.targetSport})` : ''}
                          </span>
                          <span className="badge bg-slate-800 text-slate-300 text-[10px]">
                            {n.category || 'System'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#172033]">{n.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY LOGS */}
          {activeTab === 'activity' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-lg font-black text-[#172033]">Platform Audit Logs</h2>
                <p className="text-xs text-slate-400">Immutable audit record of cross-portal notifications and platform operations.</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl divide-y divide-slate-100">
                {analytics?.activityLogs?.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">No logs found.</p>
                ) : (
                  analytics?.activityLogs?.map((log: any) => (
                    <div key={log.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="text-slate-200 font-semibold">{log.details}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Action: {log.action} • User: {log.userName || log.userId}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* FALLBACK FOR OTHER TABS */}
          {['players', 'academies', 'stores', 'matches', 'analytics', 'settings'].includes(activeTab) && (
            <div className="bg-white border border-[#E2E8F0] shadow-sm p-8 rounded-2xl text-center space-y-3 animate-in fade-in duration-200">
              <Sparkles className="h-8 w-8 text-purple-400 mx-auto" />
              <h3 className="text-base font-bold text-[#172033] capitalize">{activeTab} Management View</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Filter and configure {activeTab} across PlayNex. Live data is synced directly from Firestore.
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="btn btn-sm btn-secondary text-xs"
              >
                Return to Overview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION DIALOG: DELETE TOURNAMENT */}
      {tournamentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card w-full max-w-md bg-white border-[#E2E8F0] text-[#172033] shadow-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Warning glow */}
            <div
              aria-hidden
              className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-rose-500/15 blur-2xl pointer-events-none"
            />

            <div className="flex items-start justify-between relative z-10 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Delete Tournament</h3>
                  <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                    Irreversible Action
                  </span>
                </div>
              </div>
              <button
                onClick={() => setTournamentToDelete(null)}
                disabled={deletingId === tournamentToDelete.id}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 relative z-10 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Tournament Name
                  </span>
                  <p className="text-sm font-black text-[#172033] mt-0.5">
                    {tournamentToDelete.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block">Current Status</span>
                    <span className={`badge text-[9px] uppercase font-black mt-1 ${
                      tournamentToDelete.status === 'Registration Open' ? 'badge-ok' :
                      tournamentToDelete.status === 'Upcoming' ? 'badge-brand' :
                      tournamentToDelete.status === 'Draft' ? 'badge-neutral' : 'badge-warn'
                    }`}>
                      {tournamentToDelete.status || 'Active'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block">Registered Athletes</span>
                    <span className="font-black text-purple-300 text-xs mt-1 block">
                      {tournamentToDelete.registeredCount || 0} participants
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Warning: Deleting this tournament will permanently erase the event and all associated registration records. Registered players will be automatically notified of the cancellation.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 relative z-10">
              <button
                type="button"
                onClick={() => setTournamentToDelete(null)}
                disabled={deletingId === tournamentToDelete.id}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId === tournamentToDelete.id}
                className="btn btn-danger text-xs flex items-center gap-1.5"
              >
                {deletingId === tournamentToDelete.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card w-full max-w-2xl bg-white border-[#E2E8F0] text-[#172033] shadow-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Trophy className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold">Host New Championship Tournament</h3>
              </div>
              <button onClick={() => setShowCreateTournament(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="text-slate-300 font-semibold mb-1 block">Tournament Title</label>
                <input
                  required
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  className="input"
                  placeholder="e.g. Visakha Premier Cup 2026"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Sport Category</label>
                <select
                  value={tSport}
                  onChange={(e) => setTSport(e.target.value)}
                  className="input"
                >
                  <option>Basketball</option>
                  <option>Football</option>
                  <option>Cricket</option>
                  <option>Tennis</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tournament Category</label>
                <input
                  required
                  value={tCategory}
                  onChange={(e) => setTCategory(e.target.value)}
                  className="input"
                  placeholder="e.g. Open Men's / Under-19"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tournament Date</label>
                <input
                  type="date"
                  required
                  value={tDate}
                  onChange={(e) => setTDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Registration Deadline</label>
                <input
                  type="date"
                  required
                  value={tDeadline}
                  onChange={(e) => setTDeadline(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Venue / Ground Location</label>
                <input
                  required
                  value={tVenue}
                  onChange={(e) => setTVenue(e.target.value)}
                  className="input"
                  placeholder="e.g. Main Turf Court, Beach Road"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Max Athlete Capacity</label>
                <input
                  type="number"
                  min="2"
                  required
                  value={tMax}
                  onChange={(e) => setTMax(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Entry Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={tFee}
                  onChange={(e) => setTFee(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Initial Status</label>
                <select
                  value={tStatus}
                  onChange={(e) => setTStatus(e.target.value)}
                  className="input"
                >
                  <option value="Registration Open">Registration Open (Live & Notifies Players)</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Draft">Draft (Hidden)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-slate-300 font-semibold mb-1 block">Rules & Regulations (Optional)</label>
                <textarea
                  rows={2}
                  value={tRules}
                  onChange={(e) => setTRules(e.target.value)}
                  className="input"
                  placeholder="Standard FIBA rules apply. Knockout tournament format."
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateTournament(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="btn btn-emerald text-xs"
                >
                  {submittingAction ? 'Publishing...' : 'Create Tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTICIPANTS VIEWER MODAL */}
      {viewingParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card w-full max-w-xl bg-white border-[#E2E8F0] text-[#172033] shadow-xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-[#172033]">Registered Participants</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {viewingParticipants.tournament.name} • {viewingParticipants.list.length} registered
                </p>
              </div>
              <button onClick={() => setViewingParticipants(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100 text-xs">
              {viewingParticipants.list.length === 0 ? (
                <p className="py-8 text-center text-slate-500">No participants registered yet.</p>
              ) : (
                viewingParticipants.list.map((reg, idx) => (
                  <div key={reg.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-[#172033]">{reg.userName || 'Athlete'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{reg.userEmail}</p>
                      </div>
                    </div>

                    <span className="badge badge-ok text-[10px] uppercase font-bold">
                      {reg.status || 'Confirmed'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST ANNOUNCEMENT MODAL */}
      {showSendAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card w-full max-w-lg bg-white border-[#E2E8F0] text-[#172033] shadow-xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold">Broadcast Platform Announcement</h3>
              </div>
              <button onClick={() => setShowSendAnnouncement(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendAnnouncement} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Target Portal</label>
                  <select
                    value={notifRole}
                    onChange={(e: any) => setNotifRole(e.target.value)}
                    className="input"
                  >
                    <option value="all">All Users (Global)</option>
                    <option value="player">Players & Athletes Only</option>
                    <option value="academy">Sports Academies Only</option>
                    <option value="store">Sports Stores Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Sport Filter</label>
                  <select
                    value={notifSport}
                    onChange={(e) => setNotifSport(e.target.value)}
                    className="input"
                  >
                    <option value="All">All Sports</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Football">Football</option>
                    <option value="Cricket">Cricket</option>
                    <option value="Tennis">Tennis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Announcement Title</label>
                <input
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="input"
                  placeholder="e.g. Summer Premier League Registration Now Open"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Message Content</label>
                <textarea
                  required
                  rows={3}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="input"
                  placeholder="Detailed announcement message broadcasted to user dashboards..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSendAnnouncement(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="btn btn-emerald text-xs flex items-center gap-1.5"
                >
                  <Send className="h-3 w-3" />
                  {submittingAction ? 'Broadcasting...' : 'Send Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GAME ADD / EDIT MODAL */}
      {showGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card w-full max-w-lg bg-white border-[#E2E8F0] text-[#172033] shadow-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-[#172033]">
                  {editingGame ? `Edit Game: ${editingGame.name}` : 'Add New Game'}
                </h3>
              </div>
              <button
                onClick={() => setShowGameModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGame} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-slate-300 font-semibold mb-1 block">Game / Sport Name *</label>
                  <input
                    required
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    className="input"
                    placeholder="e.g. Badminton, Valorant, BGMI"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-slate-300 font-semibold mb-1 block">Category *</label>
                  <select
                    value={gCategory}
                    onChange={(e) => setGCategory(e.target.value)}
                    className="input"
                  >
                    <option value="Racquet Sports">Racquet Sports</option>
                    <option value="Team Sports">Team Sports</option>
                    <option value="Esports">Esports</option>
                    <option value="Outdoor Sports">Outdoor Sports</option>
                    <option value="Combat & Fitness">Combat & Fitness</option>
                    <option value="Other Sports">Other Sports</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Short Description</label>
                <textarea
                  rows={2}
                  value={gDesc}
                  onChange={(e) => setGDesc(e.target.value)}
                  className="input"
                  placeholder="Overview of the game, match format, and rules..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Logo Image URL</label>
                  <input
                    value={gLogo}
                    onChange={(e) => setGLogo(e.target.value)}
                    className="input"
                    placeholder="https://... logo url"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Banner Cover Image URL</label>
                  <input
                    value={gBanner}
                    onChange={(e) => setGBanner(e.target.value)}
                    className="input"
                    placeholder="https://... cover banner"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Initial Status</label>
                <select
                  value={gStatus}
                  onChange={(e: any) => setGStatus(e.target.value)}
                  className="input"
                >
                  <option value="active">Active (Visible across all portals)</option>
                  <option value="inactive">Inactive (Hidden from users)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGameModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="btn btn-sm text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-0 flex items-center gap-1.5"
                >
                  {submittingAction ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {editingGame ? 'Save Changes' : 'Create Game'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GAME DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        isOpen={!!gameToDelete}
        onClose={() => setGameToDelete(null)}
        onConfirm={handleDeleteGame}
        title="Delete Game"
        recordName={gameToDelete?.name || ''}
        recordType="Game"
        warningText="Deleting this game removes it from the centralized catalog. Existing tournaments will preserve their recorded sport title."
        confirmLabel="Delete Game"
        confirmVariant="danger"
      />
    </div>
  );
}
