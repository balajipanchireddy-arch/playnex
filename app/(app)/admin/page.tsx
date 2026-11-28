'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Toast from '@/components/ui/Toast';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import {
  LayoutDashboard,
  Users,
  Trophy,
  GraduationCap,
  Store,
  Calendar,
  Bell,
  BarChart3,
  History,
  Settings,
  CheckCircle2,
  Clock,
  Plus,
  MapPin,
  ShieldCheck,
  Trash2,
  Edit3,
  Send,
  X,
  Eye,
  Megaphone,
  AlertTriangle,
  Loader2,
  Gamepad2,
  Database,
  ShieldAlert,
  RefreshCw,
  ArrowLeft,
  Download,
  ExternalLink,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';

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
  | 'system'
  | 'analytics'
  | 'activity'
  | 'settings';

const VALID_TABS: SidebarTab[] = [
  'dashboard',
  'users',
  'players',
  'academies',
  'stores',
  'tournaments',
  'games',
  'matches',
  'notifications',
  'system',
  'analytics',
  'activity',
  'settings',
];

const CLEANUP_CATEGORY_OPTIONS = [
  { id: 'activity_logs_old', name: 'Old Activity Logs (>30d)', desc: 'Prunes audit logs older than 30 days' },
  { id: 'notifications_old', name: 'Old Notifications (>30d)', desc: 'Deletes expired notifications & read receipts' },
  { id: 'notifications', name: 'All Notifications & Reads', desc: 'Clears all notifications and read receipts' },
  { id: 'test_demo_records', name: 'Test & Seed Demo Records', desc: 'Deletes dummy_/seed-owned demo data' },
  { id: 'orphaned_records', name: 'Orphaned Records', desc: 'Facilities/products/reads missing parent docs' },
  { id: 'unused_products', name: 'Unused Zero-Stock Products', desc: 'Zero-stock products with zero orders/rentals' },
  { id: 'unused_facilities', name: 'Unused Grounds', desc: 'Grounds with zero historical bookings' },
  { id: 'player_profiles', name: 'Player Profiles', desc: 'Clears playerProfiles (preserves users/userRoles)' },
  { id: 'player_verifications', name: 'Player Verifications & Vault', desc: 'Clears player verification submissions & proofs' },
  { id: 'academies', name: 'Academies & Staff', desc: 'Clears academies and staffProfiles' },
  { id: 'stores', name: 'Stores', desc: 'Clears store merchant records' },
  { id: 'facilities', name: 'All Grounds & Arenas', desc: 'Clears all facility records' },
  { id: 'products', name: 'All Store Products', desc: 'Clears all product records' },
  { id: 'tournaments', name: 'Tournaments & Events', desc: 'Clears events and tournaments' },
  { id: 'registrations', name: 'Tournament Registrations', desc: 'Clears athlete tournament entries' },
  { id: 'bookings', name: 'Bookings & Slot Locks', desc: 'Clears bookings and bookingSlots' },
  { id: 'orders', name: 'Customer Orders', desc: 'Clears store purchase orders' },
  { id: 'rentals', name: 'Gear Rentals', desc: 'Clears gear rental & deposit records' },
  { id: 'matches', name: 'Matches & Invites', desc: 'Clears open matches and direct requests' },
  { id: 'chats', name: 'Matchmaking Chats', desc: 'Clears chats and nested messages subcollections' },
  { id: 'reports_blocks', name: 'Blocks & Safety Reports', desc: 'Clears userBlocks and userReports' },
] as const;

function AdminDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') as SidebarTab | null;
  const activeTab: SidebarTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'dashboard';

  function navigateTab(tab: SidebarTab) {
    if (tab === 'dashboard') {
      router.push('/admin');
    } else {
      router.push(`/admin?tab=${tab}`);
    }
  }

  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Core Data
  const [analytics, setAnalytics] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [playerVerifications, setPlayerVerifications] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allNotifications, setAllNotifications] = useState<any[]>([]);
  const [gamesList, setGamesList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Modals & Action States
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showSendAnnouncement, setShowSendAnnouncement] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState<any | null>(null);
  const [gameToDelete, setGameToDelete] = useState<any | null>(null);
  const [viewingParticipants, setViewingParticipants] = useState<{ tournament: any; list: any[] } | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<any | null>(null);
  const [userActionTarget, setUserActionTarget] = useState<{ user: any; mode: 'suspend' | 'permanent' } | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<{ id: string; name: string; type: 'academy' | 'store' } | null>(null);
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

  // Database Cleanup Tool State
  const [dbInspection, setDbInspection] = useState<any>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [selectedSystemCategories, setSelectedSystemCategories] = useState<string[]>([]);
  const [cleanupPreview, setCleanupPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectiveConfirmInput, setSelectiveConfirmInput] = useState('');
  const [selectiveDeleting, setSelectiveDeleting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [secondConfirm, setSecondConfirm] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<any>(null);
  const [cleaningNotifs, setCleaningNotifs] = useState(false);
  const [sweepingExpirations, setSweepingExpirations] = useState(false);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, tourRes, verifRes, playerVerRes, usersRes, notifRes, gamesRes] =
        await Promise.all([
          fetch('/api/admin/analytics'),
          fetch('/api/tournaments'),
          fetch('/api/admin/verifications'),
          fetch('/api/player/verification?all=true'),
          fetch('/api/admin/users'),
          fetch('/api/notifications?scope=admin_broadcasts'),
          fetch('/api/games?all=true'),
        ]);

      if (analyticsRes.status === 403 || analyticsRes.status === 401) {
        setIsForbidden(true);
        return;
      }

      const [aData, tData, vData, pvData, uData, nData, gData] = await Promise.all([
        analyticsRes.json(),
        tourRes.json(),
        verifRes.json(),
        playerVerRes.json().catch(() => ({ ok: false })),
        usersRes.json(),
        notifRes.json(),
        gamesRes.json(),
      ]);

      if (aData.ok) setAnalytics(aData.data);
      if (tData.ok) setTournaments(tData.data || []);
      if (vData.ok) setPendingRequests(vData.data || []);
      if (pvData.ok) setPlayerVerifications(pvData.data || []);
      if (uData.ok) setUsersList(uData.data || []);
      if (nData.ok) setAllNotifications(nData.data || []);
      if (gData.ok) setGamesList(gData.data || []);
    } catch {
      notify('err', 'Network error loading admin portal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const loadDatabaseInspection = useCallback(async () => {
    setLoadingInspection(true);
    try {
      const res = await fetch('/api/admin/system?action=inspect');
      const data = await res.json();
      if (data.ok) {
        setDbInspection(data.data);
      } else {
        notify('err', data.error?.message || 'Failed to inspect database.');
      }
    } catch {
      notify('err', 'Could not load database inspection.');
    } finally {
      setLoadingInspection(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'system' && !dbInspection) {
      loadDatabaseInspection();
    }
  }, [activeTab, dbInspection, loadDatabaseInspection]);

  async function handleGeneratePreview(mode: 'selective' | 'complete_reset') {
    if (mode === 'selective' && selectedSystemCategories.length === 0) {
      notify('err', 'Select at least one category to preview.');
      return null;
    }
    setPreviewLoading(true);
    setCleanupReport(null);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, categories: selectedSystemCategories }),
      });
      const json = await res.json();
      if (json.ok) {
        setCleanupPreview(json.data);
        return json.data;
      } else {
        notify('err', json.error?.message || 'Preview generation failed.');
        return null;
      }
    } catch {
      notify('err', 'Network error generating cleanup preview.');
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownloadBackup() {
    try {
      const cats = selectedSystemCategories.join(',');
      const res = await fetch(`/api/admin/system?action=backup&categories=${encodeURIComponent(cats)}`);
      const json = await res.json();
      if (!json.ok) {
        notify('err', json.error?.message || 'Backup export failed.');
        return;
      }
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playnex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('ok', 'Backup JSON downloaded (sensitive ID fields redacted).');
    } catch {
      notify('err', 'Failed to export backup.');
    }
  }

  async function handleSelectiveDelete() {
    if (!cleanupPreview || cleanupPreview.mode !== 'selective') {
      notify('err', 'Generate a valid preview before deleting.');
      return;
    }
    if (selectiveConfirmInput !== 'CONFIRM CLEANUP') {
      notify('err', 'Type "CONFIRM CLEANUP" exactly to execute selective cleanup.');
      return;
    }
    setSelectiveDeleting(true);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'selective',
          categories: cleanupPreview.categories,
          previewHash: cleanupPreview.previewHash,
          confirm: 'CONFIRM CLEANUP',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCleanupReport(data.data);
        setCleanupPreview(null);
        setSelectedSystemCategories([]);
        setSelectiveConfirmInput('');
        notify('ok', `Cleanup completed: ${data.data.deletedCount} deleted, ${data.data.preservedCount} preserved.`);
        await Promise.all([loadDatabaseInspection(), loadAdminData()]);
      } else {
        notify('err', data.error?.message || 'Selective cleanup failed.');
      }
    } catch {
      notify('err', 'Network error during cleanup.');
    } finally {
      setSelectiveDeleting(false);
    }
  }

  async function handleCompleteReset() {
    if (resetConfirmInput !== 'DELETE ALL DATA') {
      notify('err', 'You must type "DELETE ALL DATA" exactly.');
      return;
    }
    if (!secondConfirm) {
      const preview = await handleGeneratePreview('complete_reset');
      if (!preview) return;
      setSecondConfirm(true);
      return;
    }
    if (!cleanupPreview || cleanupPreview.mode !== 'complete_reset') {
      notify('err', 'Preview missing. Please retry.');
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'complete_reset',
          categories: [],
          previewHash: cleanupPreview.previewHash,
          confirm: 'DELETE ALL DATA',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCleanupReport(data.data);
        setCleanupPreview(null);
        setShowResetModal(false);
        setResetConfirmInput('');
        setSecondConfirm(false);
        notify('ok', 'Operational reset completed. Permanent admins, users, and userRoles preserved.');
        await Promise.all([loadDatabaseInspection(), loadAdminData()]);
      } else {
        notify('err', data.error?.message || 'Operational reset failed.');
      }
    } catch {
      notify('err', 'Network error during reset.');
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleNotificationCleanup() {
    setCleaningNotifs(true);
    try {
      const res = await fetch('/api/admin/notifications/cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Cleaned up ${data.data?.deleted || 0} expired notifications (>30 days).`);
        await Promise.all([loadDatabaseInspection(), loadAdminData()]);
      } else {
        notify('err', data.error?.message || 'Failed to cleanup notifications.');
      }
    } catch {
      notify('err', 'Network error during notification cleanup.');
    } finally {
      setCleaningNotifs(false);
    }
  }

  async function handleExpirationSweep() {
    setSweepingExpirations(true);
    try {
      const res = await fetch('/api/admin/verifications/expire-check', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Checked ${json.data.checked} players: suspended ${json.data.suspendedCount} expired account(s).`);
        await loadAdminData();
      } else {
        notify('err', json.error?.message || 'Sweep failed.');
      }
    } catch {
      notify('err', 'Network error running verification check.');
    } finally {
      setSweepingExpirations(false);
    }
  }

  async function handleReviewPlayerVerification(
    verificationId: string,
    status: 'approved' | 'rejected' | 'resubmission_required'
  ) {
    const reason =
      status === 'approved'
        ? 'Approved by administrator'
        : prompt(`Enter note for ${status.replace('_', ' ')} (optional):`) || '';
    try {
      const res = await fetch('/api/player/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, status, reason }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Player verification ${status}.`);
        await loadAdminData();
      } else {
        notify('err', json.error?.message || 'Review failed.');
      }
    } catch {
      notify('err', 'Network error.');
    }
  }

  async function handleUserAccountAction() {
    if (!userActionTarget) return;
    const { user, mode } = userActionTarget;
    setDeletingId(user.id);
    try {
      const url =
        mode === 'permanent'
          ? `/api/admin/users?userId=${encodeURIComponent(user.id)}&permanent=true`
          : `/api/admin/users?userId=${encodeURIComponent(user.id)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        notify('ok', mode === 'permanent' ? `Account "${user.fullName}" purged.` : `Account "${user.fullName}" suspended.`);
        setUserActionTarget(null);
        await loadAdminData();
      } else {
        notify('err', json.error?.message || 'Operation failed.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReactivateUser(userId: string) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reactivate' }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', 'User account reactivated.');
        await loadAdminData();
      } else {
        notify('err', json.error?.message || 'Failed to reactivate.');
      }
    } catch {
      notify('err', 'Network error.');
    }
  }

  async function handleConfirmDeletePartner() {
    if (!partnerToDelete) return;
    setDeletingId(partnerToDelete.id);
    try {
      const url =
        partnerToDelete.type === 'academy'
          ? `/api/academies/me?academyId=${encodeURIComponent(partnerToDelete.id)}`
          : `/api/stores/me?storeId=${encodeURIComponent(partnerToDelete.id)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `${partnerToDelete.type === 'academy' ? 'Academy' : 'Store'} "${partnerToDelete.name}" deleted cleanly.`);
        setPartnerToDelete(null);
        await loadAdminData();
      } else {
        notify('err', json.error?.message || 'Failed to delete partner.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAllAnnouncements() {
    if (!confirm('Clear all platform broadcast announcements? Individual user notifications are not affected.')) return;
    try {
      const res = await fetch('/api/notifications?clearAll=true&admin=true', { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        notify('ok', 'All broadcast announcements cleared.');
        await loadAdminData();
      } else {
        notify('err', data.error?.message || 'Failed to clear announcements.');
      }
    } catch {
      notify('err', 'Network error.');
    }
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Tournament "${tName}" created!`);
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
        notify('ok', `Tournament status updated to ${status}.`);
        setTournaments((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      } else {
        notify('err', json.error?.message || 'Update failed');
      }
    } catch {
      notify('err', 'Network error');
    }
  }

  async function handleConfirmDeleteTournament() {
    if (!tournamentToDelete) return;
    const target = tournamentToDelete;
    setDeletingId(target.id);
    try {
      const res = await fetch(`/api/tournaments/${target.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Tournament "${target.name}" deleted successfully.`);
        setTournaments((prev) => prev.filter((t) => t.id !== target.id));
        setTournamentToDelete(null);
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
      if (json.ok) setViewingParticipants({ tournament, list: json.data || [] });
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
        setPendingRequests((prev) => prev.filter((r) => r.id !== id));
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
        notify('ok', 'Announcement broadcasted!');
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
        notify('ok', editingGame ? `Game "${gName}" updated.` : `Game "${gName}" added.`);
        setShowGameModal(false);
        const refreshed = await fetch('/api/games?all=true').then((r) => r.json());
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
        setGamesList((prev) => prev.filter((g) => g.id !== gameToDelete.id));
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
        setGamesList((prev) => prev.map((g) => (g.id === game.id ? { ...g, status: newStatus } : g)));
      } else {
        notify('err', 'Failed to toggle status');
      }
    } catch {
      notify('err', 'Network error');
    }
  }

  if (isForbidden) {
    return (
      <div className="card max-w-md mx-auto text-center py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-[#172033]">Access Restricted</h2>
        <p className="text-xs text-[#667085] mt-2 max-w-xs mx-auto">
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

  const navItems: Array<{ id: SidebarTab; label: string; icon: any; iconImage?: string; badge?: number }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'players', label: 'Player Verifications', icon: Users, iconImage: '/icons/players.jpg', badge: analytics?.totals?.pendingPlayerVerifications },
    { id: 'users', label: 'User Management', icon: UserCheck, badge: usersList.length },
    { id: 'academies', label: 'Academies', icon: GraduationCap, iconImage: '/icons/academy.jpg', badge: analytics?.totals?.academies },
    { id: 'stores', label: 'Stores', icon: Store, iconImage: '/icons/store.png', badge: analytics?.totals?.stores },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy, iconImage: '/icons/tournament.jpg', badge: tournaments.length },
    { id: 'games', label: 'Game Management', icon: Gamepad2, badge: gamesList.length },
    { id: 'matches', label: 'Matches', icon: Calendar, badge: analytics?.totals?.matches },
    { id: 'notifications', label: 'Broadcasts', icon: Bell, badge: allNotifications.length },
    { id: 'system', label: 'Database Cleanup', icon: Database },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
      <div>
        <div className="flex items-center gap-2.5">
          {activeTab !== 'dashboard' && (
            <button
              type="button"
              onClick={() => navigateTab('dashboard')}
              className="btn-secondary btn-sm text-xs py-1 px-2.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Overview
            </button>
          )}
          <h2 className="text-lg font-extrabold text-[#172033]">{title}</h2>
        </div>
        <p className="text-xs text-[#667085] mt-1">{subtitle}</p>
      </div>
      {action}
    </div>
  );

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033] -mt-8 sm:-mt-10 -mx-4 sm:-mx-6 lg:-mx-8 p-4 sm:p-6 lg:p-8">
      <Toast message={notification} onClose={() => setNotification(null)} />

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[#E5E7EB] gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#101828] flex items-center justify-center text-[#16A36A] shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-[#172033]">PlayNex Executive Portal</span>
              <span className="badge badge-brand text-[10px] font-bold uppercase">Root Admin</span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Unified platform authority: Users, Verifications, Academies, Stores, Tournaments &amp; Database Cleanup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadAdminData}
            disabled={loading}
            className="btn-secondary btn-sm text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { resetTournamentForm(); setShowCreateTournament(true); }}
            className="btn btn-sm text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Create Tournament
          </button>
          <button
            onClick={() => setShowSendAnnouncement(true)}
            className="btn-secondary btn-sm text-xs"
          >
            <Megaphone className="h-3.5 w-3.5 text-amber-600" /> Broadcast
          </button>
        </div>
      </div>

      {/* Layout: Left Sidebar + Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <aside className="lg:col-span-1 space-y-1 bg-white p-3 rounded-2xl border border-[#E5E7EB] shadow-sm h-fit">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085] px-3 py-2">
            Control Center
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#E8F5EE] text-[#0E7055] border border-green-200 shadow-2xs'
                    : 'text-[#667085] hover:bg-slate-50 hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.iconImage ? (
                    <img
                      src={item.iconImage}
                      alt={item.label}
                      className="h-4 w-4 rounded-md object-cover border border-[#E5E7EB] shrink-0"
                    />
                  ) : (
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#16A36A]' : 'text-[#667085]'}`} />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive ? 'bg-[#16A36A] text-white' : 'bg-slate-100 text-[#667085]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-4 space-y-6">
          {/* OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Users', val: analytics?.totals?.users || 0, sub: 'Platform-wide', tab: 'users' as SidebarTab, color: 'text-[#101828]' },
                  { label: 'Players', val: analytics?.totals?.players || 0, sub: 'Active role', tab: 'players' as SidebarTab, color: 'text-[#16A36A]' },
                  { label: 'Academies', val: analytics?.totals?.academies || 0, sub: 'Sports venues', tab: 'academies' as SidebarTab, color: 'text-[#0E7055]' },
                  { label: 'Stores', val: analytics?.totals?.stores || 0, sub: 'Gear shops', tab: 'stores' as SidebarTab, color: 'text-[#101828]' },
                  { label: 'Tournaments', val: tournaments.length, sub: 'Live events', tab: 'tournaments' as SidebarTab, color: 'text-amber-600' },
                  { label: 'Pending Review', val: analytics?.totals?.pendingVerifications || 0, sub: 'Partners & players', tab: 'players' as SidebarTab, color: 'text-rose-600' },
                ].map((c) => (
                  <button
                    key={c.label}
                    onClick={() => navigateTab(c.tab)}
                    className="bg-white border border-[#E5E7EB] shadow-sm p-4 rounded-2xl text-left hover:border-[#16A36A] transition"
                  >
                    <p className="text-[11px] font-semibold text-[#667085]">{c.label}</p>
                    <p className={`text-2xl font-black mt-1 ${c.color}`}>{c.val}</p>
                    <span className="text-[10px] text-[#98A2B3]">{c.sub}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Role Distribution */}
                <div className="bg-white border border-[#E5E7EB] shadow-sm p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#16A36A]" />
                      Platform Portal Distribution
                    </h3>
                    <span className="text-[11px] text-[#667085] font-mono">Live Firestore</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Player Arena', count: analytics?.roles?.player || 0, color: 'bg-[#16A36A]' },
                      { label: 'Academies & Arenas', count: analytics?.roles?.academy || 0, color: 'bg-[#101828]' },
                      { label: 'Sports Gear Stores', count: analytics?.roles?.store || 0, color: 'bg-sky-600' },
                      { label: 'System Administrators', count: analytics?.roles?.admin || 0, color: 'bg-amber-500' },
                    ].map((item) => {
                      const total = analytics?.totals?.users || 1;
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#172033] font-semibold">{item.label}</span>
                            <span className="text-[#667085] font-bold">{item.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Operational Metrics */}
                <div className="bg-white border border-[#E5E7EB] shadow-sm p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[#16A36A]" />
                      Operations Snapshot
                    </h3>
                    <button onClick={() => navigateTab('analytics')} className="text-xs font-bold text-[#16A36A] hover:underline">
                      Full Analytics →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <span className="text-[#667085] block">Ground Bookings</span>
                      <strong className="text-lg text-[#172033]">{analytics?.totals?.bookings || 0}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <span className="text-[#667085] block">Gear Orders &amp; Rentals</span>
                      <strong className="text-lg text-[#172033]">
                        {(analytics?.totals?.orders || 0) + (analytics?.totals?.rentals || 0)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <span className="text-[#667085] block">Open Matches</span>
                      <strong className="text-lg text-[#172033]">{analytics?.totals?.matches || 0}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <span className="text-[#667085] block">Grounds Listed</span>
                      <strong className="text-lg text-[#172033]">{analytics?.totals?.facilities || 0}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Partner Verifications */}
              <div className="bg-white border border-[#E5E7EB] shadow-sm p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-rose-600" />
                    Pending Partner Verifications ({pendingRequests.length})
                  </h3>
                  <span className="text-xs text-[#667085]">Academies &amp; Stores awaiting approval</span>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-6 text-[#667085] text-xs">
                    <CheckCircle2 className="h-6 w-6 text-[#16A36A] mx-auto mb-1.5" />
                    All partner accounts are verified and up to date!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center shrink-0">
                            {req.type === 'store' ? <Store className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#172033]">{req.displayName}</p>
                            <p className="text-[10px] text-[#667085] flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" /> {req.address || 'Address pending'} • Type: {req.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleReviewPartner(req.id, req.type, 'approved')} className="btn btn-sm text-[11px] py-1 px-3">
                            Approve
                          </button>
                          <button onClick={() => handleReviewPartner(req.id, req.type, 'rejected')} className="btn-danger btn-sm text-[11px] py-1 px-3">
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Logs */}
              <div className="bg-white border border-[#E5E7EB] shadow-sm p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
                    <History className="h-4 w-4 text-[#16A36A]" />
                    Recent Platform Activity
                  </h3>
                  <button onClick={() => navigateTab('activity')} className="text-xs font-bold text-[#16A36A] hover:underline">
                    View All →
                  </button>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {analytics?.activityLogs?.length === 0 ? (
                    <p className="py-4 text-center text-[#667085]">No activity recorded yet.</p>
                  ) : (
                    analytics?.activityLogs?.slice(0, 6).map((log: any) => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[#172033] font-medium">{log.details}</p>
                          <p className="text-[10px] text-[#667085] font-mono mt-0.5">
                            Action: {log.action} • By: {log.userName || log.userId}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#98A2B3] shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PLAYER VERIFICATIONS TAB */}
          {activeTab === 'players' && (
            <div className="space-y-5">
              <SectionHeader
                title={`Player Verifications (${playerVerifications.length})`}
                subtitle="Review player ID proofs from the private vault, enforce 5-day deadlines, and restore suspended accounts upon approval."
                action={
                  <button
                    onClick={handleExpirationSweep}
                    disabled={sweepingExpirations}
                    className="btn-secondary btn-sm text-xs"
                  >
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    {sweepingExpirations ? 'Checking...' : 'Run 5-Day Deadline Sweep'}
                  </button>
                }
              />

              {playerVerifications.length === 0 ? (
                <div className="card text-center py-12 text-xs text-[#667085]">
                  No player verification submissions yet.
                </div>
              ) : (
                <div className="card p-0 overflow-x-auto">
                  <table className="data-table">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th>Player</th>
                        <th>ID Type / Ref</th>
                        <th>Status</th>
                        <th>Deadline</th>
                        <th>Private Proof</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerVerifications.map((v) => (
                        <tr key={v.id}>
                          <td className="text-xs">
                            <p className="font-bold text-[#172033]">{v.fullName}</p>
                            <p className="text-[11px] text-[#667085]">{v.userEmail} · {v.phone}</p>
                          </td>
                          <td className="text-xs">
                            <span>{v.idType}</span>
                            {v.idLast4 && <span className="block text-[10px] text-[#667085] font-mono">****{v.idLast4}</span>}
                          </td>
                          <td>
                            <span
                              className={`badge text-[10px] uppercase ${
                                v.status === 'approved'
                                  ? 'badge-ok'
                                  : v.status === 'rejected' || v.status === 'resubmission_required'
                                  ? 'badge-bad'
                                  : 'badge-warn'
                              }`}
                            >
                              {v.status.replace(/_/g, ' ')}
                            </span>
                            {v.accountStatus === 'suspended' && (
                              <span className="badge badge-bad text-[9px] ml-1">Account Suspended</span>
                            )}
                          </td>
                          <td className="text-[11px] text-[#667085]">
                            {v.verificationDeadline ? new Date(v.verificationDeadline).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            {v.privateDocUrl ? (
                              <a
                                href={v.privateDocUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#16A36A] hover:underline"
                              >
                                View Proof <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#98A2B3]">No file</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {v.status !== 'approved' && (
                                <button
                                  onClick={() => handleReviewPlayerVerification(v.id, 'approved')}
                                  className="btn btn-sm text-[11px] py-1 px-2.5"
                                >
                                  Approve
                                </button>
                              )}
                              {v.status !== 'rejected' && (
                                <button
                                  onClick={() => handleReviewPlayerVerification(v.id, 'resubmission_required')}
                                  className="btn-secondary btn-sm text-[11px] py-1 px-2"
                                >
                                  Resubmit
                                </button>
                              )}
                              {v.status !== 'rejected' && (
                                <button
                                  onClick={() => handleReviewPlayerVerification(v.id, 'rejected')}
                                  className="btn-danger btn-sm text-[11px] py-1 px-2"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* USER MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <SectionHeader
                title={`User Management (${filteredUsers.length})`}
                subtitle="Protected permanent administrators cannot be suspended or deleted."
                action={
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#667085]" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name or email..."
                      className="input pl-9 py-1.5 text-xs"
                    />
                  </div>
                }
              />

              <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-2xl overflow-hidden divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#E8F5EE] text-[#0E7055] font-black flex items-center justify-center text-xs shrink-0">
                        {u.fullName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-[#172033]">{u.fullName}</p>
                          {u.isProtectedAdmin && (
                            <span className="badge badge-brand text-[9px] uppercase">Protected Admin</span>
                          )}
                          {u.accountStatus === 'suspended' && (
                            <span className="badge badge-bad text-[9px] uppercase">
                              Suspended {u.suspensionReason ? `(${u.suspensionReason})` : ''}
                            </span>
                          )}
                          {u.deletionRequest && (
                            <span className="badge badge-warn text-[9px] uppercase">Deletion Requested</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#667085] font-mono">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {u.roles?.map((r: string) => (
                        <span key={r} className="badge badge-navy text-[10px] uppercase font-bold">
                          {r}
                        </span>
                      ))}
                      {!u.isProtectedAdmin && (
                        <>
                          {u.accountStatus === 'suspended' ? (
                            <button
                              onClick={() => handleReactivateUser(u.id)}
                              className="btn btn-sm text-[11px] py-1 px-2.5"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => setUserActionTarget({ user: u, mode: 'suspend' })}
                              className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                            >
                              <UserX className="h-3 w-3 text-amber-600" /> Suspend
                            </button>
                          )}
                          <button
                            onClick={() => setUserActionTarget({ user: u, mode: 'permanent' })}
                            className="btn-danger btn-sm text-[11px] py-1 px-2.5"
                          >
                            <Trash2 className="h-3 w-3" /> Purge
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACADEMIES TAB */}
          {activeTab === 'academies' && (
            <div className="space-y-4">
              <SectionHeader
                title={`Academies & Venues (${analytics?.academiesList?.length || 0})`}
                subtitle="Approve, reject, or safely remove academy profiles while preserving historical booking records."
              />
              <div className="card p-0 overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th>Academy</th>
                      <th>Address</th>
                      <th>Grounds</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.academiesList || []).map((a: any) => (
                      <tr key={a.id}>
                        <td className="font-bold text-xs">{a.academyName || 'Academy'}</td>
                        <td className="text-xs text-[#667085]">{a.address || '—'}</td>
                        <td className="text-xs font-semibold">{a.facilitiesCount || 0}</td>
                        <td>
                          <span className={`badge text-[10px] uppercase ${a.verificationStatus === 'approved' ? 'badge-ok' : a.verificationStatus === 'rejected' ? 'badge-bad' : 'badge-warn'}`}>
                            {a.verificationStatus || 'pending'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {a.verificationStatus !== 'approved' && (
                              <button onClick={() => handleReviewPartner(a.id, 'academy', 'approved')} className="btn btn-sm text-[11px] py-1 px-2.5">
                                Approve
                              </button>
                            )}
                            {a.verificationStatus === 'pending' && (
                              <button onClick={() => handleReviewPartner(a.id, 'academy', 'rejected')} className="btn-secondary btn-sm text-[11px] py-1 px-2">
                                Reject
                              </button>
                            )}
                            <button
                              onClick={() => setPartnerToDelete({ id: a.id, name: a.academyName || a.id, type: 'academy' })}
                              className="btn-danger btn-sm text-[11px] py-1 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STORES TAB */}
          {activeTab === 'stores' && (
            <div className="space-y-4">
              <SectionHeader
                title={`Sports Stores (${analytics?.storesList?.length || 0})`}
                subtitle="Manage store verifications and safe deletion (preserving financial order history)."
              />
              <div className="card p-0 overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th>Store</th>
                      <th>Address</th>
                      <th>Products / Orders</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.storesList || []).map((s: any) => (
                      <tr key={s.id}>
                        <td className="font-bold text-xs">{s.storeName || 'Store'}</td>
                        <td className="text-xs text-[#667085]">{s.address || '—'}</td>
                        <td className="text-xs">{s.productsCount || 0} items · {s.ordersCount || 0} orders</td>
                        <td>
                          <span className={`badge text-[10px] uppercase ${s.verificationStatus === 'approved' ? 'badge-ok' : s.verificationStatus === 'rejected' ? 'badge-bad' : 'badge-warn'}`}>
                            {s.verificationStatus || 'pending'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {s.verificationStatus !== 'approved' && (
                              <button onClick={() => handleReviewPartner(s.id, 'store', 'approved')} className="btn btn-sm text-[11px] py-1 px-2.5">
                                Approve
                              </button>
                            )}
                            {s.verificationStatus === 'pending' && (
                              <button onClick={() => handleReviewPartner(s.id, 'store', 'rejected')} className="btn-secondary btn-sm text-[11px] py-1 px-2">
                                Reject
                              </button>
                            )}
                            <button
                              onClick={() => setPartnerToDelete({ id: s.id, name: s.storeName || s.id, type: 'store' })}
                              className="btn-danger btn-sm text-[11px] py-1 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TOURNAMENTS TAB */}
          {activeTab === 'tournaments' && (
            <div className="space-y-5">
              <SectionHeader
                title={`Championship Tournaments (${tournaments.length})`}
                subtitle="Published tournaments notify athletes automatically."
                action={
                  <button
                    onClick={() => { resetTournamentForm(); setShowCreateTournament(true); }}
                    className="btn btn-sm text-xs"
                  >
                    <Plus className="h-4 w-4" /> Host New Tournament
                  </button>
                }
              />

              {tournaments.length === 0 ? (
                <div className="card p-12 text-center text-xs text-[#667085]">No tournaments published yet.</div>
              ) : (
                <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {tournaments.map((t) => (
                    <div key={t.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge badge-brand text-[10px] font-black uppercase">{t.sport}</span>
                          <span className={`badge text-[10px] font-black uppercase ${t.status === 'Registration Open' ? 'badge-ok' : 'badge-neutral'}`}>
                            {t.status || 'Active'}
                          </span>
                          <span className="text-xs text-[#667085] font-semibold">₹{t.entryFee || t.price || 0} entry</span>
                        </div>
                        <h3 className="text-base font-extrabold text-[#172033]">{t.name}</h3>
                        <p className="text-xs text-[#667085] flex items-center gap-3 flex-wrap">
                          <span>{t.venue || t.loc}</span>
                          <span>• {t.date}</span>
                          <span className="text-[#0E7055] font-bold">
                            {t.registeredCount || 0} / {t.maxParticipants || 32} registered
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => handleViewParticipants(t)} className="btn-secondary btn-sm text-xs">
                          <Eye className="h-3.5 w-3.5 text-[#16A36A]" /> Participants ({t.registeredCount || 0})
                        </button>
                        {t.status === 'Draft' && (
                          <button onClick={() => handleUpdateTournamentStatus(t.id, 'Registration Open')} className="btn btn-sm text-xs">
                            Publish
                          </button>
                        )}
                        {t.status === 'Registration Open' && (
                          <button onClick={() => handleUpdateTournamentStatus(t.id, 'Registration Closed')} className="btn-secondary btn-sm text-xs">
                            Close Entry
                          </button>
                        )}
                        <button onClick={() => setTournamentToDelete(t)} className="btn-danger btn-sm text-xs">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GAMES TAB */}
          {activeTab === 'games' && (
            <div className="space-y-5">
              <SectionHeader
                title={`Game & Esports Catalog (${gamesList.length})`}
                subtitle="Manage centralized sports & gaming titles used across portals."
                action={
                  <button onClick={openCreateGame} className="btn btn-sm text-xs">
                    <Plus className="h-4 w-4" /> Add New Game
                  </button>
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gamesList.map((g) => (
                  <div key={g.id} className="card p-0 overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="h-28 w-full relative bg-slate-100">
                        {g.bannerUrl ? (
                          <img src={g.bannerUrl} alt={g.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <Gamepad2 className="h-8 w-8" />
                          </div>
                        )}
                        <button
                          onClick={() => handleToggleGameStatus(g)}
                          className={`absolute top-2.5 right-2.5 badge text-[10px] uppercase ${g.status === 'active' ? 'badge-ok' : 'badge-bad'}`}
                        >
                          {g.status === 'active' ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                      <div className="p-4 space-y-1.5">
                        <span className="badge badge-neutral text-[10px] uppercase">{g.category}</span>
                        <h3 className="text-sm font-extrabold text-[#172033]">{g.name}</h3>
                        <p className="text-xs text-[#667085] line-clamp-2">{g.description || 'No description.'}</p>
                      </div>
                    </div>
                    <div className="p-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                      <button onClick={() => handleToggleGameStatus(g)} className="text-[#667085] hover:text-[#172033] font-semibold">
                        {g.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditGame(g)} className="p-1.5 rounded-lg text-[#667085] hover:bg-slate-100">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setGameToDelete(g)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MATCHES TAB */}
          {activeTab === 'matches' && (
            <div className="space-y-4">
              <SectionHeader
                title={`Matchmaking Posts (${analytics?.matchesList?.length || 0})`}
                subtitle="Monitor active open matches and moderate cancelled or expired lobbies."
              />
              <div className="card p-0 overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th>Sport</th>
                      <th>Location</th>
                      <th>Schedule</th>
                      <th>Players</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.matchesList || []).length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-xs text-[#667085] py-8">No matches posted yet.</td></tr>
                    ) : (
                      (analytics?.matchesList || []).map((m: any) => (
                        <tr key={m.id}>
                          <td className="font-bold text-xs">{m.sport}</td>
                          <td className="text-xs">{m.location}</td>
                          <td className="text-xs text-[#667085]">{m.date} {m.time}</td>
                          <td className="text-xs">{m.participantCount || 1} / {m.requiredPlayers}</td>
                          <td><span className="badge badge-brand text-[10px] uppercase">{m.status}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS BROADCASTS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <SectionHeader
                title={`Platform Broadcast Announcements (${allNotifications.length})`}
                subtitle="Send role-targeted announcements. Individual user notifications stay strictly isolated."
                action={
                  <div className="flex items-center gap-2">
                    {allNotifications.length > 0 && (
                      <button onClick={handleClearAllAnnouncements} className="btn-danger btn-sm text-xs">
                        <Trash2 className="h-3.5 w-3.5" /> Clear Broadcasts
                      </button>
                    )}
                    <button onClick={() => setShowSendAnnouncement(true)} className="btn btn-sm text-xs">
                      <Send className="h-3.5 w-3.5" /> Broadcast Alert
                    </button>
                  </div>
                }
              />

              <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-2xl divide-y divide-slate-100">
                {allNotifications.length === 0 ? (
                  <p className="p-8 text-center text-xs text-[#667085]">No broadcast announcements yet.</p>
                ) : (
                  allNotifications.map((n) => (
                    <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-brand text-[10px] uppercase font-bold">
                            Audience: {n.targetRole || 'all'} {n.targetSport ? `(${n.targetSport})` : ''}
                          </span>
                          <span className="badge badge-neutral text-[10px]">{n.category || 'announcement'}</span>
                        </div>
                        <h4 className="text-xs font-bold text-[#172033]">{n.title}</h4>
                        <p className="text-xs text-[#667085] mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-[#98A2B3] shrink-0 font-mono">
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ADMIN DATABASE CLEANUP TOOL TAB */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <SectionHeader
                title="Admin Database Inspection & Safe Cleanup Tool"
                subtitle="Inspect collections, orphaned records, generate mandatory previews, download backups, and execute safe cleanup while preserving both permanent admins."
                action={
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={loadDatabaseInspection} disabled={loadingInspection} className="btn-secondary btn-sm text-xs">
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingInspection ? 'animate-spin' : ''}`} />
                      Re-Inspect DB
                    </button>
                    <button onClick={handleNotificationCleanup} disabled={cleaningNotifs} className="btn-secondary btn-sm text-xs">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      {cleaningNotifs ? 'Purging...' : '30-Day Notif Purge'}
                    </button>
                  </div>
                }
              />

              {/* A. Database Inspection Summary */}
              {dbInspection && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="card p-4">
                      <p className="text-[11px] font-semibold text-[#667085]">Root Collections</p>
                      <p className="text-2xl font-black text-[#172033] mt-1">{dbInspection.collections?.length || 0}</p>
                    </div>
                    <div className="card p-4">
                      <p className="text-[11px] font-semibold text-[#667085]">Orphaned Records</p>
                      <p className="text-2xl font-black text-amber-600 mt-1">{dbInspection.orphanedSummary?.totalOrphaned || 0}</p>
                    </div>
                    <div className="card p-4">
                      <p className="text-[11px] font-semibold text-[#667085]">Seed/Demo Records</p>
                      <p className="text-2xl font-black text-[#101828] mt-1">{dbInspection.demoDataSummary?.totalDemo || 0}</p>
                    </div>
                    <div className="card p-4">
                      <p className="text-[11px] font-semibold text-[#667085]">Protected Admins</p>
                      <p className="text-2xl font-black text-[#16A36A] mt-1">
                        {dbInspection.protectedRecords?.permanentAdminUids?.length || 2}
                      </p>
                    </div>
                  </div>

                  {/* Collections Table */}
                  <div className="card p-0 overflow-x-auto">
                    <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#667085]">
                        Firestore Collections Inventory
                      </h3>
                      <span className="text-[11px] text-[#667085]">{dbInspection.storage?.note}</span>
                    </div>
                    <table className="data-table">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th>Collection</th>
                          <th>Docs</th>
                          <th>Subcollections</th>
                          <th>Ownership</th>
                          <th>Protection</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dbInspection.collections || []).map((c: any) => (
                          <tr key={c.name}>
                            <td className="font-mono font-bold text-xs">{c.name}</td>
                            <td className="font-bold text-xs">{c.count}</td>
                            <td className="text-xs text-[#667085]">
                              {c.subcollections?.length ? c.subcollections.join(', ') : '—'}
                            </td>
                            <td className="text-xs text-[#667085]">{c.sampleOwnership}</td>
                            <td>
                              {c.protected ? (
                                <span className="badge badge-ok text-[10px]">Protected</span>
                              ) : (
                                <span className="badge badge-neutral text-[10px]">Cleanable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* B. Selective Cleanup Grid */}
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#172033]">
                  Select Categories for Cleanup ({selectedSystemCategories.length} selected)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {CLEANUP_CATEGORY_OPTIONS.map((item) => {
                    const isChecked = selectedSystemCategories.includes(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setCleanupPreview(null);
                          setSelectedSystemCategories((prev) =>
                            isChecked ? prev.filter((c) => c !== item.id) : [...prev, item.id]
                          );
                        }}
                        className={`card p-3.5 text-left transition ${
                          isChecked ? 'border-[#16A36A] bg-[#E8F5EE]/40' : 'border-[#E5E7EB] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-[#172033]">{item.name}</span>
                          <input type="checkbox" readOnly checked={isChecked} className="rounded text-[#16A36A] h-4 w-4" />
                        </div>
                        <p className="text-[11px] text-[#667085] mt-1">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* C & D. Preview, Backup & Confirm Bar */}
              <div className="card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-[#172033]">Step 1: Generate Preview &amp; Backup</h4>
                    <p className="text-xs text-[#667085]">
                      Deletion is blocked until a fresh preview is generated. Downloading a JSON backup is recommended.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="btn-secondary btn-sm text-xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Backup JSON
                    </button>
                    <button
                      type="button"
                      disabled={selectedSystemCategories.length === 0 || previewLoading}
                      onClick={() => handleGeneratePreview('selective')}
                      className="btn btn-sm text-xs"
                    >
                      {previewLoading ? 'Generating Preview...' : 'Generate Cleanup Preview'}
                    </button>
                  </div>
                </div>

                {cleanupPreview && cleanupPreview.mode === 'selective' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-950">
                        Preview Ready — Estimated Documents Affected: {cleanupPreview.estimatedTotalDocuments}
                      </span>
                      <span className="font-mono text-[10px] text-amber-800">
                        Hash: {cleanupPreview.previewHash.slice(0, 12)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cleanupPreview.breakdown?.map((b: any) => (
                        <div key={b.category} className="p-2.5 rounded-lg bg-white border border-amber-200">
                          <p className="font-bold text-[#172033]">{b.category}: {b.estimatedDocuments} doc(s)</p>
                          <p className="text-[11px] text-[#667085]">{b.relatedRecordsAffected}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                      <strong>Preserved:</strong> {cleanupPreview.preservedRecords?.usersDocuments} users,{' '}
                      {cleanupPreview.preservedRecords?.userRolesDocuments} userRoles, both permanent admin accounts, and{' '}
                      {cleanupPreview.preservedRecords?.gamesCatalogDocuments} games.
                    </div>
                    {cleanupPreview.risks?.length > 0 && (
                      <div className="text-rose-800 font-semibold">
                        Risks: {cleanupPreview.risks.join(' ')}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      <input
                        type="text"
                        value={selectiveConfirmInput}
                        onChange={(e) => setSelectiveConfirmInput(e.target.value)}
                        placeholder='Type "CONFIRM CLEANUP" to execute'
                        className="input text-xs font-mono"
                      />
                      <button
                        type="button"
                        disabled={selectiveConfirmInput !== 'CONFIRM CLEANUP' || selectiveDeleting}
                        onClick={handleSelectiveDelete}
                        className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {selectiveDeleting ? 'Executing...' : 'Execute Selective Cleanup'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cleanup Execution Report */}
              {cleanupReport && (
                <div className="card p-5 border-2 border-[#16A36A] bg-[#E8F5EE]/30 space-y-3 text-xs">
                  <h4 className="font-extrabold text-sm text-[#0E7055]">Cleanup Execution Report</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div><span className="text-[#667085] block">Deleted</span><strong className="text-lg">{cleanupReport.deletedCount}</strong></div>
                    <div><span className="text-[#667085] block">Preserved</span><strong className="text-lg text-[#16A36A]">{cleanupReport.preservedCount}</strong></div>
                    <div><span className="text-[#667085] block">Files Deleted</span><strong className="text-lg">{cleanupReport.filesDeleted}</strong></div>
                    <div><span className="text-[#667085] block">Skipped</span><strong className="text-lg">{cleanupReport.skippedCount}</strong></div>
                    <div><span className="text-[#667085] block">Failed</span><strong className="text-lg text-rose-600">{cleanupReport.failedCount}</strong></div>
                  </div>
                  <p className="text-[#172033]">
                    <strong>Recovery &amp; Notes:</strong> {cleanupReport.recoveryInstructions?.join(' ')}
                  </p>
                </div>
              )}

              {/* Full Application-Data Reset */}
              <div className="card p-6 border-2 border-rose-200 bg-rose-50/40 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-rose-950">Full Application-Data Reset</h3>
                    <p className="text-xs text-rose-800 mt-1">
                      Clears all operational collections while strictly preserving both permanent admin Firebase Auth accounts, all <code>users</code> &amp; <code>userRoles</code> documents, and the master <code>games</code> catalog.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setResetConfirmInput('');
                      setSecondConfirm(false);
                      setShowResetModal(true);
                    }}
                    className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white text-xs"
                  >
                    <ShieldAlert className="h-4 w-4" /> Open Full Reset Flow...
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              <SectionHeader
                title="Platform Analytics"
                subtitle="Live operational metrics compiled from Firestore."
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-5"><p className="text-xs text-[#667085]">Revenue (Shipped/Delivered)</p><p className="text-2xl font-black text-[#16A36A] mt-1">₹{analytics?.totals?.revenue || 0}</p></div>
                <div className="card p-5"><p className="text-xs text-[#667085]">Total Bookings</p><p className="text-2xl font-black text-[#172033] mt-1">{analytics?.totals?.bookings || 0}</p></div>
                <div className="card p-5"><p className="text-xs text-[#667085]">Checked-In Attendance</p><p className="text-2xl font-black text-[#0E7055] mt-1">{(analytics?.bookingsByStatus?.checked_in || 0) + (analytics?.bookingsByStatus?.completed || 0)}</p></div>
                <div className="card p-5"><p className="text-xs text-[#667085]">Active Rentals</p><p className="text-2xl font-black text-amber-600 mt-1">{analytics?.totals?.rentals || 0}</p></div>
              </div>
              <div className="card p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-[#172033]">Booking Status Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  {Object.entries(analytics?.bookingsByStatus || {}).map(([k, v]: [string, any]) => (
                    <div key={k} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                      <span className="uppercase text-[10px] text-[#667085] font-bold block">{k.replace('_', ' ')}</span>
                      <strong className="text-lg text-[#172033]">{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY LOGS TAB */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <SectionHeader
                title="Platform Audit Logs"
                subtitle="Immutable audit trail of platform actions, deletions, cleanups, and verifications."
              />
              <div className="bg-white border border-[#E5E7EB] shadow-sm rounded-2xl divide-y divide-slate-100">
                {analytics?.activityLogs?.length === 0 ? (
                  <p className="p-8 text-center text-xs text-[#667085]">No logs found.</p>
                ) : (
                  analytics?.activityLogs?.map((log: any) => (
                    <div key={log.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="text-[#172033] font-semibold">{log.details}</p>
                        <p className="text-[10px] text-[#667085] font-mono mt-0.5">
                          Action: {log.action} • By: {log.userName || log.userId}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#98A2B3] shrink-0 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <SectionHeader
                title="Platform Security & Configuration"
                subtitle="Permanent administrator protections, Spark plan storage mode, and support contacts."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="card p-5 space-y-2">
                  <h3 className="font-extrabold text-sm text-[#172033]">Permanent Admin Accounts</h3>
                  <p className="text-[#667085]">Both permanent administrator accounts are hard-protected from suspension, role removal, and database cleanup:</p>
                  <ul className="list-disc list-inside text-[#172033] font-mono space-y-1 pt-1">
                    <li>balajipanchireddy@gmail.com</li>
                    <li>gowthamisindhu27@gmail.com</li>
                  </ul>
                </div>
                <div className="card p-5 space-y-2">
                  <h3 className="font-extrabold text-sm text-[#172033]">Infrastructure &amp; Support</h3>
                  <p className="text-[#667085]">Firebase Plan: <strong>Spark-compatible</strong> (Private Firestore Document Vault active; no paid services enabled).</p>
                  <p className="text-[#667085]">Support Email: <strong>balajipanchireddy@gmail.com</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION MODALS */}
      <DeleteConfirmModal
        isOpen={!!tournamentToDelete}
        onClose={() => setTournamentToDelete(null)}
        onConfirm={handleConfirmDeleteTournament}
        title="Delete Tournament"
        recordName={tournamentToDelete?.name || ''}
        recordType="Tournament"
        warningText="Deleting this tournament removes the event and its registrations and notifies registered players."
        loading={deletingId === tournamentToDelete?.id}
      />

      <DeleteConfirmModal
        isOpen={!!gameToDelete}
        onClose={() => setGameToDelete(null)}
        onConfirm={handleDeleteGame}
        title="Delete Game"
        recordName={gameToDelete?.name || ''}
        recordType="Game"
        warningText="Removes this title from the centralized games catalog."
      />

      <DeleteConfirmModal
        isOpen={!!userActionTarget}
        onClose={() => setUserActionTarget(null)}
        onConfirm={handleUserAccountAction}
        title={userActionTarget?.mode === 'permanent' ? 'Permanently Purge User' : 'Suspend User Account'}
        recordName={userActionTarget?.user?.fullName || userActionTarget?.user?.email || ''}
        recordType="User Account"
        warningText={
          userActionTarget?.mode === 'permanent'
            ? 'Permanently removes Auth user, profile, roles, verification vault docs, and notifications while retaining financial order/booking history.'
            : 'Suspends login & restricted feature access until reactivated by an administrator.'
        }
        confirmLabel={userActionTarget?.mode === 'permanent' ? 'Purge Account' : 'Suspend User'}
        confirmVariant={userActionTarget?.mode === 'permanent' ? 'danger' : 'warning'}
        loading={deletingId === userActionTarget?.user?.id}
      />

      <DeleteConfirmModal
        isOpen={!!partnerToDelete}
        onClose={() => setPartnerToDelete(null)}
        onConfirm={handleConfirmDeletePartner}
        title={`Delete ${partnerToDelete?.type === 'academy' ? 'Academy' : 'Store'}`}
        recordName={partnerToDelete?.name || ''}
        recordType={partnerToDelete?.type === 'academy' ? 'Academy' : 'Store'}
        warningText="Safely cascades deletion across owned listings while preserving historical attendance/order records."
        loading={deletingId === partnerToDelete?.id}
      />

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateTournament && (
        <div className="modal-overlay">
          <div className="modal-box max-w-2xl">
            <div className="modal-header">
              <h3 className="modal-title">Host New Championship Tournament</h3>
              <button onClick={() => setShowCreateTournament(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTournament} className="modal-body grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="label">Tournament Title *</label>
                <input required value={tName} onChange={(e) => setTName(e.target.value)} className="input" placeholder="e.g. Visakha Premier Cup 2026" />
              </div>
              <div>
                <label className="label">Sport *</label>
                <select value={tSport} onChange={(e) => setTSport(e.target.value)} className="input">
                  {Array.from(new Set([...gamesList.map((g) => g.name).filter(Boolean), 'Basketball', 'Football', 'Cricket', 'Tennis', 'Badminton'])).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <input required value={tCategory} onChange={(e) => setTCategory(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" required value={tDate} onChange={(e) => setTDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Registration Deadline *</label>
                <input type="date" required value={tDeadline} onChange={(e) => setTDeadline(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Venue *</label>
                <input required value={tVenue} onChange={(e) => setTVenue(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Max Capacity</label>
                <input type="number" min="2" required value={tMax} onChange={(e) => setTMax(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Entry Fee (₹)</label>
                <input type="number" min="0" required value={tFee} onChange={(e) => setTFee(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Status</label>
                <select value={tStatus} onChange={(e) => setTStatus(e.target.value)} className="input">
                  <option value="Registration Open">Registration Open</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="md:col-span-2 modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowCreateTournament(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={submittingAction} className="btn btn-sm">
                  {submittingAction ? 'Publishing...' : 'Create Tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTICIPANTS VIEWER MODAL */}
      {viewingParticipants && (
        <div className="modal-overlay">
          <div className="modal-box max-w-xl">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Registered Participants</h3>
                <p className="text-xs text-[#667085]">{viewingParticipants.tournament.name} · {viewingParticipants.list.length} registered</p>
              </div>
              <button onClick={() => setViewingParticipants(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body divide-y divide-slate-100 text-xs">
              {viewingParticipants.list.length === 0 ? (
                <p className="py-8 text-center text-[#667085]">No participants registered yet.</p>
              ) : (
                viewingParticipants.list.map((reg, idx) => (
                  <div key={reg.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#172033]">{idx + 1}. {reg.userName || 'Athlete'}</p>
                      <p className="text-[10px] text-[#667085] font-mono">{reg.userEmail}</p>
                    </div>
                    <span className="badge badge-ok text-[10px] uppercase">{reg.status || 'Confirmed'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST ANNOUNCEMENT MODAL */}
      {showSendAnnouncement && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">Broadcast Platform Announcement</h3>
              <button onClick={() => setShowSendAnnouncement(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSendAnnouncement} className="modal-body space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Target Portal</label>
                  <select value={notifRole} onChange={(e: any) => setNotifRole(e.target.value)} className="input">
                    <option value="all">All Users</option>
                    <option value="player">Players Only</option>
                    <option value="academy">Academies Only</option>
                    <option value="store">Stores Only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Sport Filter</label>
                  <select value={notifSport} onChange={(e) => setNotifSport(e.target.value)} className="input">
                    <option value="All">All Sports</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Football">Football</option>
                    <option value="Cricket">Cricket</option>
                    <option value="Tennis">Tennis</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Title *</label>
                <input required value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea required rows={3} value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)} className="input" />
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowSendAnnouncement(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={submittingAction} className="btn btn-sm">
                  <Send className="h-3.5 w-3.5" /> {submittingAction ? 'Sending...' : 'Send Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GAME MODAL */}
      {showGameModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">{editingGame ? `Edit Game: ${editingGame.name}` : 'Add New Game'}</h3>
              <button onClick={() => setShowGameModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveGame} className="modal-body space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input required value={gName} onChange={(e) => setGName(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <select value={gCategory} onChange={(e) => setGCategory(e.target.value)} className="input">
                    <option value="Racquet Sports">Racquet Sports</option>
                    <option value="Team Sports">Team Sports</option>
                    <option value="Esports">Esports</option>
                    <option value="Outdoor Sports">Outdoor Sports</option>
                    <option value="Combat & Fitness">Combat &amp; Fitness</option>
                    <option value="Other Sports">Other Sports</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={2} value={gDesc} onChange={(e) => setGDesc(e.target.value)} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Logo URL</label>
                  <input value={gLogo} onChange={(e) => setGLogo(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Banner URL</label>
                  <input value={gBanner} onChange={(e) => setGBanner(e.target.value)} className="input" />
                </div>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowGameModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={submittingAction} className="btn btn-sm">
                  {submittingAction ? 'Saving...' : 'Save Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL RESET MODAL */}
      {showResetModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg border-rose-300">
            <div className="modal-header">
              <h3 className="modal-title text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Full Application-Data Reset
              </h3>
              <button onClick={() => setShowResetModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                Clears operational collections (profiles, academies, stores, grounds, tournaments, bookings, orders, rentals, matches, chats, notifications).
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <strong>Strictly Preserved:</strong> Both permanent admin Firebase Auth accounts, all <code>users</code> &amp; <code>userRoles</code> documents, and master <code>games</code> catalog.
              </div>
              <div>
                <label className="label">Type DELETE ALL DATA to preview &amp; proceed</label>
                <input
                  type="text"
                  value={resetConfirmInput}
                  onChange={(e) => {
                    setResetConfirmInput(e.target.value);
                    setSecondConfirm(false);
                  }}
                  placeholder="DELETE ALL DATA"
                  className="input font-mono"
                />
              </div>
              {secondConfirm && cleanupPreview?.mode === 'complete_reset' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-semibold">
                  Preview generated: ~{cleanupPreview.estimatedTotalDocuments} operational documents will be purged. Click &quot;Confirm and Purge Now&quot; to execute.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowResetModal(false)} className="btn-secondary btn-sm">Cancel</button>
              <button
                type="button"
                onClick={handleCompleteReset}
                disabled={resetConfirmInput !== 'DELETE ALL DATA' || resetSubmitting || previewLoading}
                className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white"
              >
                {resetSubmitting || previewLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                ) : secondConfirm ? (
                  'Confirm and Purge Now'
                ) : (
                  'Generate Preview & Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#16A36A] border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-[#667085]">Loading PlayNex Executive Portal...</p>
        </div>
      }
    >
      <AdminDashboardInner />
    </Suspense>
  );
}
