'use client';

import { useState, useEffect } from 'react';
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
  UserCheck
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [ratingModal, setRatingModal] = useState<{ id: string; type: 'facility' | 'product'; name: string } | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [bookingModal, setBookingModal] = useState<{ facility: any; selectedSlot: string } | null>(null);
  const [profileModal, setProfileModal] = useState<{ name: string; skill: string; location: string } | null>(null);
  
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    Promise.all([
      fetch('/api/player/profile').then(r => r.json()),
      fetch('/api/facilities').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/events').then(r => r.json())
    ]).then(([profData, facData, prodData, evtData]) => {
      if (profData.ok) setProfile(profData.data);
      if (facData.ok) setFacilities(facData.data);
      if (prodData.ok) setProducts(prodData.data);
      if (evtData.ok) setEvents(evtData.data);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { 
    loadData(); 
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
      } else {
        notify('err', data.error?.message || 'Failed to update profile.');
      }
    } catch {
      notify('err', 'Network error updating profile.');
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
        notify('ok', `Order placed for ${p.name}! Total: ₹${p.price}`); 
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

  async function handleRegisterEvent(e: any) {
    setActionBusy(`event-${e.id}`);
    try {
      const res = await fetch('/api/events/register', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: e.id })
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Registered for ${e.name}! Check your confirmation.`);
      } else {
        notify('err', data.error?.message || 'Could not register for event.');
      }
    } catch {
      notify('err', 'Network error registering for event.');
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
        <h3 className="text-lg font-bold text-slate-900">Profile Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to load athlete account details.</p>
        <button onClick={loadData} className="btn btn-sm btn-secondary mt-4">Retry</button>
      </div>
    );
  }

  const query = searchQuery.toLowerCase().trim();

  const filteredFacilities = facilities.filter(f => {
    const matchesSport = selectedSport === 'All' || f.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesQuery = !query || f.name?.toLowerCase().includes(query) || f.address?.toLowerCase().includes(query);
    return matchesSport && matchesQuery;
  });

  const filteredProducts = products.filter(p => {
    const matchesSport = selectedSport === 'All' || p.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesQuery = !query || p.name?.toLowerCase().includes(query) || p.storeName?.toLowerCase().includes(query);
    return matchesSport && matchesQuery;
  });

  const filteredEvents = events.filter(e => {
    const matchesSport = selectedSport === 'All' || e.sport?.toLowerCase() === selectedSport.toLowerCase();
    const matchesQuery = !query || e.name?.toLowerCase().includes(query) || e.loc?.toLowerCase().includes(query);
    return matchesSport && matchesQuery;
  });

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

      {/* Edit Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="card max-w-md w-full p-6 shadow-2xl border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Edit3 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Athlete Profile</h3>
              </div>
              <button 
                onClick={() => setProfileModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="label">Athlete Full Name</label>
                <input 
                  required
                  value={profileModal.name}
                  onChange={e => setProfileModal({ ...profileModal, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Skill Level</label>
                <select 
                  value={profileModal.skill}
                  onChange={e => setProfileModal({ ...profileModal, skill: e.target.value })}
                  className="input"
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Semi-Pro</option>
                  <option>Professional</option>
                </select>
              </div>

              <div>
                <label className="label">Location / City</label>
                <input 
                  required
                  value={profileModal.location}
                  onChange={e => setProfileModal({ ...profileModal, location: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setProfileModal(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={actionBusy === 'profile-save'}
                  className="btn text-xs"
                >
                  {actionBusy === 'profile-save' ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Slot Selection Modal */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="card max-w-lg w-full p-6 shadow-2xl border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Book Slot: {bookingModal.facility.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    ₹{bookingModal.facility.price}/hr · {bookingModal.facility.sport}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setBookingModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="label">Select an Available Time Slot for Today</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                {Object.keys(bookingModal.facility.slots || {})
                  .sort((a,b) => Number(a)-Number(b))
                  .map((slot) => {
                    const isAvailable = bookingModal.facility.slots[slot] === true;
                    const isSelected = bookingModal.selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setBookingModal({ ...bookingModal, selectedSlot: slot })}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          !isAvailable
                            ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-600 text-white border-brand-700 shadow-sm font-bold ring-2 ring-brand-500/20'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
                        }`}
                      >
                        <span className="block text-xs font-black">{formatSlot(slot)}</span>
                        <span className="block text-[10px] mt-0.5 opacity-90">
                          {isAvailable ? 'Available' : 'Booked'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs">
                <span className="text-slate-400">Selected Slot: </span>
                <span className="font-extrabold text-slate-900">
                  {bookingModal.selectedSlot ? formatSlot(bookingModal.selectedSlot) : 'None'}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setBookingModal(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleConfirmBooking}
                  disabled={!bookingModal.selectedSlot || actionBusy === `book-${bookingModal.facility.id}`}
                  className="btn text-xs"
                >
                  {actionBusy === `book-${bookingModal.facility.id}` ? 'Reserving...' : `Confirm & Pay ₹${bookingModal.facility.price}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="card max-w-sm w-full p-6 text-center shadow-2xl border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Rate {ratingModal.name}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              How was your experience with this {ratingModal.type}?
            </p>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || 0) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => submitRating(star)}
                    className="p-1 transition transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 transition ${
                        filled ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => { setRatingModal(null); setHoverRating(0); }}
              className="btn btn-secondary w-full text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Athlete Header Profile Card */}
      <div className="card bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800 p-6 sm:p-8 relative overflow-hidden">
        <div 
          aria-hidden 
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-brand-500/15 blur-3xl pointer-events-none" 
        />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-500 to-teal-400 text-white font-black text-2xl shadow-lg shadow-brand-500/25">
              {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'PL'}
              <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-slate-900 ${profile.available ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {profile.name}
                </h1>
                <span className="badge bg-white/10 text-brand-300 border-white/10 text-[10px] font-bold uppercase tracking-wider">
                  {profile.skill || 'Athlete'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {profile.location || 'Local Player Area'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setProfileModal({ name: profile.name, skill: profile.skill, location: profile.location })}
              className="btn btn-sm btn-secondary text-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Profile
            </button>
            <button
              onClick={toggleAvailability}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
                profile.available
                  ? 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${profile.available ? 'bg-white animate-ping' : 'bg-slate-400'}`} />
              {profile.available ? 'Available to Play' : 'Marked Offline'}
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-400 font-medium">Tournaments</p>
            <p className="text-lg font-bold text-white mt-0.5">{events.length} Live</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Turf Arenas</p>
            <p className="text-lg font-bold text-white mt-0.5">{facilities.length} Grounds</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Sports Gear</p>
            <p className="text-lg font-bold text-white mt-0.5">{products.length} Products</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Community Status</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">
              {profile.available ? 'Active & Ready' : 'Paused'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Sports Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {SPORTS.map((sport) => {
              const active = selectedSport === sport;
              return (
                <button
                  key={sport}
                  onClick={() => setSelectedSport(sport)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    active
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sport}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ground, cup, gear..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 1. TOURNAMENTS SECTION */}
      {filteredEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Trophy className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Tournaments & Championships ({filteredEvents.length})
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e) => (
              <div 
                key={e.id} 
                className="card card-hover flex flex-col justify-between border-l-4 border-l-amber-500 p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge badge-brand text-[10px] mb-1.5">
                        {e.sport}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {e.name}
                      </h3>
                    </div>
                    <span className="badge badge-warn text-xs font-black">
                      ₹{e.price}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{e.loc || 'Main Stadium / Ground'}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{e.date ? new Date(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleRegisterEvent(e)}
                    disabled={actionBusy === `event-${e.id}`}
                    className="btn btn-sm w-full"
                  >
                    {actionBusy === `event-${e.id}` ? 'Registering...' : 'Register for Tournament'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. ACADEMIES & GROUNDS SECTION */}
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
                      <h3 className="font-bold text-base text-slate-900">{f.name}</h3>
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

      {/* 3. PRO GEAR & SPORTS STORE */}
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
    </div>
  );
}
