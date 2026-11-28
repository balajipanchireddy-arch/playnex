'use client';

import { useState, useEffect, useCallback } from 'react';
import Toast from '@/components/ui/Toast';
import MatchmakingChat from '@/components/MatchmakingChat';
import {
  Trophy,
  MapPin,
  Calendar,
  Star,
  Store,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Clock,
  ShieldCheck,
  Edit3,
  Users,
  Compass,
  Bell,
  Package,
  Gamepad2,
  Navigation,
  QrCode,
  MessageSquare,
  Send,
  Upload,
  AlertTriangle,
  GraduationCap,
  Trash2,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

function StarRating({ rating, count }: { rating: number; count: number }) {
  if (!count) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#98A2B3]">
        <Star className="h-3 w-3 text-slate-300" />
        No reviews
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/50">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span>{Number(rating).toFixed(1)}</span>
      <span className="text-[10px] text-amber-600/70 font-normal">({count})</span>
    </div>
  );
}

const RADIUS_OPTIONS = [
  { label: 'All distances', value: 'all' },
  { label: '5 km', value: '5' },
  { label: '10 km', value: '10' },
  { label: '25 km', value: '25' },
  { label: '50 km', value: '50' },
] as const;

export default function PlayerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [academies, setAcademies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchRequests, setMatchRequests] = useState<{ incoming: any[]; outgoing: any[] }>({
    incoming: [],
    outgoing: [],
  });
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [nearbyData, setNearbyData] = useState<{
    callerCity: string;
    hasCallerCoordinates?: boolean;
    totalNearby: number;
    sportCounts: Record<string, number>;
    players: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filters & Location state
  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbySportFilter, setNearbySportFilter] = useState<string>('All');
  const [nearbyAvailableOnly, setNearbyAvailableOnly] = useState<boolean>(false);
  const [radiusFilter, setRadiusFilter] = useState<string>('all');
  const [manualCoords, setManualCoords] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Modals
  const [ratingModal, setRatingModal] = useState<{ id: string; type: 'facility' | 'product'; name: string } | null>(null);
  const [bookingModal, setBookingModal] = useState<{
    facility: any;
    selectedSlot: string;
    bookingDate: string;
    bookedSlotsForDate: string[];
  } | null>(null);
  const [qrPassModal, setQrPassModal] = useState<any | null>(null);
  const [profileModal, setProfileModal] = useState<{
    name: string;
    skill: string;
    location: string;
    lat: string;
    lng: string;
    shareLocation: boolean;
    sportsPreferences?: string[];
  } | null>(null);
  const [tournamentDetailModal, setTournamentDetailModal] = useState<any | null>(null);
  const [preferencesModal, setPreferencesModal] = useState<boolean>(false);
  const [showCreateMatchModal, setShowCreateMatchModal] = useState<boolean>(false);
  const [matchForm, setMatchForm] = useState({
    sport: 'Basketball',
    customSport: '',
    location: '',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '18:00',
    requiredPlayers: 6,
    skillLevel: 'any' as 'beginner' | 'intermediate' | 'advanced' | 'any',
    notes: '',
  });

  // Verification modal
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [verifyForm, setVerifyForm] = useState({
    fullName: '',
    phone: '',
    idType: 'Government ID',
    idNumber: '',
    address: '',
    notes: '',
    proofFileName: '',
    proofMimeType: '',
    proofDataBase64: '',
  });

  // Direct Match Invite modal
  const [inviteModal, setInviteModal] = useState<{ player: any; sport: string; message: string } | null>(null);

  // Product Detail & Rental modals
  const [productDetailModal, setProductDetailModal] = useState<any | null>(null);
  const [rentalModal, setRentalModal] = useState<{
    product: any;
    startDate: string;
    returnDate: string;
    qty: number;
    proofFileName: string;
    proofMimeType: string;
    proofDataBase64: string;
  } | null>(null);

  // Account Deletion Request modal
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountReason, setDeleteAccountReason] = useState('');

  const [notifPrefs, setNotifPrefs] = useState({
    tournaments: true,
    matches: true,
    academy: true,
    promotions: true,
    announcements: true,
  });

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  const buildLocationQuery = useCallback(
    (latOverride?: string, lngOverride?: string, radiusOverride?: string) => {
      const params = new URLSearchParams();
      const lat = latOverride ?? manualCoords.lat;
      const lng = lngOverride ?? manualCoords.lng;
      const rad = radiusOverride ?? radiusFilter;
      if (lat && lng) {
        params.set('lat', lat);
        params.set('lng', lng);
      }
      if (rad && rad !== 'all') {
        params.set('radiusKm', rad);
      }
      const q = params.toString();
      return q ? `?${q}` : '';
    },
    [manualCoords.lat, manualCoords.lng, radiusFilter]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const locQ = buildLocationQuery();
      const [
        profData,
        facData,
        acadData,
        prodData,
        evtData,
        nearbyRes,
        gamesRes,
        matchesRes,
        matchReqRes,
        bookingsRes,
        ordersRes,
        rentalsRes,
        verRes,
      ] = await Promise.all([
        fetch('/api/player/profile').then((r) => r.json()),
        fetch(`/api/facilities${locQ}`).then((r) => r.json()),
        fetch(`/api/academies${locQ}`).then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/tournaments').then((r) => r.json()),
        fetch(`/api/players/nearby${locQ}`).then((r) => r.json()),
        fetch('/api/games').then((r) => r.json()),
        fetch('/api/matches').then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/match-requests').then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/bookings').then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/orders').then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/rentals').then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/player/verification').then((r) => r.json()).catch(() => ({ ok: false })),
      ]);

      if (profData.ok) {
        setProfile(profData.data);
        if (profData.data.notificationPreferences) {
          setNotifPrefs(profData.data.notificationPreferences);
        }
        if (profData.data.coords && !manualCoords.lat) {
          setManualCoords({
            lat: String(profData.data.coords.lat),
            lng: String(profData.data.coords.lng),
          });
        }
      }
      if (facData.ok) setFacilities(facData.data || []);
      if (acadData.ok) setAcademies(acadData.data || []);
      if (prodData.ok) setProducts(prodData.data || []);
      if (evtData.ok) setEvents(evtData.data || []);
      if (nearbyRes.ok) setNearbyData(nearbyRes.data);
      if (gamesRes.ok) setGames(gamesRes.data || []);
      if (matchesRes.ok) setMatches(matchesRes.data || []);
      if (matchReqRes.ok && matchReqRes.data) setMatchRequests(matchReqRes.data);
      if (bookingsRes.ok) setMyBookings(bookingsRes.data || []);
      if (ordersRes.ok) setMyOrders(ordersRes.data || []);
      if (rentalsRes.ok) setMyRentals(rentalsRes.data || []);
      if (verRes.ok) setVerification(verRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildLocationQuery, manualCoords.lat]);

  useEffect(() => {
    loadData();
    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('status', '!=', 'Draft')
      );
      const unsub = onSnapshot(
        eventsQuery,
        (snapshot) => {
          const liveEvents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          liveEvents.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          setEvents(liveEvents);
        },
        () => {}
      );
      return () => unsub();
    } catch {
      return undefined;
    }
  }, [loadData]);

  async function refreshDiscoveryWithLocation(latVal: string, lngVal: string, radVal: string) {
    const locQ = buildLocationQuery(latVal, lngVal, radVal);
    const [facData, acadData, nearbyRes] = await Promise.all([
      fetch(`/api/facilities${locQ}`).then((r) => r.json()),
      fetch(`/api/academies${locQ}`).then((r) => r.json()),
      fetch(`/api/players/nearby${locQ}`).then((r) => r.json()),
    ]);
    if (facData.ok) setFacilities(facData.data || []);
    if (acadData.ok) setAcademies(acadData.data || []);
    if (nearbyRes.ok) setNearbyData(nearbyRes.data);
  }

  function handleDetectGpsForDiscovery() {
    if (!navigator.geolocation) {
      notify('err', 'GPS geolocation is not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setManualCoords({ lat, lng });
        await refreshDiscoveryWithLocation(lat, lng, radiusFilter);
        notify('ok', 'GPS coordinates applied to nearby discovery.');
      },
      () => notify('err', 'Location permission denied. Enter coordinates manually or update your profile.')
    );
  }

  async function toggleAvailability() {
    if (!profile) return;
    const newState = !profile.available;
    setProfile({ ...profile, available: newState });
    try {
      await fetch('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newState }),
      });
      notify('ok', newState ? 'You are now marked available for matches!' : 'You are now marked offline.');
    } catch {
      notify('err', 'Could not update status.');
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileModal) return;
    setActionBusy('profile-save');
    try {
      const lat = profileModal.lat.trim() ? Number(profileModal.lat.trim()) : null;
      const lng = profileModal.lng.trim() ? Number(profileModal.lng.trim()) : null;
      const res = await fetch('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileModal.name,
          skill: profileModal.skill,
          location: profileModal.location,
          lat,
          lng,
          shareLocation: profileModal.shareLocation,
          sportsPreferences: profileModal.sportsPreferences,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (lat && lng) setManualCoords({ lat: String(lat), lng: String(lng) });
        setProfileModal(null);
        notify('ok', 'Athlete profile & location settings saved!');
        await loadData();
      } else {
        notify('err', data.error?.message || 'Failed to update profile.');
      }
    } catch {
      notify('err', 'Network error updating profile.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSaveNotificationPreferences(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy('prefs-save');
    try {
      const res = await fetch('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPreferences: notifPrefs }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', 'Notification preferences saved!');
        setPreferencesModal(false);
      } else {
        notify('err', json.error?.message || 'Failed to save preferences.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setActionBusy(null);
    }
  }

  async function openBookingModal(f: any) {
    if (f.closed) {
      notify('err', 'This ground is temporarily closed for bookings.');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let bookedForDate: string[] = [];
    try {
      const res = await fetch(`/api/bookings?facilityId=${encodeURIComponent(f.id)}&date=${todayStr}`);
      const json = await res.json();
      if (json.ok) bookedForDate = json.data?.bookedSlots || [];
    } catch {
      bookedForDate = [];
    }
    const slots = f.slots || {};
    const firstAvailable =
      Object.keys(slots)
        .sort((a, b) => Number(a) - Number(b))
        .find((k) => slots[k] !== false && !bookedForDate.includes(k)) || '';
    setBookingModal({
      facility: f,
      selectedSlot: firstAvailable,
      bookingDate: todayStr,
      bookedSlotsForDate: bookedForDate,
    });
  }

  async function handleBookingDateChange(newDate: string) {
    if (!bookingModal) return;
    let bookedForDate: string[] = [];
    try {
      const res = await fetch(
        `/api/bookings?facilityId=${encodeURIComponent(bookingModal.facility.id)}&date=${newDate}`
      );
      const json = await res.json();
      if (json.ok) bookedForDate = json.data?.bookedSlots || [];
    } catch {
      bookedForDate = [];
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const slots = bookingModal.facility.slots || {};
    const firstAvail =
      Object.keys(slots)
        .sort((a, b) => Number(a) - Number(b))
        .find(
          (k) => !(newDate === todayStr && slots[k] === false) && !bookedForDate.includes(k)
        ) || '';

    setBookingModal({
      ...bookingModal,
      bookingDate: newDate,
      bookedSlotsForDate: bookedForDate,
      selectedSlot: firstAvail,
    });
  }

  async function handleConfirmBooking() {
    if (!bookingModal || !bookingModal.selectedSlot) return;
    const f = bookingModal.facility;
    const slot = bookingModal.selectedSlot;

    setActionBusy(`book-${f.id}`);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: f.id,
          facilityName: f.name,
          slot,
          bookingDate: bookingModal.bookingDate,
          price: f.price,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Booking ${data.data.bookingCode} confirmed for ${bookingModal.bookingDate} at ${formatSlot(slot)}!`);
        setBookingModal(null);
        setQrPassModal(data.data);
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to book slot.');
      }
    } catch {
      notify('err', 'Network error while booking.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setActionBusy(`cancel-booking-${bookingId}`);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', 'Booking cancelled and court slot released.');
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to cancel booking.');
      }
    } catch {
      notify('err', 'Network error while cancelling booking.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy('create-match');
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...matchForm,
          requiredPlayers: Number(matchForm.requiredPlayers),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', 'Match published! Other players can now discover and request to join.');
        setShowCreateMatchModal(false);
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to create match.');
      }
    } catch {
      notify('err', 'Network error creating match.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleMatchAction(matchId: string, action: string, targetUserId?: string) {
    setActionBusy(`match-${matchId}-${action}`);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetUserId }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Match updated (${action.replace('_', ' ')}).`);
        loadData();
      } else {
        notify('err', data.error?.message || 'Match action failed.');
      }
    } catch {
      notify('err', 'Network error updating match.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleOpenMatchChat(matchId: string) {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const json = await res.json();
      if (json.ok) {
        setActiveChatId(json.data.id);
        document.getElementById('matchmaking-chat-section')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        notify('err', json.error?.message || 'Could not open match chat.');
      }
    } catch {
      notify('err', 'Network error.');
    }
  }

  async function handleSendDirectInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteModal) return;
    setActionBusy('send-invite');
    try {
      const res = await fetch('/api/match-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: inviteModal.player.id,
          sport: inviteModal.sport,
          message: inviteModal.message,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Match request sent to ${inviteModal.player.name}!`);
        setInviteModal(null);
        loadData();
      } else {
        notify('err', json.error?.message || 'Failed to send invite.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDirectRequestAction(requestId: string, action: 'accept' | 'reject' | 'withdraw') {
    setActionBusy(`mreq-${requestId}`);
    try {
      const res = await fetch('/api/match-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const json = await res.json();
      if (json.ok) {
        notify(
          'ok',
          action === 'accept'
            ? 'Match request accepted! Chat unlocked below.'
            : `Match request ${action}ed.`
        );
        if (action === 'accept' && json.data?.chatId) {
          setActiveChatId(json.data.chatId);
        }
        loadData();
      } else {
        notify('err', json.error?.message || 'Could not update request.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setActionBusy(null);
    }
  }

  function handleProofFileSelect(
    file: File | undefined,
    onLoaded: (meta: { name: string; mime: string; base64: string }) => void
  ) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      notify('err', 'Please select a JPEG, PNG, WebP, or PDF file.');
      return;
    }
    if (file.size > 750 * 1024) {
      notify('err', 'Proof file must be under 750 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      onLoaded({ name: file.name, mime: file.type, base64: result });
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyForm.proofDataBase64) {
      notify('err', 'Please upload an identity document image or PDF.');
      return;
    }
    setActionBusy('submit-verification');
    try {
      const res = await fetch('/api/player/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyForm),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', 'Verification proof securely stored for Admin review.');
        setShowVerificationModal(false);
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to submit verification.');
      }
    } catch {
      notify('err', 'Network error submitting verification.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleBuy(p: any) {
    setActionBusy(`buy-${p.id}`);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, productName: p.name, storeId: p.storeId, price: p.price, qty: 1 }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Order placed for ${p.name}! Payment status: Unpaid (pay on delivery/pickup).`);
        setProductDetailModal(null);
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to place order.');
      }
    } catch {
      notify('err', 'Network error during purchase.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConfirmRental(e: React.FormEvent) {
    e.preventDefault();
    if (!rentalModal) return;
    setActionBusy(`rent-${rentalModal.product.id}`);
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: rentalModal.product.id,
          startDate: rentalModal.startDate,
          returnDate: rentalModal.returnDate,
          qty: Number(rentalModal.qty),
          proofFileName: rentalModal.proofFileName || undefined,
          proofMimeType: rentalModal.proofMimeType || undefined,
          proofDataBase64: rentalModal.proofDataBase64 || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Rental booked (${rentalModal.startDate} to ${rentalModal.returnDate}). Payment: Unpaid (pay at pickup).`);
        setRentalModal(null);
        loadData();
      } else {
        notify('err', json.error?.message || 'Failed to submit rental.');
      }
    } catch {
      notify('err', 'Network error submitting rental.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRegisterTournament(t: any) {
    setActionBusy(`tour-${t.id}`);
    try {
      const res = await fetch(`/api/tournaments/${t.id}/registrations`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Registration confirmed for "${t.name}"!`);
        setTournamentDetailModal(null);
        loadData();
      } else {
        notify('err', data.error?.message || 'Could not register for tournament.');
      }
    } catch {
      notify('err', 'Network error during tournament registration.');
    } finally {
      setActionBusy(null);
    }
  }

  async function submitRating(score: number) {
    if (!ratingModal) return;
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: ratingModal.id, targetType: ratingModal.type, rating: score }),
      });
      if ((await res.json()).ok) {
        notify('ok', `Thank you for rating ${ratingModal.name} ${score} stars!`);
        setRatingModal(null);
        loadData();
      }
    } catch {
      notify('err', 'Failed to submit rating.');
    }
  }

  async function handleRequestAccountDeletion(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy('delete-account-req');
    try {
      const res = await fetch('/api/player/account-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteAccountReason }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', 'Account deletion request submitted for administrator review.');
        setShowDeleteAccountModal(false);
        setDeleteAccountReason('');
      } else {
        notify('err', json.error?.message || 'Failed to submit request.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setActionBusy(null);
    }
  }

  const formatSlot = (h: string) => {
    const val = parseInt(h);
    const hour = val % 12 || 12;
    const ampm = val >= 12 ? 'PM' : 'AM';
    return `${hour}:00 ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#16A36A] border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-[#667085]">Loading your player dashboard...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-bold text-[#172033]">Profile Not Ready</h3>
        <p className="text-xs text-[#667085] mt-1">Please sign in again to initialize your athlete profile.</p>
      </div>
    );
  }

  const availableSports = [
    'All',
    ...Array.from(new Set([...games.map((g: any) => g.name), 'Basketball', 'Football', 'Cricket', 'Tennis'])),
  ];

  const filteredEvents = events.filter((e) => {
    if (e.status === 'Draft') return false;
    const matchesSport =
      selectedSport === 'All' ||
      e.sport?.toLowerCase() === selectedSport.toLowerCase() ||
      e.sport?.toLowerCase().includes(selectedSport.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.venue || e.loc)?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const filteredFacilities = facilities.filter((f) => {
    const matchesSport = selectedSport === 'All' || f.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.address?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const filteredProducts = products.filter((p) => {
    const matchesSport = selectedSport === 'All' || p.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const nearbyPlayersList = (nearbyData?.players || []).filter((p) => {
    if (nearbySportFilter !== 'All' && !p.sports?.includes(nearbySportFilter)) return false;
    if (nearbyAvailableOnly && !p.available) return false;
    return true;
  });

  const isSuspended = Boolean(verification?.isSuspended || profile?.verification?.isSuspended);

  return (
    <div className="space-y-8 relative">
      <Toast message={notification} onClose={() => setNotification(null)} />

      {/* SUSPENSION NOTICE IF 5-DAY VERIFICATION EXPIRED */}
      {isSuspended && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-extrabold text-rose-900">
                Account Suspended — Player Verification Required
              </h2>
              <p className="text-xs text-rose-800 mt-1">
                Your 5-day verification window expired without approved identity proof. Bookings, tournament registrations, matchmaking, and store orders are paused until you submit proof and an administrator approves it.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setVerifyForm({
                fullName: profile?.name || '',
                phone: '',
                idType: 'Government ID',
                idNumber: '',
                address: profile?.location || '',
                notes: '',
                proofFileName: '',
                proofMimeType: '',
                proofDataBase64: '',
              });
              setShowVerificationModal(true);
            }}
            className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white shrink-0"
          >
            Submit Proof to Restore Access
          </button>
        </div>
      )}

      {/* Hero Athlete Overview Card */}
      <div className="card bg-white text-[#172033] border-[#E5E7EB] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#16A36A] overflow-hidden shrink-0">
              <img src="/icons/players.jpg" alt="Players" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  Athlete Dashboard
                </span>
                <span className="badge badge-brand text-[10px] font-bold uppercase">
                  {profile.skill || 'Intermediate'}
                </span>
                <span
                  className={`badge text-[10px] font-bold uppercase ${
                    verification?.status === 'approved'
                      ? 'badge-ok'
                      : isSuspended
                      ? 'badge-bad'
                      : 'badge-warn'
                  }`}
                >
                  {verification?.status === 'approved'
                    ? 'Verified'
                    : isSuspended
                    ? 'Suspended'
                    : `${verification?.daysRemaining ?? 5}d Verification Window`}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033]">
                {profile.name}
              </h1>
              <p className="text-xs text-[#667085] flex items-center gap-1.5 mt-0.5 flex-wrap">
                <MapPin className="h-3.5 w-3.5 text-[#667085]" />
                <span>{profile.location || 'Location not set'}</span>
                <span>•</span>
                <span>Sports: {profile.sportsPreferences?.join(', ') || 'Basketball, Football'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={toggleAvailability}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs border ${
                profile.available
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 border-[#E5E7EB] text-[#667085] hover:bg-slate-200'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${profile.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{profile.available ? 'Available for Games' : 'Marked Offline'}</span>
            </button>

            <button
              onClick={() => setPreferencesModal(true)}
              className="btn-secondary btn-sm text-xs"
            >
              <Bell className="h-3.5 w-3.5 text-[#16A36A]" />
              Alerts
            </button>

            <button
              onClick={() =>
                setProfileModal({
                  name: profile.name,
                  skill: profile.skill,
                  location: profile.location || '',
                  lat: profile.coords?.lat ? String(profile.coords.lat) : '',
                  lng: profile.coords?.lng ? String(profile.coords.lng) : '',
                  shareLocation: Boolean(profile.shareLocation),
                  sportsPreferences: profile.sportsPreferences,
                })
              }
              className="btn-secondary btn-sm text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Profile &amp; Location
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-[#667085] font-medium">Turf Arenas</p>
            <p className="text-xl font-bold text-[#172033] mt-0.5">{facilities.length} available</p>
          </div>
          <div>
            <p className="text-[#667085] font-medium">Live Tournaments</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{events.filter((e) => e.status !== 'Draft').length} open</p>
          </div>
          <div>
            <p className="text-[#667085] font-medium">Nearby Players</p>
            <p className="text-xl font-bold text-[#16A36A] mt-0.5">{nearbyData?.totalNearby || 0} discovered</p>
          </div>
          <div>
            <p className="text-[#667085] font-medium">Bookings &amp; Gear</p>
            <p className="text-xl font-bold text-[#101828] mt-0.5">
              {myBookings.length} bookings · {myOrders.length + myRentals.length} orders
            </p>
          </div>
        </div>
      </div>

      {/* ── PLAYER VERIFICATION 5-DAY COUNTDOWN CARD ────────────────────── */}
      <section className="card p-6 border-[#E5E7EB] bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-[#172033]">Player Identity Verification</h2>
                <span
                  className={`badge text-[10px] uppercase font-bold ${
                    verification?.status === 'approved'
                      ? 'badge-ok'
                      : verification?.status === 'rejected' ||
                        verification?.status === 'resubmission_required' ||
                        isSuspended
                      ? 'badge-bad'
                      : verification?.status === 'pending' || verification?.status === 'under_review'
                      ? 'badge-warn'
                      : 'badge-neutral'
                  }`}
                >
                  {(verification?.status || 'not_submitted').replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                {verification?.status === 'approved'
                  ? 'Your athlete identity is verified across PlayNex.'
                  : verification?.verificationDeadline
                  ? `Server deadline: ${new Date(verification.verificationDeadline).toLocaleString()} (${verification.daysRemaining} day(s) left). Unverified accounts are suspended after 5 days until approved.`
                  : 'Verify your identity within 5 days of signup to keep full platform access.'}
              </p>
              {verification?.reason && (
                <p className="text-xs text-rose-700 font-semibold mt-1">Review note: {verification.reason}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(!verification?.status ||
              ['not_submitted', 'rejected', 'resubmission_required', 'suspended_expired'].includes(
                verification.status
              )) && (
              <button
                onClick={() => {
                  setVerifyForm({
                    fullName: profile?.name || '',
                    phone: '',
                    idType: 'Government ID',
                    idNumber: '',
                    address: profile?.location || '',
                    notes: '',
                    proofFileName: '',
                    proofMimeType: '',
                    proofDataBase64: '',
                  });
                  setShowVerificationModal(true);
                }}
                className="btn btn-sm text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                {verification?.status === 'rejected' ||
                verification?.status === 'resubmission_required' ||
                isSuspended
                  ? 'Resubmit Proof'
                  : 'Submit Proof'}
              </button>
            )}
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="btn-secondary btn-sm text-xs text-rose-700"
              title="Request account deletion"
            >
              <Trash2 className="h-3.5 w-3.5" /> Account Deletion
            </button>
          </div>
        </div>
      </section>

      {/* FILTER, LOCATION RADIUS & SEARCH STRIP */}
      <div className="card p-4 border-[#E5E7EB] bg-white space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {availableSports.map((sport) => {
              const isSelected = selectedSport === sport;
              return (
                <button
                  key={sport}
                  onClick={() => setSelectedSport(sport)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#101828] text-white shadow-xs'
                      : 'bg-slate-100 text-[#667085] hover:bg-slate-200 hover:text-[#172033]'
                  }`}
                >
                  {sport}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
            <input
              type="text"
              placeholder="Search tournaments, grounds, gear..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* GPS + Manual Location & Distance Radius Filter */}
        <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#667085] flex items-center gap-1">
              <Compass className="h-3.5 w-3.5 text-[#16A36A]" /> Distance Filter:
            </span>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={async () => {
                  setRadiusFilter(opt.value);
                  await refreshDiscoveryWithLocation(manualCoords.lat, manualCoords.lng, opt.value);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold border transition ${
                  radiusFilter === opt.value
                    ? 'bg-[#E8F5EE] text-[#0E7055] border-green-300'
                    : 'bg-white text-[#667085] border-[#E5E7EB] hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDetectGpsForDiscovery}
              className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
            >
              <Navigation className="h-3 w-3 text-[#16A36A]" /> Use GPS
            </button>
            <input
              type="number"
              step="any"
              placeholder="Lat"
              value={manualCoords.lat}
              onChange={(e) => setManualCoords({ ...manualCoords, lat: e.target.value })}
              className="input py-1 px-2 text-[11px] w-24"
            />
            <input
              type="number"
              step="any"
              placeholder="Lng"
              value={manualCoords.lng}
              onChange={(e) => setManualCoords({ ...manualCoords, lng: e.target.value })}
              className="input py-1 px-2 text-[11px] w-24"
            />
            <button
              type="button"
              onClick={() => refreshDiscoveryWithLocation(manualCoords.lat, manualCoords.lng, radiusFilter)}
              className="btn btn-sm text-[11px] py-1 px-2.5"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* 1. REAL-TIME TOURNAMENTS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center overflow-hidden">
            <img src="/icons/tournament.jpg" alt="Tournament" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#172033]">
              Tournaments &amp; Championships ({filteredEvents.length})
            </h2>
            <p className="text-xs text-[#667085]">Live tournament sync across academies and PlayNex</p>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="card text-center py-10">
            <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#667085]">No tournaments match your current filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e) => {
              const maxP = e.maxParticipants || 32;
              const regP = e.registeredCount || 0;
              const slotsLeft = Math.max(0, maxP - regP);
              const isFull = slotsLeft === 0;
              return (
                <div key={e.id} className="card card-hover flex flex-col justify-between border-l-4 border-l-amber-500 p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="badge badge-brand text-[10px]">{e.sport}</span>
                          <span className={`badge text-[10px] font-bold ${e.status === 'Registration Open' ? 'badge-ok' : 'badge-neutral'}`}>
                            {e.status || 'Active'}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-[#172033] leading-snug">{e.name}</h3>
                        <p className="text-[11px] text-[#98A2B3] font-medium">By {e.academyName || 'PlayNex Official'}</p>
                      </div>
                      <span className="badge badge-warn text-xs font-black">₹{e.entryFee || e.price || 0}</span>
                    </div>
                    <div className="mt-4 space-y-1.5 text-xs text-[#667085]">
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {e.venue || e.loc || 'TBA'}</p>
                      <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 shrink-0" /> {e.date || 'Date TBA'}</p>
                      <p className="flex items-center gap-1.5 text-[#0E7055] font-bold">
                        <Users className="h-3.5 w-3.5 shrink-0" /> {regP} / {maxP} registered ({slotsLeft} left)
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center gap-2">
                    <button onClick={() => setTournamentDetailModal(e)} className="btn btn-sm btn-secondary text-xs flex-1">
                      Details
                    </button>
                    <button
                      onClick={() => handleRegisterTournament(e)}
                      disabled={isFull || actionBusy === `tour-${e.id}` || isSuspended}
                      className="btn btn-sm text-xs flex-1"
                    >
                      {actionBusy === `tour-${e.id}` ? 'Registering...' : isFull ? 'Full' : 'Register'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. NEARBY PLAYERS DISCOVERY + DIRECT INVITES */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#172033]">
                Nearby Players ({nearbyPlayersList.length})
              </h2>
              <p className="text-xs text-[#667085]">
                Privacy-preserving discovery — send a match invite to unlock direct chat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={nearbySportFilter}
              onChange={(e) => setNearbySportFilter(e.target.value)}
              className="input py-1 text-xs w-auto"
            >
              <option value="All">All Sports</option>
              {availableSports.filter((s) => s !== 'All').map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => setNearbyAvailableOnly(!nearbyAvailableOnly)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                nearbyAvailableOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-[#667085] border-[#E5E7EB]'
              }`}
            >
              {nearbyAvailableOnly ? '✓ Available only' : 'Show all'}
            </button>
          </div>
        </div>

        {nearbyPlayersList.length === 0 ? (
          <div className="card text-center py-8">
            <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#667085]">No nearby players matched your filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nearbyPlayersList.map((player) => (
              <div key={player.id} className="card p-4 border-[#E5E7EB] flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#101828] text-white font-black flex items-center justify-center text-sm">
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#172033]">{player.name}</h4>
                        <span className="text-[10px] text-[#667085] font-medium">{player.skillLevel}</span>
                      </div>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${player.available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {player.sports?.map((sp: string) => (
                      <span key={sp} className="badge badge-neutral text-[9px] py-0 px-1.5">{sp}</span>
                    ))}
                  </div>
                </div>
                <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#667085]">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {player.approxDistance}</span>
                    <span className="font-semibold text-[#172033]">{player.city}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isSuspended}
                    onClick={() =>
                      setInviteModal({
                        player,
                        sport: player.sports?.[0] || 'Basketball',
                        message: '',
                      })
                    }
                    className="btn btn-sm w-full text-xs"
                  >
                    <Send className="h-3 w-3" /> Send Match Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MATCHMAKING REQUESTS (INCOMING & OUTGOING) */}
      {(matchRequests.incoming.length > 0 || matchRequests.outgoing.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#172033]">
              Incoming Match Requests ({matchRequests.incoming.filter((r) => r.status === 'pending').length} pending)
            </h3>
            {matchRequests.incoming.length === 0 ? (
              <p className="text-xs text-[#667085]">No incoming invites yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {matchRequests.incoming.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-[#172033]">{r.fromName} · {r.sport}</p>
                      {r.message && <p className="text-[11px] text-[#667085]">{r.message}</p>}
                      <span className={`badge text-[9px] uppercase mt-1 ${r.status === 'accepted' ? 'badge-ok' : r.status === 'pending' ? 'badge-warn' : 'badge-neutral'}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleDirectRequestAction(r.id, 'accept')} className="btn btn-sm text-[11px] py-1 px-2.5">
                          Accept
                        </button>
                        <button onClick={() => handleDirectRequestAction(r.id, 'reject')} className="btn-secondary btn-sm text-[11px] py-1 px-2">
                          Reject
                        </button>
                      </div>
                    )}
                    {r.status === 'accepted' && r.chatId && (
                      <button
                        onClick={() => {
                          setActiveChatId(r.chatId);
                          document.getElementById('matchmaking-chat-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                      >
                        Chat
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#172033]">
              Sent Match Requests ({matchRequests.outgoing.length})
            </h3>
            {matchRequests.outgoing.length === 0 ? (
              <p className="text-xs text-[#667085]">No outgoing requests yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {matchRequests.outgoing.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-[#172033]">To {r.toName} · {r.sport}</p>
                      <span className={`badge text-[9px] uppercase mt-1 ${r.status === 'accepted' ? 'badge-ok' : r.status === 'pending' ? 'badge-warn' : 'badge-neutral'}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.status === 'pending' && (
                      <button onClick={() => handleDirectRequestAction(r.id, 'withdraw')} className="btn-secondary btn-sm text-[11px] py-1 px-2.5">
                        Withdraw
                      </button>
                    )}
                    {r.status === 'accepted' && r.chatId && (
                      <button
                        onClick={() => {
                          setActiveChatId(r.chatId);
                          document.getElementById('matchmaking-chat-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                      >
                        Open Chat
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. OPEN MATCHES & MATCHMAKING HUB */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#172033]">
                Open Matches &amp; Lobby ({matches.length})
              </h2>
              <p className="text-xs text-[#667085]">Join open games, accept requests, and unlock team chat</p>
            </div>
          </div>
          <button
            disabled={isSuspended}
            onClick={() => setShowCreateMatchModal(true)}
            className="btn btn-sm text-xs shrink-0"
          >
            <Gamepad2 className="h-3.5 w-3.5" /> Create Match
          </button>
        </div>

        {matches.length === 0 ? (
          <div className="empty-state py-10">
            <div className="empty-state-icon"><Users className="h-6 w-6" /></div>
            <p className="empty-state-title">No open matches right now</p>
            <p className="empty-state-desc">Create a match and invite nearby players to join your game.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((m) => {
              const isCreator = m.creatorId === profile.uid;
              const isParticipant = Array.isArray(m.participants) && m.participants.includes(profile.uid);
              const isPending = Array.isArray(m.pendingRequests) && m.pendingRequests.some((r: any) => r.userId === profile.uid);

              return (
                <div key={m.id} className="card p-5 flex flex-col justify-between border-[#E5E7EB] space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="badge badge-brand text-[10px]">{m.sport}</span>
                      <span className={`badge text-[10px] uppercase font-bold ${m.status === 'open' ? 'badge-ok' : m.status === 'full' || m.status === 'ready' ? 'badge-warn' : 'badge-bad'}`}>
                        {m.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-[#172033]">{m.location}</h3>
                    <div className="mt-2 space-y-1 text-xs text-[#667085]">
                      <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {m.date} at {m.time}</p>
                      <p className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> {m.participantCount || m.participants?.length || 1} / {m.requiredPlayers} players · Skill: {m.skillLevel || 'any'}
                      </p>
                      <p className="text-[11px]">Host: <span className="font-semibold text-[#172033]">{m.creatorName || 'Player'}</span></p>
                    </div>

                    {isCreator && Array.isArray(m.pendingRequests) && m.pendingRequests.length > 0 && (
                      <div className="mt-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-2">
                        <p className="text-[10px] font-bold uppercase text-[#667085]">
                          Pending Join Requests ({m.pendingRequests.length})
                        </p>
                        {m.pendingRequests.map((req: any) => (
                          <div key={req.userId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold truncate">{req.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMatchAction(m.id, 'accept', req.userId)}
                                className="btn btn-sm text-[10px] py-0.5 px-2"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleMatchAction(m.id, 'reject', req.userId)}
                                className="btn-secondary btn-sm text-[10px] py-0.5 px-2"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB] flex items-center gap-2 flex-wrap">
                    {isParticipant ? (
                      <>
                        <button
                          onClick={() => handleOpenMatchChat(m.id)}
                          className="btn btn-sm flex-1 text-xs"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Match Chat
                        </button>
                        {!isCreator ? (
                          <button
                            onClick={() => handleMatchAction(m.id, 'leave')}
                            className="btn-secondary btn-sm text-xs"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMatchAction(m.id, 'cancel')}
                            className="btn-danger btn-sm text-xs"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    ) : isPending ? (
                      <button
                        onClick={() => handleMatchAction(m.id, 'withdraw')}
                        disabled={actionBusy === `match-${m.id}-withdraw`}
                        className="btn-secondary btn-sm flex-1 text-xs"
                      >
                        Withdraw Request
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMatchAction(m.id, 'join_request')}
                        disabled={isSuspended || actionBusy === `match-${m.id}-join_request` || m.status === 'cancelled' || m.status === 'expired'}
                        className="btn btn-sm flex-1 text-xs"
                      >
                        {m.status === 'full' ? 'Join Waitlist' : 'Request to Join'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* REAL-TIME MATCHMAKING CHAT */}
      <section id="matchmaking-chat-section">
        <MatchmakingChat
          currentUserId={profile.uid}
          onNotify={notify}
          initialChatId={activeChatId}
        />
      </section>

      {/* 4. NEARBY TURF GROUNDS & ACADEMIES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center overflow-hidden">
            <img src="/icons/ground.jpg" alt="Ground" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-lg font-extrabold text-[#172033]">
            Turf Arenas &amp; Grounds ({filteredFacilities.length})
          </h2>
        </div>

        {filteredFacilities.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-xs font-semibold text-[#667085]">No grounds matched your filter or distance radius.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFacilities.map((f) => (
              <div key={f.id} className="card card-hover p-0 overflow-hidden flex flex-col justify-between border-[#E5E7EB]">
                <div>
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    {f.image ? (
                      <img src={f.image} alt={f.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <MapPin className="h-12 w-12" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 badge bg-white/95 text-[#172033] text-xs font-bold">{f.sport}</span>
                    {f.distanceLabel && (
                      <span className="absolute bottom-3 left-3 badge bg-[#101828]/90 text-white text-[10px]">
                        {f.distanceLabel}
                      </span>
                    )}
                    {f.closed && (
                      <span className="absolute top-3 right-3 badge bg-rose-600 text-white text-xs font-bold">Closed</span>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-[#172033]">{f.name}</h3>
                          {f.academyVerification === 'approved' && (
                            <span className="badge badge-ok text-[9px] font-bold">Verified</span>
                          )}
                        </div>
                        {f.academyName && <p className="text-[11px] text-[#98A2B3] font-medium">{f.academyName}</p>}
                      </div>
                      <StarRating rating={f.rating || 0} count={f.ratingCount || 0} />
                    </div>
                    <p className="mt-2 text-xs text-[#667085] flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{f.address || 'Address provided upon booking'}</span>
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-[#16A36A]">₹{f.price}</span>
                        <span className="text-[11px] font-semibold text-[#98A2B3]">/ hour</span>
                      </div>
                      <span className={`badge text-[10px] ${f.closed ? 'badge-bad' : 'badge-ok'}`}>
                        {f.closed ? 'Unavailable' : 'Active Slots'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-5 pt-0 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openBookingModal(f)}
                    disabled={f.closed || isSuspended || actionBusy === `book-${f.id}`}
                    className="btn btn-sm text-xs"
                  >
                    {f.closed ? 'Closed' : 'Book Slot'}
                  </button>
                  <button
                    onClick={() => setRatingModal({ id: f.id, type: 'facility', name: f.name })}
                    className="btn btn-sm btn-secondary text-xs"
                  >
                    Rate Arena
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nearby Verified Academies Strip */}
        {academies.length > 0 && (
          <div className="pt-4 space-y-3">
            <h3 className="text-sm font-extrabold text-[#172033] flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#16A36A]" />
              Nearby Verified Academies ({academies.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {academies.map((a) => (
                <div key={a.id} className="card p-4 border-[#E5E7EB] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#172033] truncate">{a.academyName}</p>
                    <p className="text-xs text-[#667085] truncate">{a.address || a.city || 'Location pending'}</p>
                  </div>
                  {a.distanceLabel && (
                    <span className="badge badge-brand text-[10px] shrink-0">{a.distanceLabel}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. MY COURT BOOKINGS WITH QR PASSES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E8EAF0] text-[#101828] flex items-center justify-center">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#172033]">My Court Bookings ({myBookings.length})</h2>
            <p className="text-xs text-[#667085]">Present your unique QR pass at the ground for staff attendance verification</p>
          </div>
        </div>

        {myBookings.length === 0 ? (
          <div className="card p-6 text-center text-xs text-[#667085]">
            You have no court bookings yet. Select a ground above to reserve a slot.
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="data-table">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Code</th>
                  <th>Venue</th>
                  <th>Date &amp; Slot</th>
                  <th>Fee / Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono font-bold text-xs">{b.bookingCode || b.id.slice(0, 8)}</td>
                    <td className="font-semibold text-xs">{b.facilityName}</td>
                    <td className="text-xs">{b.bookingDate || 'Today'} · {formatSlot(String(b.slot))}</td>
                    <td className="text-xs">
                      <span className="font-bold">₹{b.price}</span>
                      <span className="block text-[10px] text-amber-700">{b.paymentStatus || 'unpaid'}</span>
                    </td>
                    <td>
                      <span
                        className={`badge text-[10px] uppercase ${
                          b.status === 'confirmed' || b.status === 'checked_in' || b.status === 'completed'
                            ? 'badge-ok'
                            : 'badge-bad'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {b.qrPayload && b.status !== 'cancelled' && (
                          <button
                            onClick={() => setQrPassModal(b)}
                            className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                          >
                            <QrCode className="h-3.5 w-3.5 text-[#16A36A]" /> QR Pass
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            disabled={actionBusy === `cancel-booking-${b.id}`}
                            className="btn-danger btn-sm text-[11px] py-1 px-2.5"
                          >
                            Cancel
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
      </section>

      {/* 6. SPORTS GEAR STORE (PURCHASE & RENTAL) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center overflow-hidden">
            <img src="/icons/gear.jpg" alt="Gear" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#172033]">
              Sports Gear — Purchase &amp; Rental ({filteredProducts.length})
            </h2>
            <p className="text-xs text-[#667085]">Buy equipment or rent by date with configurable security deposit</p>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-xs font-semibold text-[#667085]">No gear items found for this selection.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((p) => {
              const canBuy = p.allowPurchase !== false && p.qty > 0;
              const canRent = Boolean(p.allowRental) && (p.rentalQty ?? p.qty) > 0;
              return (
                <div key={p.id} className="card card-hover p-0 overflow-hidden flex flex-col justify-between border-[#E5E7EB]">
                  <div>
                    <div
                      onClick={() => setProductDetailModal(p)}
                      className="relative h-36 w-full bg-slate-100 overflow-hidden cursor-pointer"
                    >
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Package className="h-10 w-10" />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 badge bg-white/95 text-[#172033] text-[10px] font-bold">
                        {p.sport}
                      </span>
                      {p.allowRental && (
                        <span className="absolute top-2 right-2 badge bg-amber-500 text-white text-[10px] font-bold">
                          Rent ₹{p.rentalPricePerDay}/d
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3
                        onClick={() => setProductDetailModal(p)}
                        className="font-bold text-sm text-[#172033] line-clamp-1 cursor-pointer hover:text-[#16A36A]"
                      >
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-[#98A2B3] truncate">{p.storeName || 'Verified Store'}</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        {p.allowPurchase !== false ? (
                          <span className="font-extrabold text-[#16A36A] text-sm">₹{p.price}</span>
                        ) : (
                          <span className="text-xs font-bold text-amber-700">Rental Only</span>
                        )}
                        <StarRating rating={p.rating || 0} count={p.ratingCount || 0} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {p.allowPurchase !== false && (
                        <button
                          onClick={() => handleBuy(p)}
                          disabled={!canBuy || isSuspended || actionBusy === `buy-${p.id}`}
                          className="btn btn-sm flex-1 text-xs"
                        >
                          {!canBuy ? 'Out of stock' : actionBusy === `buy-${p.id}` ? 'Ordering...' : 'Buy'}
                        </button>
                      )}
                      {p.allowRental && (
                        <button
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setRentalModal({
                              product: p,
                              startDate: today,
                              returnDate: today,
                              qty: 1,
                              proofFileName: '',
                              proofMimeType: '',
                              proofDataBase64: '',
                            });
                          }}
                          disabled={!canRent || isSuspended}
                          className="btn-secondary btn-sm flex-1 text-xs"
                        >
                          Rent
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#667085]">
                      <button onClick={() => setProductDetailModal(p)} className="hover:text-[#172033] font-semibold">
                        Details
                      </button>
                      <button
                        onClick={() => setRatingModal({ id: p.id, type: 'product', name: p.name })}
                        className="hover:text-[#16A36A] font-semibold"
                      >
                        Rate gear
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My Purchase Orders & Gear Rentals History */}
        {(myOrders.length > 0 || myRentals.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#172033]">My Gear Orders ({myOrders.length})</h3>
              {myOrders.length === 0 ? (
                <p className="text-xs text-[#667085]">No purchase orders yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {myOrders.map((o) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#172033]">{o.productName} × {o.qty}</p>
                        <p className="text-[11px] text-[#667085]">₹{o.total} · Payment: {o.paymentStatus || 'unpaid'}</p>
                      </div>
                      <span className="badge badge-brand text-[10px] uppercase">{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-extrabold text-[#172033]">My Gear Rentals ({myRentals.length})</h3>
              {myRentals.length === 0 ? (
                <p className="text-xs text-[#667085]">No rentals yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {myRentals.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#172033]">{r.productName} ({r.startDate} → {r.returnDate})</p>
                        <p className="text-[11px] text-[#667085]">
                          ₹{r.rentalSubtotal} + Deposit ₹{r.securityDeposit || 0} · Payment: {r.paymentStatus || 'unpaid'}
                        </p>
                      </div>
                      <span className={`badge text-[10px] uppercase ${r.status === 'returned' ? 'badge-ok' : r.status === 'overdue' ? 'badge-bad' : 'badge-warn'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL: BOOKING SLOT + DATE PICKER */}
      {bookingModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">Book Ground Slot</h3>
              <button onClick={() => setBookingModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-4 text-xs">
              <div>
                <h4 className="font-extrabold text-base text-[#172033]">{bookingModal.facility.name}</h4>
                <p className="text-[#667085]">{bookingModal.facility.address} · ₹{bookingModal.facility.price}/hr</p>
              </div>
              <div>
                <label className="label">Booking Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={bookingModal.bookingDate}
                  onChange={(e) => handleBookingDateChange(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Hourly Slots ({bookingModal.bookingDate})</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {Object.keys(bookingModal.facility.slots || {})
                    .sort((a, b) => Number(a) - Number(b))
                    .map((s) => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isBookedOnDate =
                        bookingModal.bookedSlotsForDate.includes(s) ||
                        (bookingModal.bookingDate === todayStr && bookingModal.facility.slots[s] === false);
                      const isSel = bookingModal.selectedSlot === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={isBookedOnDate}
                          onClick={() => setBookingModal({ ...bookingModal, selectedSlot: s })}
                          className={`p-2 rounded-xl text-center text-xs font-bold border transition ${
                            isBookedOnDate
                              ? 'bg-slate-100 text-slate-400 border-[#E5E7EB] cursor-not-allowed line-through'
                              : isSel
                              ? 'bg-[#16A36A] text-white border-[#16A36A] shadow-sm'
                              : 'bg-white text-[#172033] border-[#E5E7EB] hover:bg-slate-50'
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900">
                Payment is collected at the venue (Payment status: <strong>Unpaid</strong>). A unique QR attendance pass will be generated upon booking.
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setBookingModal(null)} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={handleConfirmBooking}
                disabled={!bookingModal.selectedSlot || actionBusy === `book-${bookingModal.facility.id}`}
                className="btn btn-sm"
              >
                {actionBusy === `book-${bookingModal.facility.id}` ? 'Confirming...' : `Confirm Booking (₹${bookingModal.facility.price})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR ATTENDANCE PASS */}
      {qrPassModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm text-center">
            <div className="modal-header">
              <h3 className="modal-title">Ground Check-In QR Pass</h3>
              <button onClick={() => setQrPassModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-3 text-xs">
              <p className="font-bold text-sm text-[#172033]">{qrPassModal.facilityName}</p>
              <p className="text-[#667085]">
                {qrPassModal.bookingDate} · {formatSlot(String(qrPassModal.slot))}
              </p>
              {qrPassModal.qrDataUrl ? (
                <img
                  src={qrPassModal.qrDataUrl}
                  alt="Booking QR Pass"
                  className="mx-auto h-48 w-48 rounded-xl border border-[#E5E7EB] p-2 bg-white"
                />
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-[#E5E7EB] font-mono text-[11px] break-all">
                  {qrPassModal.qrPayload}
                </div>
              )}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                <span className="text-[10px] text-[#667085] block">Booking Code</span>
                <span className="font-mono font-extrabold text-sm text-[#101828]">
                  {qrPassModal.bookingCode || qrPassModal.bookingId}
                </span>
              </div>
              <p className="text-[11px] text-[#667085]">
                Show this QR code to academy ground staff at check-in. Single-use validation is enforced server-side.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRODUCT DETAIL */}
      {productDetailModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">{productDetailModal.name}</h3>
              <button onClick={() => setProductDetailModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-3 text-xs">
              {productDetailModal.image && (
                <img src={productDetailModal.image} alt={productDetailModal.name} className="w-full h-48 object-cover rounded-xl border border-[#E5E7EB]" />
              )}
              <div className="flex items-center gap-2">
                <span className="badge badge-brand">{productDetailModal.sport}</span>
                <span className="badge badge-neutral">{productDetailModal.category || 'Equipment'}</span>
              </div>
              <p className="text-[#667085] leading-relaxed">
                {productDetailModal.description || 'Quality sports gear from a verified PlayNex store.'}
              </p>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-1">
                {productDetailModal.allowPurchase !== false && (
                  <p>Purchase Price: <strong className="text-[#16A36A]">₹{productDetailModal.price}</strong> ({productDetailModal.qty} in stock)</p>
                )}
                {productDetailModal.allowRental && (
                  <p>Rental Rate: <strong className="text-amber-700">₹{productDetailModal.rentalPricePerDay}/day</strong> · Deposit: ₹{productDetailModal.securityDeposit || 0}</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {productDetailModal.allowPurchase !== false && productDetailModal.qty > 0 && (
                <button onClick={() => handleBuy(productDetailModal)} className="btn btn-sm">
                  Buy Now (₹{productDetailModal.price})
                </button>
              )}
              {productDetailModal.allowRental && (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setRentalModal({
                      product: productDetailModal,
                      startDate: today,
                      returnDate: today,
                      qty: 1,
                      proofFileName: '',
                      proofMimeType: '',
                      proofDataBase64: '',
                    });
                    setProductDetailModal(null);
                  }}
                  className="btn-secondary btn-sm"
                >
                  Rent Gear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RENTAL CHECKOUT */}
      {rentalModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Rent {rentalModal.product.name}</h3>
              <button onClick={() => setRentalModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmRental} className="modal-body space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date *</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={rentalModal.startDate}
                    onChange={(e) => setRentalModal({ ...rentalModal, startDate: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Return Date *</label>
                  <input
                    type="date"
                    required
                    min={rentalModal.startDate}
                    value={rentalModal.returnDate}
                    onChange={(e) => setRentalModal({ ...rentalModal, returnDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Quantity *</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={rentalModal.qty}
                  onChange={(e) => setRentalModal({ ...rentalModal, qty: Number(e.target.value) })}
                  className="input"
                />
              </div>
              {rentalModal.product.requiresIdProof && (
                <div>
                  <label className="label">ID Proof Required (Private Vault) *</label>
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) =>
                      handleProofFileSelect(e.target.files?.[0], (meta) =>
                        setRentalModal({
                          ...rentalModal,
                          proofFileName: meta.name,
                          proofMimeType: meta.mime,
                          proofDataBase64: meta.base64,
                        })
                      )
                    }
                    className="input text-xs"
                  />
                  <p className="text-[10px] text-[#667085] mt-1">Stored privately; never exposed publicly.</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <p>Daily rate: ₹{rentalModal.product.rentalPricePerDay}/day · Security deposit: ₹{rentalModal.product.securityDeposit || 0}/unit</p>
                <p className="font-semibold">Payment status: Unpaid (pay at store pickup; no online gateway configured).</p>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setRentalModal(null)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === `rent-${rentalModal.product.id}`} className="btn btn-sm">
                  {actionBusy === `rent-${rentalModal.product.id}` ? 'Submitting...' : 'Confirm Rental'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT MATCH INVITE */}
      {inviteModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Invite {inviteModal.player.name}</h3>
              <button onClick={() => setInviteModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSendDirectInvite} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Sport *</label>
                <input
                  required
                  value={inviteModal.sport}
                  onChange={(e) => setInviteModal({ ...inviteModal, sport: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Message (Optional)</label>
                <textarea
                  rows={2}
                  value={inviteModal.message}
                  onChange={(e) => setInviteModal({ ...inviteModal, message: e.target.value })}
                  className="input"
                  placeholder="Looking for a weekend doubles match around 6 PM..."
                />
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setInviteModal(null)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'send-invite'} className="btn btn-sm">
                  {actionBusy === 'send-invite' ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TOURNAMENT DETAILS */}
      {tournamentDetailModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <h3 className="modal-title">{tournamentDetailModal.name}</h3>
              <button onClick={() => setTournamentDetailModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-3 text-xs">
              <p className="text-[#667085]">Organized by {tournamentDetailModal.academyName || 'PlayNex Official'}</p>
              {tournamentDetailModal.description && <p className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E5E7EB]">{tournamentDetailModal.description}</p>}
              <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E5E7EB]">
                <div><span className="text-[#667085] block">Venue</span><strong>{tournamentDetailModal.venue || tournamentDetailModal.loc}</strong></div>
                <div><span className="text-[#667085] block">Date</span><strong>{tournamentDetailModal.date}</strong></div>
                <div><span className="text-[#667085] block">Entry Fee</span><strong className="text-[#16A36A]">₹{tournamentDetailModal.entryFee || tournamentDetailModal.price || 0}</strong></div>
                <div><span className="text-[#667085] block">Capacity</span><strong>{tournamentDetailModal.registeredCount || 0} / {tournamentDetailModal.maxParticipants || 32}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setTournamentDetailModal(null)} className="btn-secondary btn-sm">Close</button>
              <button onClick={() => handleRegisterTournament(tournamentDetailModal)} disabled={isSuspended || actionBusy === `tour-${tournamentDetailModal.id}`} className="btn btn-sm">
                Confirm Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTIFICATION PREFERENCES */}
      {preferencesModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Notification Preferences</h3>
              <button onClick={() => setPreferencesModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveNotificationPreferences} className="modal-body space-y-3 text-xs">
              {[
                { key: 'tournaments', label: 'Tournament Announcements' },
                { key: 'matches', label: 'Matchmaking & Match Invites' },
                { key: 'academy', label: 'Academy Venues & Slots' },
                { key: 'promotions', label: 'Sports Store Gear & Rentals' },
                { key: 'announcements', label: 'Platform Announcements' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl border border-[#E5E7EB] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(notifPrefs as any)[item.key] ?? true}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                    className="rounded text-[#16A36A] h-4 w-4"
                  />
                  <span className="font-bold text-[#172033]">{item.label}</span>
                </label>
              ))}
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setPreferencesModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'prefs-save'} className="btn btn-sm">Save Preferences</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATHLETE PROFILE & GPS LOCATION */}
      {profileModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile &amp; Location</h3>
              <button onClick={() => setProfileModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Full Name *</label>
                <input required value={profileModal.name} onChange={(e) => setProfileModal({ ...profileModal, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Skill Level</label>
                <select value={profileModal.skill} onChange={(e) => setProfileModal({ ...profileModal, skill: e.target.value })} className="input">
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Semi-Pro</option>
                </select>
              </div>
              <div>
                <label className="label">City / Manual Location *</label>
                <input required value={profileModal.location} onChange={(e) => setProfileModal({ ...profileModal, location: e.target.value })} className="input" placeholder="e.g. Visakhapatnam" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Coordinates (GPS or Manual)</label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition(
                        (pos) => {
                          setProfileModal({
                            ...profileModal,
                            lat: pos.coords.latitude.toFixed(6),
                            lng: pos.coords.longitude.toFixed(6),
                          });
                          notify('ok', 'GPS coordinates captured.');
                        },
                        () => notify('err', 'Location permission denied.')
                      );
                    }}
                    className="text-[11px] font-bold text-[#16A36A] hover:underline flex items-center gap-1"
                  >
                    <Navigation className="h-3 w-3" /> Use GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="any" placeholder="Latitude" value={profileModal.lat} onChange={(e) => setProfileModal({ ...profileModal, lat: e.target.value })} className="input" />
                  <input type="number" step="any" placeholder="Longitude" value={profileModal.lng} onChange={(e) => setProfileModal({ ...profileModal, lng: e.target.value })} className="input" />
                </div>
              </div>
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileModal.shareLocation}
                  onChange={(e) => setProfileModal({ ...profileModal, shareLocation: e.target.checked })}
                  className="mt-0.5 rounded text-[#16A36A] h-4 w-4"
                />
                <span className="text-[11px] text-[#667085]">
                  Allow approximate (~1 km) distance discovery for nearby athletes (exact coordinates are never shared publicly).
                </span>
              </label>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setProfileModal(null)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'profile-save'} className="btn btn-sm">
                  {actionBusy === 'profile-save' ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STAR RATING */}
      {ratingModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm text-center">
            <div className="modal-header">
              <h3 className="modal-title">Rate {ratingModal.name}</h3>
              <button onClick={() => setRatingModal(null)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="my-4 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => submitRating(star)} className="p-1 transition hover:scale-125">
                    <Star className="h-8 w-8 text-amber-400 fill-amber-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE MATCH */}
      {showCreateMatchModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Create Match Request</h3>
              <button onClick={() => setShowCreateMatchModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateMatch} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Sport *</label>
                <select value={matchForm.sport} onChange={(e) => setMatchForm({ ...matchForm, sport: e.target.value })} className="input">
                  {['Basketball', 'Football', 'Cricket', 'Tennis', 'Badminton', 'Other / Custom Sport'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {matchForm.sport === 'Other / Custom Sport' && (
                  <input required value={matchForm.customSport} onChange={(e) => setMatchForm({ ...matchForm, customSport: e.target.value })} className="input mt-2" placeholder="Enter custom sport name" />
                )}
              </div>
              <div>
                <label className="label">Preferred Location / Arena *</label>
                <input required value={matchForm.location} onChange={(e) => setMatchForm({ ...matchForm, location: e.target.value })} className="input" placeholder="e.g. Beach Road Turf" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" required value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Time *</label>
                  <input type="time" required value={matchForm.time} onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Total Players *</label>
                  <input type="number" min={2} max={50} required value={matchForm.requiredPlayers} onChange={(e) => setMatchForm({ ...matchForm, requiredPlayers: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="label">Skill Level</label>
                  <select value={matchForm.skillLevel} onChange={(e) => setMatchForm({ ...matchForm, skillLevel: e.target.value as any })} className="input">
                    <option value="any">Any Level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowCreateMatchModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'create-match'} className="btn btn-sm">
                  {actionBusy === 'create-match' ? 'Publishing...' : 'Publish Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PLAYER VERIFICATION (WITH PRIVATE PROOF UPLOAD) */}
      {showVerificationModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Submit Player Verification</h3>
              <button onClick={() => setShowVerificationModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitVerification} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Full Legal Name *</label>
                <input required value={verifyForm.fullName} onChange={(e) => setVerifyForm({ ...verifyForm, fullName: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Mobile Number *</label>
                <input required value={verifyForm.phone} onChange={(e) => setVerifyForm({ ...verifyForm, phone: e.target.value })} className="input" placeholder="+91 98765 43210" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ID Type</label>
                  <select value={verifyForm.idType} onChange={(e) => setVerifyForm({ ...verifyForm, idType: e.target.value })} className="input">
                    <option>Government ID</option>
                    <option>Student ID</option>
                    <option>Sports Federation ID</option>
                  </select>
                </div>
                <div>
                  <label className="label">Last 4 Digits / Ref</label>
                  <input value={verifyForm.idNumber} onChange={(e) => setVerifyForm({ ...verifyForm, idNumber: e.target.value })} className="input" placeholder="Last 4 digits only" />
                </div>
              </div>
              <div>
                <label className="label">Proof Document (JPEG, PNG, WebP, PDF &lt; 750KB) *</label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) =>
                    handleProofFileSelect(e.target.files?.[0], (meta) =>
                      setVerifyForm({
                        ...verifyForm,
                        proofFileName: meta.name,
                        proofMimeType: meta.mime,
                        proofDataBase64: meta.base64,
                      })
                    )
                  }
                  className="input text-xs"
                />
                <p className="text-[10px] text-[#667085] mt-1">
                  Uploaded strictly to our private server vault — never exposed via public URLs.
                </p>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowVerificationModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'submit-verification'} className="btn btn-sm">
                  {actionBusy === 'submit-verification' ? 'Uploading...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ACCOUNT DELETION REQUEST */}
      {showDeleteAccountModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Request Account Deletion</h3>
              <button onClick={() => setShowDeleteAccountModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRequestAccountDeletion} className="modal-body space-y-3 text-xs">
              <p className="text-[#667085]">
                Submit an authorized account deletion request. Personal profile &amp; verification documents will be purged while retaining anonymized financial/attendance history as required.
              </p>
              <div>
                <label className="label">Reason *</label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={deleteAccountReason}
                  onChange={(e) => setDeleteAccountReason(e.target.value)}
                  className="input"
                  placeholder="Please tell us why you want to delete your account..."
                />
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowDeleteAccountModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={actionBusy === 'delete-account-req'} className="btn btn-sm bg-rose-600 hover:bg-rose-700">
                  Submit Deletion Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
