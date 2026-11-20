'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Users, 
  Search, 
  QrCode, 
  UserCheck, 
  AlertTriangle, 
  Calendar,
  Lock,
  Unlock,
  Building2,
  RefreshCw
} from 'lucide-react';
import Toast, { ToastMessage } from '@/components/ui/Toast';

export default function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [checkInQuery, setCheckInQuery] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());

  async function loadData() {
    setLoading(true);
    try {
      const [facRes, bookRes] = await Promise.all([
        fetch('/api/facilities').then(r => r.json()),
        fetch('/api/bookings').then(r => r.json()).catch(() => ({ ok: true, data: [] }))
      ]);
      if (facRes.ok) setFacilities(facRes.data || []);
      if (bookRes.ok) setBookings(bookRes.data || []);
    } catch {
      setToast({ type: 'err', text: 'Could not load venue operations data.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleCheckIn(id: string, name: string) {
    setCheckedInIds(prev => new Set(prev).add(id));
    setToast({ type: 'ok', text: `Athlete ${name} checked in successfully!` });
  }

  async function toggleCourtStatus(facilityId: string, currentClosed: boolean) {
    try {
      setFacilities(prev => prev.map(f => f.id === facilityId ? { ...f, closed: !currentClosed } : f));
      await fetch('/api/academies/me/facilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, closed: !currentClosed })
      });
      setToast({
        type: 'ok',
        text: !currentClosed ? 'Court marked under maintenance.' : 'Court reopened for play!'
      });
    } catch {
      setToast({ type: 'err', text: 'Failed to update court status.' });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-[#64748B]">Loading staff operations console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <Toast message={toast} onClose={() => setToast(null)} />

      {/* Staff Hero Card */}
      <div className="card bg-white text-[#172033] border-[#E2E8F0] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Ground Operations</span>
                <span className="badge bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase">
                  Staff Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033]">
                Venue Operations & Check-In Hub
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                Manage on-ground athlete check-ins, oversee court readiness, and update match status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadData}
              className="btn btn-sm btn-secondary text-xs w-full sm:w-auto flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Operational KPI Strip */}
        <div className="mt-6 pt-6 border-t border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-[#64748B] font-medium">Active Grounds</p>
            <p className="text-xl font-bold text-[#172033] mt-0.5">{facilities.length} Arenas</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Operational Courts</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">
              {facilities.filter(f => !f.closed).length} Open
            </p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Checked-In Athletes</p>
            <p className="text-xl font-bold text-[#2563EB] mt-0.5">{checkedInIds.size} Today</p>
          </div>
          <div>
            <p className="text-[#64748B] font-medium">Under Maintenance</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">
              {facilities.filter(f => f.closed).length} Courts
            </p>
          </div>
        </div>
      </div>

      {/* Quick Check-In Tool */}
      <section className="card p-6 border-[#E2E8F0] bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">Athlete Instant Check-In</h2>
              <p className="text-xs text-[#64748B]">Verify booking code or athlete name upon arrival at the gate</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={checkInQuery}
              onChange={(e) => setCheckInQuery(e.target.value)}
              placeholder="Search by Booking ID, Athlete Name, or Phone..."
              className="input pl-10 text-xs sm:text-sm"
            />
          </div>
          <button
            onClick={() => {
              if (checkInQuery.trim()) {
                handleCheckIn(`ck-${Date.now()}`, checkInQuery.trim());
                setCheckInQuery('');
              }
            }}
            disabled={!checkInQuery.trim()}
            className="btn btn-sm w-full sm:w-auto text-xs flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirm Check-In
          </button>
        </div>
      </section>

      {/* Grounds & Court Status Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-[#172033]">
              Ground & Court Oversight ({facilities.length})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.map((f) => (
            <div
              key={f.id}
              className={`card p-5 border-[#E2E8F0] bg-white flex flex-col justify-between ${
                f.closed ? 'bg-slate-50 border-dashed opacity-80' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="badge badge-brand text-[10px] mb-1">{f.sport}</span>
                    <h3 className="font-bold text-base text-[#172033]">{f.name}</h3>
                    <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                      {f.address}
                    </p>
                  </div>
                  <span
                    className={`badge text-[10px] uppercase font-bold ${
                      f.closed ? 'badge-bad' : 'badge-ok'
                    }`}
                  >
                    {f.closed ? 'Maintenance' : 'Ready'}
                  </span>
                </div>

                <div className="h-32 w-full rounded-xl bg-slate-100 overflow-hidden mb-3 relative">
                  {f.image ? (
                    <img
                      src={f.image}
                      alt={f.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400 bg-slate-100">
                      <Building2 className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="text-xs text-[#64748B] space-y-1 mb-4">
                  <p className="flex items-center justify-between">
                    <span>Hourly Rate:</span>
                    <span className="font-bold text-[#172033]">₹{f.price}/hr</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Venue Academy:</span>
                    <span className="font-medium text-[#172033] truncate max-w-[150px]">
                      {f.academyName || 'PlayNex Venue'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0]">
                <button
                  onClick={() => toggleCourtStatus(f.id, f.closed)}
                  className={`btn btn-sm w-full text-xs flex items-center justify-center gap-1.5 ${
                    f.closed ? 'btn-emerald' : 'btn-secondary text-slate-700'
                  }`}
                >
                  {f.closed ? (
                    <>
                      <Unlock className="h-3.5 w-3.5" /> Reopen Court
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Mark Maintenance
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

