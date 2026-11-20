'use client';

import { useState, useEffect } from 'react';
import Toast from '@/components/ui/Toast';
import {
  Trophy,
  MapPin,
  Calendar,
  Star,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Radio,
  Activity,
  Filter,
  Search,
  ArrowUpRight,
  Clock,
  Landmark,
  ShieldCheck,
  Check,
  Edit3,
  UserCheck,
  Users,
  Compass,
  FileText,
  Info,
  Bell,
  SlidersHorizontal,
  Package,
  Gamepad2
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

function StarRating({ rating, count }: { rating: number; count: number }) {
  if (!count) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
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

const SPORTS = ['All', 'Basketball', 'Football', 'Cricket', 'Tennis'] as const;

export default function PlayerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [nearbyData, setNearbyData] = useState<{ callerCity: string; totalNearby: number; sportCounts: Record<string, number>; players: any[] } | null>(null);

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbySportFilter, setNearbySportFilter] = useState<string>('All');
  const [nearbyAvailableOnly, setNearbyAvailableOnly] = useState<boolean>(false);

  // Modals
  const [ratingModal, setRatingModal] = useState<{ id: string; type: 'facility' | 'product'; name: string } | null>(null);
  const [bookingModal, setBookingModal] = useState<{ facility: any; selectedSlot: string } | null>(null);
  const [profileModal, setProfileModal] = useState<{ name: string; skill: string; location: string; sportsPreferences?: string[] } | null>(null);
  const [tournamentDetailModal, setTournamentDetailModal] = useState<any | null>(null);
  const [preferencesModal, setPreferencesModal] = useState<boolean>(false);
  const [notifPrefs, setNotifPrefs] = useState({
    tournaments: true,
    matches: true,
    academy: true,
    promotions: true,
    announcements: true,
  });

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [profData, facData, prodData, evtData, nearbyRes, gamesRes] = await Promise.all([
        fetch('/api/player/profile').then(r => r.json()),
        fetch('/api/facilities').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/tournaments').then(r => r.json()),
        fetch('/api/players/nearby').then(r => r.json()),
        fetch('/api/games').then(r => r.json()),
      ]);

      if (profData.ok) {
        setProfile(profData.data);
        if (profData.data.notificationPreferences) {
          setNotifPrefs(profData.data.notificationPreferences);
        }
      }
      if (facData.ok) setFacilities(facData.data || []);
      if (prodData.ok) setProducts(prodData.data || []);
      if (evtData.ok) setEvents(evtData.data || []);
      if (nearbyRes.ok) setNearbyData(nearbyRes.data);
      if (gamesRes.ok) setGames(gamesRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Real-time Firestore sync for Tournaments
  useEffect(() => {
    loadData();

    try {
      const unsub = onSnapshot(collection(db, 'events'), (snapshot) => {
        const liveEvents = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        liveEvents.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        setEvents(liveEvents);
      }, (err) => {
        console.warn('Real-time tournament sync fallback to API:', err.message);
      });

      return () => unsub();
    } catch (err) {
      console.warn('Real-time listener unavailable, using API polling:', err);
    }
  }, []);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function toggleAvailability() {
    if (!profile) return;
    const newState = !profile.available;
    setProfile({ ...profile, available: newState });
    try {
      await fetch('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newState })
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
      const res = await fetch('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileModal)
      });
      const data = await res.json();
      if (data.ok) {
        setProfile({ ...profile, ...profileModal });
        setProfileModal(null);
        notify('ok', 'Athlete profile updated successfully!');
        fetch('/api/players/nearby').then(r => r.json()).then(r => r.ok && setNearbyData(r.data));
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

  function openBookingModal(f: any) {
    if (f.closed) {
      notify('err', 'This ground is temporarily closed for bookings.');
      return;
    }
    const slots = f.slots || {};
    const firstAvailable = Object.keys(slots).sort((a,b) => Number(a)-Number(b)).find(k => slots[k] === true) || '18';
    setBookingModal({ facility: f, selectedSlot: firstAvailable });
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
        body: JSON.stringify({ facilityId: f.id, facilityName: f.name, slot, price: f.price })
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Successfully reserved ${formatSlot(slot)} slot at ${f.name}!`);
        setBookingModal(null);
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

  async function handleBuy(p: any) {
    setActionBusy(`buy-${p.id}`);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, productName: p.name, storeId: p.storeId, price: p.price, qty: 1 })
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Order placed for ${p.name}! Total: ₹${p.price}. Confirmation notification sent.`);
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

  async function handleRegisterTournament(t: any) {
    setActionBusy(`tour-${t.id}`);
    try {
      const res = await fetch(`/api/tournaments/${t.id}/registrations`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Registration confirmed for "${t.name}"! Confirmation alert delivered.`);
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
        body: JSON.stringify({ targetId: ratingModal.id, targetType: ratingModal.type, rating: score })
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

  const formatSlot = (h: string) => {
    const val = parseInt(h);
    const hour = val % 12 || 12;
    const ampm = val >= 12 ? 'PM' : 'AM';
    return `${hour}:00 ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading your player dashboard...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800">Profile Not Ready</h3>
        <p className="text-xs text-slate-500 mt-1">Please sign in again to initialize your athlete profile.</p>
      </div>
    );
  }

  // Filter logic
  const availableSports = [
    'All',
    ...Array.from(new Set([
      ...games.map((g: any) => g.name),
      'Basketball', 'Football', 'Cricket', 'Tennis'
    ]))
  ];

  const filteredEvents = events.filter((e) => {
    if (e.status === 'Draft') return false;
    const matchesSport = selectedSport === 'All' ||
      e.sport?.toLowerCase() === selectedSport.toLowerCase() ||
      e.sport?.toLowerCase().includes(selectedSport.toLowerCase()) ||
      selectedSport.toLowerCase().includes(e.sport?.toLowerCase() || '');
    const matchesSearch = !searchQuery || e.name?.toLowerCase().includes(searchQuery.toLowerCase()) || (e.venue || e.loc)?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const filteredFacilities = facilities.filter((f) => {
    const matchesSport = selectedSport === 'All' || f.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesSearch = !searchQuery || f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.address?.toLowerCase().includes(searchQuery.toLowerCase());
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

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      <Toast message={notification} onClose={() => setNotification(null)} />

      {/* Hero Athlete Overview Card */}
      <div className="card bg-white text-[#172033] border-[#E2E8F0] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Athlete Dashboard
                </span>
                <span className="badge badge-brand text-[10px] font-bold uppercase">
                  {profile.skill || 'Intermediate'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033]">
                {profile.name}
              </h1>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-[#64748B]" />
                <span>{profile.location || 'Visakhapatnam'}</span>
                <span>•</span>
                <span>Sports: {profile.sportsPreferences?.join(', ') || 'Basketball, Football'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Availability Toggle */}
            <button
              onClick={toggleAvailability}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition shadow-xs border ${
                profile.available
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-200 text-[#64748B] hover:bg-slate-200'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${profile.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{profile.available ? 'Available for Games' : 'Marked Offline'}</span>
            </button>

            <button
              onClick={() => setPreferencesModal(true)}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
              title="Notification alerts settings"
            >
              <Bell className="h-3.5 w-3.5 text-brand-600" />
              Alerts
            </button>

            <button
              onClick={() => setProfileModal({
                name: profile.name,
                skill: profile.skill,
                location: profile.location,
                sportsPreferences: profile.sportsPreferences,
              })}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-6 pt-6 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-[#64748B] font-medium">Turf Arenas</p>
            <p className="text-xl font-bold text-[#172033] mt-0.5">{facilities.length} available</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Live Tournaments</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{events.filter(e => e.status !== 'Draft').length} open</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Nearby Players</p>
            <p className="text-xl font-bold text-teal-700 mt-0.5">{nearbyData?.totalNearby || 0} discovered</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Win Rate & Matches</p>
            <p className="text-xl font-bold text-[#2563EB] mt-0.5">{profile.winRate || '75%'} ({profile.matchesPlayed || 12} games)</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH STRIP */}
      <div className="card p-4 border-[#E2E8F0] bg-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Sports Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {availableSports.map((sport) => {
              const isSelected = selectedSport === sport;
              return (
                <button
                  key={sport}
                  onClick={() => setSelectedSport(sport)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'bg-slate-100 text-[#64748B] hover:bg-slate-200 hover:text-[#172033]'
                  }`}
                >
                  {sport}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search tournaments, grounds, gear..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* GAMES EXPLORATION CAROUSEL STRIP */}
      {games.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-[#172033]">
                Supported Games & Esports ({games.length})
              </h2>
            </div>
            {selectedSport !== 'All' && (
              <button
                onClick={() => setSelectedSport('All')}
                className="text-xs text-[#2563EB] hover:underline font-semibold"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {games.map((g) => {
              const isSelected = selectedSport.toLowerCase() === g.name.toLowerCase();
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedSport(isSelected ? 'All' : g.name)}
                  className={`group relative rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-[#2563EB] bg-[#DBEAFE] shadow-xs ring-1 ring-[#2563EB]'
                      : 'border-[#E2E8F0] bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="h-16 w-full rounded-lg bg-slate-100 overflow-hidden mb-2 relative">
                    {g.bannerUrl || g.logoUrl ? (
                      <img
                        src={g.bannerUrl || g.logoUrl}
                        alt={g.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-400 bg-slate-100">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 badge bg-white/90 text-[#172033] border border-[#E2E8F0] text-[8px] uppercase py-0 px-1 shadow-xs font-semibold">
                      {g.category}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#172033] truncate group-hover:text-[#2563EB] transition">
                    {g.name}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {isSelected ? 'Active Filter' : 'Filter Tournaments'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {/* 1. REAL-TIME TOURNAMENTS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Tournaments & Championships ({filteredEvents.length})
                </h2>
                <span className="badge badge-brand text-[9px] font-black flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">Real-time tournaments. Updates to date, venue, or deadline notify you instantly.</p>
            </div>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="card text-center py-10">
            <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">No tournaments match your current filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e) => {
              const maxP = e.maxParticipants || 32;
              const regP = e.registeredCount || 0;
              const slotsLeft = Math.max(0, maxP - regP);
              const isFull = slotsLeft === 0;

              return (
                <div
                  key={e.id}
                  className="card card-hover flex flex-col justify-between border-l-4 border-l-amber-500 p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="badge badge-brand text-[10px]">
                            {e.sport}
                          </span>
                          <span className={`badge text-[10px] font-bold ${
                            e.status === 'Registration Open' ? 'badge-ok' : 'badge-neutral'
                          }`}>
                            {e.status || 'Active'}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900 leading-snug">
                          {e.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          By {e.academyName || 'PlayNex Official'}
                        </p>
                      </div>
                      <span className="badge badge-warn text-xs font-black">
                        ₹{e.entryFee || e.price || 0}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{e.venue || e.loc || 'Main Stadium / Ground'}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{e.date ? new Date(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-purple-700 font-bold">
                        <Users className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span>{regP} / {maxP} registered ({slotsLeft} slots remaining)</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setTournamentDetailModal(e)}
                      className="btn btn-sm btn-secondary text-xs flex-1"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleRegisterTournament(e)}
                      disabled={isFull || actionBusy === `tour-${e.id}`}
                      className={`btn btn-sm text-xs flex-1 ${isFull ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500' : ''}`}
                    >
                      {actionBusy === `tour-${e.id}` ? 'Registering...' : isFull ? 'Capacity Full' : 'Register Now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. NEARBY PLAYER DISCOVERY SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Nearby Players & Athletes ({nearbyPlayersList.length})
                </h2>
                <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[9px] font-bold">
                  City: {nearbyData?.callerCity || 'Visakhapatnam'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Connect with nearby athletes for practice matches and tournament teams.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setNearbyAvailableOnly(!nearbyAvailableOnly)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold border transition ${
                nearbyAvailableOnly
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {nearbyAvailableOnly ? '✓ Available only' : 'Show all'}
            </button>
          </div>
        </div>

        {/* Sport Counts Summary */}
        {nearbyData?.sportCounts && (
          <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-slate-400 font-medium text-[11px] shrink-0">Available by sport:</span>
            {Object.entries(nearbyData.sportCounts).map(([sp, cnt]) => (
              <span key={sp} className="badge bg-slate-100 text-slate-700 border border-slate-200/80 text-[10px] py-0.5 px-2 font-bold shrink-0">
                {sp}: {cnt}
              </span>
            ))}
          </div>
        )}

        {nearbyPlayersList.length === 0 ? (
          <div className="card text-center py-8">
            <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">No other players found for this filter in your city.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nearbyPlayersList.map((player) => (
              <div key={player.id} className="card p-4 border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{player.name}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">{player.skillLevel}</span>
                      </div>
                    </div>

                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      player.available ? 'bg-emerald-500' : 'bg-slate-300'
                    }`} title={player.available ? 'Available for match' : 'Offline'} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {player.sports?.map((sp: string) => (
                      <span key={sp} className="badge bg-slate-100 text-slate-600 text-[9px] font-bold py-0 px-1.5">
                        {sp}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="h-3 w-3" /> {player.approxDistance}
                  </span>
                  <span className="font-semibold text-brand-600">
                    {player.city}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. ACADEMIES & TURF GROUNDS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Turf Arenas & Grounds ({filteredFacilities.length})
            </h2>
          </div>
        </div>

        {filteredFacilities.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-xs font-semibold text-slate-500">No grounds matched your filter.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFacilities.map((f) => (
              <div
                key={f.id}
                className="card card-hover p-0 overflow-hidden flex flex-col justify-between border-slate-200"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    {f.image ? (
                      <img
                        src={f.image}
                        alt={f.name}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-400">
                        <Landmark className="h-12 w-12" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 badge bg-white/90 text-slate-900 backdrop-blur-sm shadow-xs text-xs font-bold">
                      {f.sport}
                    </span>
                    {f.closed && (
                      <span className="absolute top-3 right-3 badge bg-rose-600 text-white text-xs font-bold shadow-sm">
                        Closed
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-slate-900">{f.name}</h3>
                          {f.academyVerification === 'approved' && (
                            <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[9px] font-bold" title="Verified Arena">
                              Verified
                            </span>
                          )}
                        </div>
                        {f.academyName && <p className="text-[11px] text-slate-400 font-medium">{f.academyName}</p>}
                      </div>
                      <StarRating rating={f.rating || 0} count={f.ratingCount || 0} />
                    </div>

                    <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{f.address || 'Address provided upon booking'}</span>
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-brand-600">₹{f.price}</span>
                        <span className="text-[11px] font-semibold text-slate-400">/ hour</span>
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
                    disabled={f.closed || actionBusy === `book-${f.id}`}
                    className={`btn btn-sm ${f.closed ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500' : ''}`}
                  >
                    {f.closed ? 'Closed' : 'Book Slot'}
                  </button>
                  <button
                    onClick={() => setRatingModal({ id: f.id, type: 'facility', name: f.name })}
                    className="btn btn-sm btn-secondary"
                  >
                    Rate Arena
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. PRO GEAR & SPORTS STORE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Pro Sports Gear & Equipment ({filteredProducts.length})
            </h2>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-xs font-semibold text-slate-500">No gear items found for this selection.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((p) => {
              const inStock = p.qty > 0;
              return (
                <div
                  key={p.id}
                  className="card card-hover p-0 overflow-hidden flex flex-col justify-between border-slate-200"
                >
                  <div>
                    <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-400">
                          <ShoppingBag className="h-10 w-10" />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 badge bg-white/90 text-slate-800 text-[10px] font-bold">
                        {p.sport}
                      </span>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{p.name}</h3>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{p.storeName || 'Verified Store'}</p>

                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="font-extrabold text-brand-600 text-sm">₹{p.price}</span>
                        <StarRating rating={p.rating || 0} count={p.ratingCount || 0} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    <button
                      onClick={() => handleBuy(p)}
                      disabled={!inStock || actionBusy === `buy-${p.id}`}
                      className={`btn btn-sm w-full ${!inStock ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500' : ''}`}
                    >
                      {!inStock ? 'Out of stock' : actionBusy === `buy-${p.id}` ? 'Ordering...' : 'Buy Now'}
                    </button>
                    <button
                      onClick={() => setRatingModal({ id: p.id, type: 'product', name: p.name })}
                      className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-brand-600 transition"
                    >
                      Rate this gear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL 1: TOURNAMENT DETAILS & REGISTRATION */}
      {tournamentDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-lg border-slate-200 bg-white p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="badge badge-brand text-[10px] uppercase font-black">
                  {tournamentDetailModal.sport}
                </span>
                <span className="badge badge-ok text-[10px] uppercase font-bold">
                  {tournamentDetailModal.status || 'Active'}
                </span>
              </div>
              <button onClick={() => setTournamentDetailModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">{tournamentDetailModal.name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Organized by {tournamentDetailModal.academyName || 'PlayNex Official'}
                </p>
              </div>

              {tournamentDetailModal.description && (
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {tournamentDetailModal.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block">Venue:</span>
                  <span className="font-bold text-slate-800">{tournamentDetailModal.venue || tournamentDetailModal.loc}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Tournament Date:</span>
                  <span className="font-bold text-slate-800">{tournamentDetailModal.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Registration Deadline:</span>
                  <span className="font-bold text-slate-800">{tournamentDetailModal.registrationDeadline || tournamentDetailModal.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Entry Fee:</span>
                  <span className="font-bold text-brand-600">₹{tournamentDetailModal.entryFee || tournamentDetailModal.price || 0}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-medium block">Capacity:</span>
                  <span className="font-bold text-purple-700">
                    {tournamentDetailModal.registeredCount || 0} / {tournamentDetailModal.maxParticipants || 32} athletes registered
                  </span>
                </div>
              </div>

              {tournamentDetailModal.rules && (
                <div>
                  <span className="text-slate-500 font-bold text-xs block mb-1">Tournament Rules:</span>
                  <p className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50">
                    {tournamentDetailModal.rules}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setTournamentDetailModal(null)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
              <button
                onClick={() => handleRegisterTournament(tournamentDetailModal)}
                disabled={actionBusy === `tour-${tournamentDetailModal.id}`}
                className="btn text-xs"
              >
                {actionBusy === `tour-${tournamentDetailModal.id}` ? 'Registering...' : 'Confirm Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOTIFICATION PREFERENCES */}
      {preferencesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-md border-slate-200 bg-white p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-900">Notification Preferences</h3>
              </div>
              <button onClick={() => setPreferencesModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotificationPreferences} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-500 text-[11px] mb-3">
                Choose which cross-portal alert categories you want delivered to your dashboard bell.
              </p>

              {[
                { key: 'tournaments', label: 'Tournament Announcements & Changes', desc: 'New tournaments, date changes, and venue updates' },
                { key: 'matches', label: 'Match Schedules & Results', desc: 'Match timings and live schedule updates' },
                { key: 'academy', label: 'Academy Events & Venues', desc: 'New turf openings and academy programs' },
                { key: 'promotions', label: 'Sports Store Offers & Price Drops', desc: 'Discounts on gear and new equipment arrivals' },
                { key: 'announcements', label: 'Platform Announcements', desc: 'Important PlayNex community updates' },
              ].map((item) => (
                <label key={item.key} className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={(notifPrefs as any)[item.key] ?? true}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">{item.label}</span>
                    <span className="text-[10px] text-slate-500">{item.desc}</span>
                  </div>
                </label>
              ))}

              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-[11px] text-purple-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600 shrink-0" />
                <span>Account, booking confirmations, and order dispatches are always delivered.</span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setPreferencesModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={actionBusy === 'prefs-save'} className="btn text-xs">
                  {actionBusy === 'prefs-save' ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BOOKING SLOT SELECTION */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-lg border-slate-200 bg-white p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-600" />
                <h3 className="text-base font-bold text-slate-900">Select Booking Slot</h3>
              </div>
              <button onClick={() => setBookingModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">{bookingModal.facility.name}</h4>
                <p className="text-xs text-slate-500">{bookingModal.facility.address} • ₹{bookingModal.facility.price}/hr</p>
              </div>

              <div>
                <label className="label">Available Hourly Slots Today</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {Object.keys(bookingModal.facility.slots || {})
                    .sort((a,b) => Number(a)-Number(b))
                    .map((s) => {
                      const isAvail = bookingModal.facility.slots[s];
                      const isSel = bookingModal.selectedSlot === s;
                      return (
                        <button
                          key={s}
                          disabled={!isAvail}
                          onClick={() => setBookingModal({ ...bookingModal, selectedSlot: s })}
                          className={`p-2 rounded-xl text-center text-xs font-bold border transition ${
                            !isAvail
                              ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                              : isSel
                              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setBookingModal(null)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={actionBusy === `book-${bookingModal.facility.id}`}
                className="btn text-xs"
              >
                {actionBusy === `book-${bookingModal.facility.id}` ? 'Booking...' : `Reserve Slot (₹${bookingModal.facility.price})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ATHLETE PROFILE EDIT */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-md border-slate-200 bg-white p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Athlete Profile</h3>
              <button onClick={() => setProfileModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="label">Full Name</label>
                <input
                  required
                  value={profileModal.name}
                  onChange={(e) => setProfileModal({ ...profileModal, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Skill Level</label>
                <select
                  value={profileModal.skill}
                  onChange={(e) => setProfileModal({ ...profileModal, skill: e.target.value })}
                  className="input"
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Semi-Pro</option>
                </select>
              </div>

              <div>
                <label className="label">City / Location</label>
                <input
                  required
                  value={profileModal.location}
                  onChange={(e) => setProfileModal({ ...profileModal, location: e.target.value })}
                  className="input"
                  placeholder="e.g. Visakhapatnam"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setProfileModal(null)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={actionBusy === 'profile-save'} className="btn text-xs">
                  {actionBusy === 'profile-save' ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: STAR RATING */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-sm border-slate-200 bg-white p-6 shadow-2xl text-center relative">
            <h3 className="text-base font-extrabold text-slate-900">Rate {ratingModal.name}</h3>
            <p className="text-xs text-slate-500 mt-1">Tap the stars to submit your review rating</p>

            <div className="my-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => submitRating(star)}
                  className="p-1 transition transform hover:scale-125"
                >
                  <Star className="h-8 w-8 text-amber-400 fill-amber-400" />
                </button>
              ))}
            </div>

            <button onClick={() => setRatingModal(null)} className="btn btn-secondary btn-sm text-xs w-full">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
