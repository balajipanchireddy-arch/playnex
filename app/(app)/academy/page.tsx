'use client';

import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { useState, useEffect } from 'react';
import { uploadImage } from '@/lib/utils/upload';
import {
  Landmark,
  Trophy,
  Plus,
  Trash2,
  Clock,
  Lock,
  Unlock,
  Calendar,
  MapPin,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  DollarSign,
  ChevronDown,
  Users,
} from 'lucide-react';

export default function AcademyDashboard() {
  const [academy, setAcademy] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<
    { type: 'ok' | 'err'; text: string } | null
  >(null);

  // Ground Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submittingGround, setSubmittingGround] = useState(false);
  const [showAddGround, setShowAddGround] = useState(false);

  // Tournament Form State
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState('Basketball');
  const [tCategory, setTCategory] = useState('Open Championship');
  const [tDate, setTDate] = useState('');
  const [tDeadline, setTDeadline] = useState('');
  const [tLoc, setTLoc] = useState('');
  const [tPrice, setTPrice] = useState('500');
  const [tMax, setTMax] = useState('32');
  const [tRules, setTRules] = useState('');
  const [submittingTournament, setSubmittingTournament] = useState(false);
  const [showAddTournament, setShowAddTournament] = useState(false);

  // Delete modal state for tournaments
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function handleDeleteTournament() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/academies/me/events?eventId=${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Tournament "${deleteTarget.name}" deleted.`);
        await loadData();
      } else {
        notify('err', data.error?.message || 'Failed to delete tournament.');
      }
    } catch (e) {
      notify('err', 'Network error while deleting tournament.');
    } finally {
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  }

  async function loadData() {
    try {
      const [acadRes, facRes, tourRes] = await Promise.all([
        fetch('/api/academies/me').then((r) => r.json()),
        fetch('/api/academies/me/facilities').then((r) => r.json()),
        fetch('/api/academies/me/events').then((r) => r.json()),
      ]);
      if (acadRes.ok) setAcademy(acadRes.data);
      if (facRes.ok) setFacilities(facRes.data || []);
      if (tourRes.ok) setTournaments(tourRes.data || []);
    } catch (e) {
      notify('err', 'Could not load academy data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Ground handlers -------------------------------------------------------
  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingGround(true);
    let imageUrl = '';
    try {
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'academies');
      }
      const res = await fetch('/api/academies/me/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          sport,
          price: Number(price),
          image: imageUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Added ${name} to your venues!`);
        setName('');
        setAddress('');
        setPrice('');
        setImageFile(null);
        setShowAddGround(false);
        await loadData();
      } else {
        notify('err', data.error?.message || 'Failed to add ground.');
      }
    } catch (e) {
      notify('err', 'Upload or network error.');
    } finally {
      setSubmittingGround(false);
    }
  }

  // Tournament handlers ----------------------------------------------------
  async function handleAddTournament(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTournament(true);
    try {
      const res = await fetch('/api/academies/me/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tName,
          sport: tSport,
          category: tCategory,
          date: tDate,
          registrationDeadline: tDeadline || tDate,
          venue: tLoc,
          loc: tLoc,
          price: Number(tPrice),
          entryFee: Number(tPrice),
          maxParticipants: Number(tMax),
          rules: tRules,
          status: 'Registration Open',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify(
          'ok',
          `Tournament "${tName}" published! Athletes can now view and register.`
        );
        setTName('');
        setTDate('');
        setTDeadline('');
        setTLoc('');
        setTPrice('500');
        setTMax('32');
        setTRules('');
        setShowAddTournament(false);
        await loadData();
      } else {
        notify('err', data.error?.message || 'Failed to publish tournament.');
      }
    } catch (e) {
      notify('err', 'Network error.');
    } finally {
      setSubmittingTournament(false);
    }
  }

  async function toggleSlot(
    facilityId: string,
    slot: string,
    currentAvail: boolean
  ) {
    setFacilities(
      facilities.map((f) =>
        f.id === facilityId
          ? { ...f, slots: { ...f.slots, [slot]: !currentAvail } }
          : f
      )
    );
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, slot, available: !currentAvail }),
    });
  }

  async function updatePrice(facilityId: string, newPrice: string) {
    const p = Number(newPrice);
    if (isNaN(p) || p <= 0) return;
    setFacilities(
      facilities.map((f) => (f.id === facilityId ? { ...f, price: p } : f))
    );
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, price: p }),
    });
    notify('ok', 'Updated venue rate.');
  }

  async function toggleClosed(facilityId: string, currentClosed: boolean) {
    setFacilities(
      facilities.map((f) =>
        f.id === facilityId ? { ...f, closed: !currentClosed } : f
      )
    );
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, closed: !currentClosed }),
    });
    notify(
      'ok',
      !currentClosed ? 'Ground marked closed temporarily.' : 'Ground reopened for bookings!'
    );
  }

  async function deleteGround(facilityId: string) {
    if (!confirm('Are you sure you want to remove this ground? All slot data will be erased.'))
      return;
    await fetch(`/api/academies/me/facilities?facilityId=${facilityId}`, {
      method: 'DELETE',
    });
    notify('ok', 'Ground removed.');
    await loadData();
  }

  const formatSlot = (h: string) => {
    const val = parseInt(h);
    const hour = (val % 12) || 12;
    const ampm = val >= 12 ? 'PM' : 'AM';
    return `${hour} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading academy management portal...</p>
      </div>
    );
  }

  const totalSlotsCount = facilities.reduce(
    (acc, f) => acc + Object.keys(f.slots || {}).length,
    0
  );

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
            notification.type === 'ok'
              ? 'bg-emerald-900/90 text-white border-emerald-700/80'
              : 'bg-rose-900/90 text-white border-rose-700/80'
          }`}
        >
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

      {/* Hero Overview Header */}
      <div className="card bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800 p-6 sm:p-8 relative overflow-hidden">
        <div aria-hidden className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/25">
              <Landmark className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sports Venue Partner</span>
                <span
                  className={`badge text-[10px] font-black uppercase ${
                    academy?.verificationStatus === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : academy?.verificationStatus === 'rejected'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {academy?.verificationStatus === 'approved'
                    ? 'Verified Academy'
                    : academy?.verificationStatus === 'rejected'
                    ? 'Verification Rejected'
                    : 'Verification Pending'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {academy?.academyName || 'Academy & Arena Control'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {academy?.address || 'Manage turf reservations, live booking slots, and competitive tournaments.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setShowAddGround(!showAddGround);
                setShowAddTournament(false);
              }}
              className="btn btn-sm btn-emerald text-xs"
            >
              <Plus className="h-4 w-4" /> Add Ground
            </button>
            <button
              onClick={() => {
                setShowAddTournament(!showAddTournament);
                setShowAddGround(false);
              }}
              className="btn btn-sm btn-secondary text-xs"
            >
              <Trophy className="h-4 w-4 text-amber-500" /> Host Tournament
            </button>
          </div>
        </div>
        {/* KPI Strip */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-slate-400 font-medium">Grounds Listed</p>
            <p className="text-xl font-bold text-white mt-0.5">{facilities.length}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Hourly Slots Active</p>
            <p className="text-xl font-bold text-teal-400 mt-0.5">{totalSlotsCount}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Hosted Tournaments</p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">{tournaments.length}</p>
          </div>
        </div>
      </div>

      {/* Verification Notice Banner */}
      {academy && academy.verificationStatus !== 'approved' && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Academy Verification in Progress</p>
            <p className="mt-0.5 text-amber-700">
              Your sports academy profile is currently pending administrator verification. Once verified by an admin, your venue profile and grounds will be marked verified across PlayNex.
            </p>
          </div>
        </div>
      )}

      {/* Add Ground Form */}
      {showAddGround && (
        <div className="card border-2 border-emerald-500/30 bg-emerald-50/20 p-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Add New Ground or Turf</h2>
            </div>
            <button
              onClick={() => setShowAddGround(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleAddFacility} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Ground Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Apex Arena Court 1"
              />
            </div>
            <div>
              <label className="label">Full Address / Location</label>
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="e.g. 12 Sports Lane, North Arena"
              />
            </div>
            <div>
              <label className="label">Sport Category</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="input"
              >
                <option>Basketball</option>
                <option>Football</option>
                <option>Cricket</option>
                <option>Tennis</option>
              </select>
            </div>
            <div>
              <label className="label">Hourly Price (₹/hr)</label>
              <input
                type="number"
                required
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input"
                placeholder="e.g. 800"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Ground Photo (Optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddGround(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingGround}
                className="btn btn-emerald text-xs"
              >
                {submittingGround ? 'Saving Venue...' : 'Add Ground'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Tournament Form */}
      {showAddTournament && (
        <div className="card border-2 border-amber-500/30 bg-amber-50/20 p-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Trophy className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Host New Tournament</h2>
            </div>
            <button
              onClick={() => setShowAddTournament(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleAddTournament} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Tournament Title</label>
              <input
                required
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                className="input"
                placeholder="e.g. Summer Premier League 2026"
              />
            </div>
            <div>
              <label className="label">Sport Category</label>
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
              <label className="label">Category</label>
              <input
                required
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value)}
                className="input"
                placeholder="e.g. Open Men's"
              />
            </div>
            <div>
              <label className="label">Tournament Date</label>
              <input
                type="date"
                required
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Registration Deadline</label>
              <input
                type="date"
                required
                value={tDeadline}
                onChange={(e) => setTDeadline(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Venue / Ground Name</label>
              <input
                required
                value={tLoc}
                onChange={(e) => setTLoc(e.target.value)}
                className="input"
                placeholder="Main Arena Court 1"
              />
            </div>
            <div>
              <label className="label">Max Athlete Capacity</label>
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
              <label className="label">Entry Fee (₹)</label>
              <input
                type="number"
                required
                min="0"
                value={tPrice}
                onChange={(e) => setTPrice(e.target.value)}
                className="input"
                placeholder="e.g. 500"
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">Tournament Rules & Guidelines</label>
              <textarea
                rows={2}
                value={tRules}
                onChange={(e) => setTRules(e.target.value)}
                className="input"
                placeholder="Match guidelines, scoring format, requirements..."
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddTournament(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTournament}
                className="btn text-xs"
              >
                {submittingTournament ? 'Publishing...' : 'Publish Tournament'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grounds Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Your Grounds & Live Slot Booking ({facilities.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Click any slot pill to toggle its booking state
          </span>
        </div>
        {facilities.length === 0 ? (
          <div className="card text-center py-12">
            <Landmark className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No grounds added yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your turf or ground to start accepting athlete reservations and managing hourly slots.
            </p>
            <button
              onClick={() => setShowAddGround(true)}
              className="btn btn-sm btn-emerald mt-4"
            >
              <Plus className="h-4 w-4" /> Add Your First Ground
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {facilities.map((f) => (
              <div
                key={f.id}
                className={`card p-6 border-slate-200 transition ${f.closed ? 'bg-slate-50/80 border-dashed' : ''}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3.5">
                    {f.image ? (
                      <img
                        src={f.image}
                        alt={f.name}
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Landmark className="h-8 w-8" />
                     </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-lg text-slate-900">{f.name}</h3>
                        <span className="badge badge-brand text-[10px]">{f.sport}</span>
                        {f.closed && (
                          <span className="badge badge-bad text-[10px]">Temporarily Closed</span>
                        )}
                     </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" /> {f.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                      <span className="text-xs font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        defaultValue={f.price}
                        onBlur={(e) => updatePrice(f.id, e.target.value)}
                        className="w-16 text-xs font-extrabold text-slate-900 focus:outline-none"
                        title="Edit hourly rate"
                      />
                      <span className="text-[10px] text-slate-400">/hr</span>
                    </div>
                    <button
                      onClick={() => toggleClosed(f.id, f.closed)}
                      className={`btn btn-sm text-xs ${f.closed ? 'btn-emerald' : 'btn-secondary text-slate-600'}`}
                    >
                      {f.closed ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" /> Reopen Venue
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" /> Mark Closed
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => deleteGround(f.id)}
                      className="btn-danger btn-sm text-xs"
                      title="Delete this ground"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
                {/* Slots Matrix */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-400" /> Hourly Booking Availability (6 AM - 10 PM)
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Booked
                      </span>
                    </div>
                  </div>
                  <div
                    className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 ${
                      f.closed ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    {Object.keys(f.slots || {})
                      .sort((a, b) => Number(a) - Number(b))
                      .map((slot) => {
                        const isAvailable = f.slots[slot];
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => toggleSlot(f.id, slot, isAvailable)}
                            className={`p-2 rounded-xl text-center border transition transform active:scale-95 ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70'
                                : 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70'
                            }`}
                          >
                            <span className="block text-xs font-black">{formatSlot(slot)}</span>
                            <span className="block text-[10px] font-bold mt-0.5 opacity-90">
                              {isAvailable ? 'Open' : 'Booked'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tournaments Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Trophy className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Active Tournaments ({tournaments.length})
            </h2>
          </div>
        </div>
        {tournaments.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-xs text-slate-500">No tournaments published yet.</p>
            <button
              onClick={() => setShowAddTournament(true)}
              className="btn btn-sm btn-secondary mt-3 text-xs"
            >
              Host Your First Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="card card-hover border-slate-200 p-5 flex flex-col justify-between border-l-4 border-l-amber-500"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="badge badge-brand text-[10px] mb-1">{t.sport}</span>
                      <h4 className="font-bold text-base text-slate-900">{t.name}</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="badge badge-warn text-xs font-black">
                        ₹{t.entryFee || t.price || 0}
                      </span>
                      <span className="badge badge-warn text-xs font-black">
                      </span>
                      <button
                        onClick={() => {
                          setDeleteTarget(t);
                          setDeleteModalOpen(true);
                        }}
                        className="btn btn-sm btn-danger text-xs"
                        title="Delete tournament"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.venue || t.loc}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.date ? new Date(t.date).toDateString() : 'Date TBA'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-purple-700 font-bold">
                      <Users className="h-3.5 w-3.5 text-purple-500" />
                      <span>{t.registeredCount || 0} / {t.maxParticipants || 32} athletes</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Status: {t.status || 'Active'}</span>
                  <span className="font-bold text-emerald-600">Published</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteTournament}
        title="Delete Tournament"
        recordName={deleteTarget?.name ?? ''}
        recordType="Tournament"
        loading={false}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
