'use client';

import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import QRScannerModal from '@/components/QRScannerModal';
import { useState, useEffect } from 'react';
import { uploadImage } from '@/lib/utils/upload';
import Toast from '@/components/ui/Toast';
import {
  GraduationCap,
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
  UserCheck,
  ClipboardCheck,
  Search,
  Building2,
  RefreshCw,
  UserPlus,
  Shield,
  Edit3,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Navigation,
} from 'lucide-react';

// ── Staff roles configuration ──────────────────────────────────────────────
const STAFF_ROLES = [
  'Academy Owner',
  'Academy Manager',
  'Coach',
  'Ground Manager',
  'Receptionist',
  'Support Staff',
];

// ── Supported sports (predefined + custom) ─────────────────────────────────
const PREDEFINED_SPORTS = [
  'Basketball',
  'Football',
  'Cricket',
  'Tennis',
  'Badminton',
  'Volleyball',
  'Swimming',
  'Athletics',
  'Kabaddi',
  'Hockey',
  'Table Tennis',
  'Boxing',
  'Other / Custom Sport',
];

export default function AcademyDashboard() {
  const [academy, setAcademy] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<
    { type: 'ok' | 'err'; text: string } | null
  >(null);

  // ── Custom sport support ─────────────────────────────────────────────────
  const [customSport, setCustomSport] = useState('');

  // ── Staff Management state ───────────────────────────────────────────────
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState(STAFF_ROLES[2]); // Coach default
  const [staffPhone, setStaffPhone] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [checkInQuery, setCheckInQuery] = useState('');
  const [academyBookings, setAcademyBookings] = useState<any[]>([]);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [activeSection, setActiveSection] = useState<'grounds' | 'tournaments' | 'staff' | 'checkin'>('grounds');

  // Ground Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [submittingGround, setSubmittingGround] = useState(false);
  const [showAddGround, setShowAddGround] = useState(false);

  // Academy location editor modal
  const [showAcademyLocationModal, setShowAcademyLocationModal] = useState(false);
  const [acadLocForm, setAcadLocForm] = useState({ address: '', city: '', lat: '', lng: '' });
  const [savingAcadLoc, setSavingAcadLoc] = useState(false);

  // Delete modal states for grounds & staff
  const [groundToDelete, setGroundToDelete] = useState<any>(null);
  const [staffToDelete, setStaffToDelete] = useState<any>(null);
  const [deletingResource, setDeletingResource] = useState(false);

  // Tournament Form State
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState('Basketball');
  const [tCustomSport, setTCustomSport] = useState('');
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

  async function handleResubmitApproval() {
    try {
      const res = await fetch('/api/partners/resubmit', { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        notify('ok', 'Application resubmitted. Waiting for Admin review.');
        await loadData();
      } else {
        notify('err', data.error?.message || 'Could not resubmit application.');
      }
    } catch {
      notify('err', 'Network error while resubmitting application.');
    }
  }

  async function loadData() {
    try {
      const [acadRes, facRes, tourRes, gamesRes, bookingsRes] = await Promise.all([
        fetch('/api/academies/me').then((r) => r.json()),
        fetch('/api/academies/me/facilities').then((r) => r.json()),
        fetch('/api/academies/me/events').then((r) => r.json()),
        fetch('/api/games').then((r) => r.json()),
        fetch('/api/bookings?scope=academy').then((r) => r.json()).catch(() => ({ ok: false })),
      ]);
      if (acadRes.ok) {
        setAcademy(acadRes.data);
        setAcadLocForm({
          address: acadRes.data?.address || '',
          city: acadRes.data?.city || '',
          lat: acadRes.data?.location?.lat ? String(acadRes.data.location.lat) : '',
          lng: acadRes.data?.location?.lng ? String(acadRes.data.location.lng) : '',
        });
      }
      if (facRes.ok) setFacilities(facRes.data || []);
      if (tourRes.ok) setTournaments(tourRes.data || []);
      if (bookingsRes.ok) setAcademyBookings(bookingsRes.data || []);
      if (gamesRes.ok) {
        setGames(gamesRes.data || []);
        if (gamesRes.data?.[0]?.name) {
          setTSport(gamesRes.data[0].name);
        }
      }
    } catch (e) {
      notify('err', 'Could not load academy data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStaff() {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/academies/me/staff');
      const data = await res.json();
      if (data.ok) setStaffList(data.data || []);
    } catch {
      // Staff API may not exist yet — fail silently
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    loadStaff();
  }, []);

  // Ground handlers -------------------------------------------------------
  async function resolveCustomSportIfNeeded(selected: string, customInput: string): Promise<string | null> {
    if (selected !== 'Other / Custom Sport') return selected;
    const trimmed = customInput.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      notify('err', 'Please enter a valid custom sport name (at least 2 characters).');
      return null;
    }
    const normalized = trimmed
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    try {
      await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized, isCustom: true, category: 'Custom Sport' }),
      });
    } catch {
      // Non-fatal: still allow facility creation with normalized name
    }
    return normalized;
  }

  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    const resolvedSport = await resolveCustomSportIfNeeded(sport, customSport);
    if (!resolvedSport) return;

    setSubmittingGround(true);
    let imageUrl = imageUrlInput.trim();
    try {
      if (!imageUrl && imageFile) {
        imageUrl = await uploadImage(imageFile, 'academies');
      }
      const parsedLat = latInput.trim() ? Number(latInput.trim()) : null;
      const parsedLng = lngInput.trim() ? Number(lngInput.trim()) : null;
      const res = await fetch('/api/academies/me/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: address.trim(),
          city: city.trim(),
          lat: parsedLat,
          lng: parsedLng,
          description: description.trim(),
          contact: contact.trim(),
          sport: resolvedSport,
          price: Number(price),
          image: imageUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Added ${name} (${resolvedSport}) to your venues!`);
        setName('');
        setAddress('');
        setCity('');
        setLatInput('');
        setLngInput('');
        setDescription('');
        setContact('');
        setPrice('');
        setCustomSport('');
        setImageFile(null);
        setImageUrlInput('');
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
    const resolvedTSport = await resolveCustomSportIfNeeded(tSport, tCustomSport);
    if (!resolvedTSport) return;

    setSubmittingTournament(true);
    try {
      const res = await fetch('/api/academies/me/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tName,
          sport: resolvedTSport,
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
        setTCustomSport('');
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

  async function handleConfirmDeleteGround() {
    if (!groundToDelete) return;
    setDeletingResource(true);
    try {
      const res = await fetch(`/api/academies/me/facilities?facilityId=${groundToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.ok) {
        notify(
          'ok',
          `Ground "${groundToDelete.name}" removed. ${json.data?.bookingsCancelled || 0} active booking(s) cancelled, ${json.data?.bookingsPreserved || 0} attendance record(s) preserved.`
        );
        await loadData();
      } else {
        notify('err', json.error?.message || 'Failed to delete ground.');
      }
    } catch {
      notify('err', 'Network error deleting ground.');
    } finally {
      setDeletingResource(false);
      setGroundToDelete(null);
    }
  }

  function detectGpsForGround() {
    if (!navigator.geolocation) {
      notify('err', 'GPS geolocation is not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
        notify('ok', 'GPS coordinates captured for this ground.');
      },
      () => notify('err', 'Location permission denied. Enter coordinates or address manually.')
    );
  }

  function detectGpsForAcademy() {
    if (!navigator.geolocation) {
      notify('err', 'GPS geolocation is not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAcadLocForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        notify('ok', 'GPS coordinates captured for academy.');
      },
      () => notify('err', 'Location permission denied. Enter coordinates manually.')
    );
  }

  async function handleSaveAcademyLocation(e: React.FormEvent) {
    e.preventDefault();
    setSavingAcadLoc(true);
    try {
      const lat = acadLocForm.lat.trim() ? Number(acadLocForm.lat.trim()) : null;
      const lng = acadLocForm.lng.trim() ? Number(acadLocForm.lng.trim()) : null;
      const res = await fetch('/api/academies/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: acadLocForm.address.trim(),
          city: acadLocForm.city.trim(),
          lat,
          lng,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setAcademy(json.data);
        setShowAcademyLocationModal(false);
        notify('ok', 'Academy location & coordinates updated.');
      } else {
        notify('err', json.error?.message || 'Failed to update location.');
      }
    } catch {
      notify('err', 'Network error saving location.');
    } finally {
      setSavingAcadLoc(false);
    }
  }

  const formatSlot = (h: string) => {
    const val = parseInt(h);
    const hour = (val % 12) || 12;
    const ampm = val >= 12 ? 'PM' : 'AM';
    return `${hour} ${ampm}`;
  };

  // ── Staff handlers ───────────────────────────────────────────────────────
  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setStaffSubmitting(true);
    try {
      const res = await fetch('/api/academies/me/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: staffEmail.trim(),
          fullName: staffName.trim(),
          role: staffRole,
          phone: staffPhone.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Staff member ${staffName} added as ${staffRole}.`);
        setStaffEmail('');
        setStaffName('');
        setStaffPhone('');
        setStaffRole(STAFF_ROLES[2]);
        setShowAddStaff(false);
        await loadStaff();
      } else {
        notify('err', data.error?.message || 'Failed to add staff member.');
      }
    } catch {
      notify('err', 'Network error while adding staff.');
    } finally {
      setStaffSubmitting(false);
    }
  }

  async function toggleStaffStatus(staffId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await fetch('/api/academies/me/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, status: newStatus }),
      });
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, status: newStatus } : s))
      );
      notify('ok', `Staff member ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
    } catch {
      notify('err', 'Failed to update staff status.');
    }
  }

  async function handleConfirmRemoveStaff() {
    if (!staffToDelete) return;
    setDeletingResource(true);
    try {
      const res = await fetch(`/api/academies/me/staff?staffId=${staffToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.ok) {
        setStaffList((prev) => prev.filter((s) => s.id !== staffToDelete.id));
        notify('ok', `${staffToDelete.fullName || staffToDelete.name} removed from staff.`);
      } else {
        notify('err', json.error?.message || 'Failed to remove staff member.');
      }
    } catch {
      notify('err', 'Failed to remove staff member.');
    } finally {
      setDeletingResource(false);
      setStaffToDelete(null);
    }
  }

  async function handleBookingCheckInAction(
    bookingId: string,
    action: 'check_in' | 'complete' | 'no_show'
  ) {
    try {
      const res = await fetch('/api/bookings/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Booking ${json.data.bookingCode || bookingId} marked ${json.data.status}.`);
        await loadData();
      } else {
        notify('err', json.error?.message || 'Failed to update booking attendance.');
      }
    } catch {
      notify('err', 'Network error updating attendance.');
    }
  }

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
      <Toast message={notification} onClose={() => setNotification(null)} />

      {/* Hero Overview Header */}
      <div className="card bg-white text-[#172033] border-[#E2E8F0] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <img src="/icons/academy.jpg" alt="Academy" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Sports Venue Partner</span>
                <span
                  className={`badge text-[10px] font-bold uppercase ${
                    academy?.verificationStatus === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : academy?.verificationStatus === 'rejected'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {academy?.verificationStatus === 'approved'
                    ? 'Verified Academy'
                    : academy?.verificationStatus === 'rejected'
                    ? 'Verification Rejected'
                    : 'Verification Pending'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033]">
                {academy?.academyName || 'Academy & Arena Control'}
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                {academy?.address || 'Manage turf reservations, live booking slots, and competitive tournaments.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAcademyLocationModal(true)}
              className="btn btn-sm btn-secondary text-xs"
            >
              <Navigation className="h-3.5 w-3.5 text-[#16A36A]" /> Location / GPS
            </button>
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
              Host Tournament
            </button>
          </div>
        </div>
        {/* KPI Strip */}
        <div className="mt-6 pt-6 border-t border-[#E2E8F0] grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-[#64748B] font-medium">Grounds Listed</p>
            <p className="text-xl font-bold text-[#172033] mt-0.5">{facilities.length}</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Hourly Slots Active</p>
            <p className="text-xl font-bold text-teal-700 mt-0.5">{totalSlotsCount}</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Hosted Tournaments</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{tournaments.length}</p>
          </div>
        </div>
      </div>

      {/* Verification Notice Banner */}
      {academy && academy.verificationStatus !== 'approved' && (
        <div className={`rounded-2xl p-4 text-xs flex items-start gap-3 shadow-xs ${
          academy.verificationStatus === 'rejected'
            ? 'border border-rose-200 bg-rose-50 text-rose-900'
            : 'border border-amber-200/60 bg-amber-50 text-amber-900'
        }`}>
          <Clock className={`h-4 w-4 shrink-0 mt-0.5 ${
            academy.verificationStatus === 'rejected' ? 'text-rose-600' : 'text-amber-600'
          }`} />
          <div className="flex-1">
            <p className="font-bold">
              {academy.verificationStatus === 'rejected'
                ? 'Academy Verification Rejected'
                : 'Academy Verification Pending'}
            </p>
            <p className="mt-0.5">
              {academy.verificationStatus === 'rejected'
                ? 'Your application was rejected. You can request another review by resubmitting it.'
                : 'Your sports academy profile is awaiting administrator verification. Grounds and tournament publishing remain restricted until approval.'}
            </p>
            {academy.verificationStatus === 'rejected' && (
              <button
                type="button"
                onClick={handleResubmitApproval}
                className="btn btn-sm btn-emerald mt-3"
              >
                Request Approval Again
              </button>
            )}
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
              <label className="label">Ground Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Apex Arena Court 1"
              />
            </div>
            <div>
              <label className="label">Full Address / Location (Optional)</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="e.g. 12 Sports Lane, North Arena"
              />
            </div>
            <div>
              <label className="label">City (Optional)</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input"
                placeholder="e.g. Visakhapatnam"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Coordinates (GPS or Manual)</label>
                <button
                  type="button"
                  onClick={detectGpsForGround}
                  className="text-[11px] font-bold text-[#16A36A] hover:underline flex items-center gap-1"
                >
                  <Navigation className="h-3 w-3" /> Use GPS
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="input text-xs"
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="any"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  className="input text-xs"
                  placeholder="Longitude"
                />
              </div>
            </div>
            <div>
              <label className="label">Sport Category *</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="input"
              >
                {Array.from(
                  new Set([
                    ...PREDEFINED_SPORTS.filter((s) => s !== 'Other / Custom Sport'),
                    ...games.map((g) => g.name).filter(Boolean),
                  ])
                ).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Other / Custom Sport">Other / Custom Sport</option>
              </select>
              {sport === 'Other / Custom Sport' && (
                <input
                  required
                  value={customSport}
                  onChange={(e) => setCustomSport(e.target.value)}
                  className="input mt-2"
                  placeholder="Enter custom sport name (e.g. Pickleball, Padel)"
                />
              )}
            </div>
            <div>
              <label className="label">Hourly Price (₹/hr) *</label>
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
            <div>
              <label className="label">Contact / Phone (Optional)</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="input"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description / Amenities (Optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                placeholder="Synthetic turf, LED floodlights, changing rooms, drinking water..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Ground Photo (Optional)</label>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="input file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Or</span>
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="input text-xs"
                    placeholder="Paste direct Image URL (e.g. https://images.unsplash.com/...)"
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddGround(false)}
                className="btn btn-secondary text-xs w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingGround}
                className="btn btn-emerald text-xs w-full sm:w-auto"
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
                <img src="/icons/tournament.jpg" alt="Tournament" className="w-full h-full object-cover" />
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
              <label className="label">Sport / Game *</label>
              <select
                value={tSport}
                onChange={(e) => setTSport(e.target.value)}
                className="input"
              >
                {Array.from(
                  new Set([
                    ...facilities.map((f) => (f.sport || '').trim()).filter(Boolean),
                    ...games.map((g) => (g.name || '').trim()).filter(Boolean),
                    ...PREDEFINED_SPORTS.filter((s) => s !== 'Other / Custom Sport'),
                  ])
                ).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Other / Custom Sport">Other / Custom Sport</option>
              </select>
              {tSport === 'Other / Custom Sport' && (
                <input
                  required
                  value={tCustomSport}
                  onChange={(e) => setTCustomSport(e.target.value)}
                  className="input mt-2"
                  placeholder="Enter custom sport name"
                />
              )}
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
              <img src="/icons/ground.jpg" alt="Ground" className="w-full h-full object-cover" />
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
            <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-2" />
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
                        <MapPin className="h-8 w-8" />
                     </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-lg text-slate-900">{f.name}</h3>
                        <span className="badge badge-brand text-[10px]">{f.sport}</span>
                        {f.closed && (
                          <span className="badge badge-bad text-[10px]">Temporarily Closed</span>
                        )}
                      </div>
                      {f.address && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {f.address}
                        </p>
                      )}
                      {f.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{f.description}</p>
                      )}
                      {f.contact && (
                        <p className="text-[11px] text-slate-400 mt-0.5">Contact: {f.contact}</p>
                      )}
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
                      onClick={() => setGroundToDelete(f)}
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
              <img src="/icons/tournament.jpg" alt="Tournament" className="w-full h-full object-cover" />
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

      {/* ── Academy Section Navigation Tabs ───────────────────────────── */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 p-1 bg-slate-100/70 rounded-2xl border border-[#E5E7EB]">
        {[
          { key: 'grounds', label: 'Grounds & Facilities', icon: Building2 },
          { key: 'tournaments', label: 'Tournaments', icon: Trophy },
          { key: 'staff', label: 'Staff Management', icon: Users },
          { key: 'checkin', label: 'Check-In Hub', icon: ClipboardCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key as any)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              activeSection === key
                ? 'bg-white text-[#0E7055] shadow-sm border border-[#E5E7EB]'
                : 'text-[#667085] hover:text-[#172033] hover:bg-white/50'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
            {key === 'staff' && staffList.length > 0 && (
              <span className="ml-1 rounded-full bg-[#C5E9D7] text-[#0E7055] px-1.5 py-0.5 text-[10px] font-bold">
                {staffList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Staff Management Section ───────────────────────────────────── */}
      {activeSection === 'staff' && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#172033]">Staff Management</h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Add and manage coaches, ground managers, receptionists and other staff members.
              </p>
            </div>
            <button
              onClick={() => setShowAddStaff(!showAddStaff)}
              className="btn btn-sm"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </button>
          </div>

          {/* Add Staff Form */}
          {showAddStaff && (
            <div className="card border-2 border-[#16A36A]/20 bg-[#E8F5EE]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#172033] flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[#16A36A]" />
                  Add New Staff Member
                </h3>
                <button onClick={() => setShowAddStaff(false)} className="text-[#667085] hover:text-[#172033]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="input"
                    placeholder="e.g. Ravi Kumar"
                  />
                </div>
                <div>
                  <label className="label">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="input"
                    placeholder="e.g. ravi@academy.com"
                  />
                </div>
                <div>
                  <label className="label">Staff Role *</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="input"
                  >
                    {STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Phone Number (Optional)</label>
                  <input
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="input"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddStaff(false)}
                    className="btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={staffSubmitting} className="btn btn-sm">
                    {staffSubmitting ? 'Adding...' : 'Add Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Staff List */}
          {staffLoading ? (
            <div className="card py-10 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16A36A] border-t-transparent mx-auto" />
              <p className="text-xs text-[#667085] mt-3">Loading staff...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users className="h-7 w-7" />
              </div>
              <p className="empty-state-title">No staff members yet</p>
              <p className="empty-state-desc">
                Add coaches, ground managers and other staff to manage your academy operations.
              </p>
              <button onClick={() => setShowAddStaff(true)} className="btn btn-sm mt-5">
                <UserPlus className="h-4 w-4" /> Add First Staff Member
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="data-table">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.fullName || s.name || '—'}</td>
                      <td>
                        <span className="badge badge-brand text-[11px]">{s.role || 'Staff'}</span>
                      </td>
                      <td className="text-[#667085] text-xs">{s.email || '—'}</td>
                      <td className="text-[#667085] text-xs">{s.phone || '—'}</td>
                      <td>
                        <span className={`badge text-[11px] ${s.status === 'active' ? 'badge-ok' : 'badge-neutral'}`}>
                          {s.status || 'active'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStaffStatus(s.id, s.status || 'active')}
                            className="btn-ghost btn-sm text-xs"
                            title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {s.status === 'active' ? (
                              <ToggleRight className="h-4 w-4 text-[#16A36A]" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-[#667085]" />
                            )}
                          </button>
                          <button
                            onClick={() => setStaffToDelete(s)}
                            className="btn-ghost btn-sm text-xs text-rose-600 hover:bg-rose-50"
                            title="Remove staff"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Check-In Hub Section ─────────────────────────────────────────── */}
      {activeSection === 'checkin' && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#172033]">Venue Check-In Hub &amp; QR Attendance</h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Scan player QR passes, verify bookings server-side, and record staff check-ins.
              </p>
            </div>
            <button
              onClick={() => setShowQrScanner(true)}
              className="btn btn-sm text-xs shrink-0"
            >
              <QrCode className="h-4 w-4" /> Open QR Scanner
            </button>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Active Grounds', value: `${facilities.length}`, color: 'text-[#172033]' },
              { label: 'Confirmed Bookings', value: `${academyBookings.filter((b) => b.status === 'confirmed').length}`, color: 'text-amber-600' },
              { label: 'Checked In / Completed', value: `${academyBookings.filter((b) => b.status === 'checked_in' || b.status === 'completed').length}`, color: 'text-[#16A36A]' },
              { label: 'Under Maintenance', value: `${facilities.filter((f) => f.closed).length}`, color: 'text-rose-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-[#667085] font-medium">{label}</p>
                <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Quick check-in tool */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172033]">Manual Booking-ID Check-In</h3>
                  <p className="text-xs text-[#667085]">Enter Booking Code (e.g. PNX-A1B2C3) or Booking ID for server validation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrScanner(true)}
                className="btn-secondary btn-sm text-xs"
              >
                <QrCode className="h-3.5 w-3.5 text-[#16A36A]" /> Camera Scan
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                <input
                  type="text"
                  value={checkInQuery}
                  onChange={(e) => setCheckInQuery(e.target.value)}
                  placeholder="Enter booking code (PNX-...) or search below..."
                  className="input pl-10"
                />
              </div>
              <button
                onClick={() => {
                  if (checkInQuery.trim()) {
                    handleBookingCheckInAction(checkInQuery.trim(), 'check_in');
                    setCheckInQuery('');
                  }
                }}
                disabled={!checkInQuery.trim()}
                className="btn btn-sm w-full sm:w-auto"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verify &amp; Check In
              </button>
            </div>
          </div>

          {/* Live Bookings & Attendance Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#172033]">
                Ground Bookings &amp; Attendance ({academyBookings.length})
              </h3>
              <button type="button" onClick={loadData} className="btn-ghost btn-sm text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            {academyBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#667085]">
                No ground bookings recorded for your academy yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th>Booking Code</th>
                      <th>Player</th>
                      <th>Ground</th>
                      <th>Date &amp; Slot</th>
                      <th>Status</th>
                      <th>Checked-In By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academyBookings
                      .filter((b) => {
                        const q = checkInQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (b.bookingCode || '').toLowerCase().includes(q) ||
                          b.id.toLowerCase().includes(q) ||
                          (b.userEmail || '').toLowerCase().includes(q) ||
                          (b.userName || '').toLowerCase().includes(q)
                        );
                      })
                      .map((b) => (
                        <tr key={b.id}>
                          <td className="font-mono font-bold text-xs">{b.bookingCode || b.id.slice(0, 8)}</td>
                          <td className="text-xs">
                            <p className="font-semibold text-[#172033]">{b.userName || 'Player'}</p>
                            <p className="text-[11px] text-[#667085]">{b.userEmail}</p>
                          </td>
                          <td className="text-xs font-medium">{b.facilityName}</td>
                          <td className="text-xs">{b.bookingDate || 'Today'} · {formatSlot(String(b.slot))}</td>
                          <td>
                            <span
                              className={`badge text-[10px] uppercase ${
                                b.status === 'checked_in' || b.status === 'completed'
                                  ? 'badge-ok'
                                  : b.status === 'cancelled' || b.status === 'no_show'
                                  ? 'badge-bad'
                                  : 'badge-warn'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="text-[11px] text-[#667085]">
                            {b.checkedInBy?.email
                              ? `${b.checkedInBy.email} (${new Date(b.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                              : '—'}
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {b.status === 'confirmed' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleBookingCheckInAction(b.id, 'check_in')}
                                    className="btn btn-sm text-[11px] py-1 px-2.5"
                                  >
                                    Check In
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBookingCheckInAction(b.id, 'no_show')}
                                    className="btn-secondary btn-sm text-[11px] py-1 px-2"
                                  >
                                    No Show
                                  </button>
                                </>
                              )}
                              {b.status === 'checked_in' && (
                                <button
                                  type="button"
                                  onClick={() => handleBookingCheckInAction(b.id, 'complete')}
                                  className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                                >
                                  Complete
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

          {/* Court status overview */}
          <div>
            <h3 className="section-title mb-4">Ground &amp; Court Oversight</h3>
            {facilities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Building2 className="h-6 w-6" /></div>
                <p className="empty-state-title">No grounds added yet</p>
                <p className="empty-state-desc">Add grounds in the Grounds &amp; Facilities section first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {facilities.map((f) => (
                  <div
                    key={f.id}
                    className={`card p-5 flex flex-col justify-between ${f.closed ? 'opacity-80 border-dashed' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="badge badge-brand text-[10px] mb-1">{f.sport}</span>
                        <h4 className="font-bold text-[#172033]">{f.name}</h4>
                        <p className="text-xs text-[#667085] flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />{f.address || 'No address'}
                        </p>
                      </div>
                      <span className={`badge text-[10px] font-bold ${f.closed ? 'badge-bad' : 'badge-ok'}`}>
                        {f.closed ? 'Maintenance' : 'Ready'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleClosed(f.id, f.closed)}
                      className={`btn btn-sm w-full text-xs ${f.closed ? 'btn-emerald' : 'btn-secondary'}`}
                    >
                      {f.closed ? <><Unlock className="h-3.5 w-3.5" /> Reopen Court</> : <><Lock className="h-3.5 w-3.5" /> Mark Maintenance</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onCheckedIn={loadData}
        onNotify={notify}
      />

      {/* Delete Ground Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!groundToDelete}
        onClose={() => setGroundToDelete(null)}
        onConfirm={handleConfirmDeleteGround}
        title="Delete Ground"
        recordName={groundToDelete?.name || ''}
        recordType="Ground"
        warningText="Deleting this ground cancels active confirmed bookings (notifying affected players), frees slot locks, and deletes ratings while preserving historical check-in records."
        loading={deletingResource}
      />

      {/* Remove Staff Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!staffToDelete}
        onClose={() => setStaffToDelete(null)}
        onConfirm={handleConfirmRemoveStaff}
        title="Remove Staff Member"
        recordName={staffToDelete?.fullName || staffToDelete?.name || ''}
        recordType="Staff Member"
        warningText="This staff member will immediately lose access to academy check-in and ground management tools."
        loading={deletingResource}
      />

      {/* Academy Location & GPS Modal */}
      {showAcademyLocationModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title">Academy Location &amp; GPS</h3>
              <button onClick={() => setShowAcademyLocationModal(false)} className="text-[#667085] hover:text-[#172033]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAcademyLocation} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Street Address *</label>
                <input
                  required
                  value={acadLocForm.address}
                  onChange={(e) => setAcadLocForm({ ...acadLocForm, address: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  value={acadLocForm.city}
                  onChange={(e) => setAcadLocForm({ ...acadLocForm, city: e.target.value })}
                  className="input"
                  placeholder="e.g. Visakhapatnam"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Coordinates (GPS or Manual)</label>
                  <button
                    type="button"
                    onClick={detectGpsForAcademy}
                    className="text-[11px] font-bold text-[#16A36A] hover:underline flex items-center gap-1"
                  >
                    <Navigation className="h-3 w-3" /> Use GPS
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={acadLocForm.lat}
                    onChange={(e) => setAcadLocForm({ ...acadLocForm, lat: e.target.value })}
                    className="input"
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="any"
                    value={acadLocForm.lng}
                    onChange={(e) => setAcadLocForm({ ...acadLocForm, lng: e.target.value })}
                    className="input"
                    placeholder="Longitude"
                  />
                </div>
              </div>
              <div className="modal-footer px-0 pb-0">
                <button type="button" onClick={() => setShowAcademyLocationModal(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={savingAcadLoc} className="btn btn-sm">
                  {savingAcadLoc ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
