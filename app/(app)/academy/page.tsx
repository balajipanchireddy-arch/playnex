'use client';
import { useState, useEffect } from 'react';
import { uploadImage } from '@/lib/utils/upload';

export default function AcademyDashboard() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  // Ground Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Tournament Form State
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState('Basketball');
  const [tDate, setTDate] = useState('');
  const [tLoc, setTLoc] = useState('');
  const [tPrice, setTPrice] = useState('');

  async function loadData() {
    try {
      const [facRes, tourRes] = await Promise.all([
        fetch('/api/academies/me/facilities').then(r => r.json()),
        fetch('/api/academies/me/events').then(r => r.json())
      ]);
      if (facRes.ok) setFacilities(facRes.data);
      if (tourRes.ok) setTournaments(tourRes.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    setMsg(''); setSubmitting(true);
    let imageUrl = '';
    try {
      if (imageFile) imageUrl = await uploadImage(imageFile, 'academies');
      const res = await fetch('/api/academies/me/facilities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, sport, price: Number(price), image: imageUrl })
      });
      if ((await res.json()).ok) {
        setMsg('✅ Ground added!'); setName(''); setAddress(''); setPrice(''); setImageFile(null); loadData();
      }
    } catch (err) { setMsg('❌ Failed to upload/save.'); } finally { setSubmitting(false); }
  }

  async function handleAddTournament(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/academies/me/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tName, sport: tSport, date: tDate, loc: tLoc, price: Number(tPrice) })
    });
    if ((await res.json()).ok) {
      setMsg('✅ Tournament published successfully!');
      setTName(''); setTDate(''); setTLoc(''); setTPrice(''); loadData();
    }
  }

  async function toggleSlot(facilityId: string, slot: string, currentAvail: boolean) {
    setFacilities(facilities.map(f => f.id === facilityId ? { ...f, slots: { ...f.slots, [slot]: !currentAvail } } : f));
    await fetch('/api/academies/me/facilities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facilityId, slot, available: !currentAvail }) });
  }
  async function updatePrice(facilityId: string, newPrice: string) {
    const p = Number(newPrice); if (isNaN(p)) return;
    setFacilities(facilities.map(f => f.id === facilityId ? { ...f, price: p } : f));
    await fetch('/api/academies/me/facilities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facilityId, price: p }) });
  }
  async function toggleClosed(facilityId: string, currentClosed: boolean) {
    setFacilities(facilities.map(f => f.id === facilityId ? { ...f, closed: !currentClosed } : f));
    await fetch('/api/academies/me/facilities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facilityId, closed: !currentClosed }) });
  }
  async function deleteGround(facilityId: string) {
    if (!confirm('Delete this ground?')) return;
    await fetch(`/api/academies/me/facilities?facilityId=${facilityId}`, { method: 'DELETE' });
    loadData();
  }

  const formatSlot = (h: string) => `${parseInt(h) % 12 || 12} ${parseInt(h) >= 12 ? 'PM' : 'AM'}`;

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="card">
        <h1 className="text-2xl font-extrabold">🏟️ Academy Dashboard</h1>
        <p className="text-sm text-ink2 mt-1">Manage your grounds and host tournaments.</p>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}
      </div>

      {/* 🏆 TOURNAMENTS SECTION */}
      <div className="card border-t-4 border-brand">
        <h2 className="text-xl font-extrabold mb-4">🏆 Host a Tournament</h2>
        <form onSubmit={handleAddTournament} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8 bg-gray-50 p-4 rounded-xl border border-line">
          <div className="md:col-span-2"><label className="label">Tournament Name</label><input required value={tName} onChange={e=>setTName(e.target.value)} className="input" placeholder="e.g. Summer Cup 2026" /></div>
          <div><label className="label">Sport</label><select value={tSport} onChange={e=>setTSport(e.target.value)} className="input"><option>Basketball</option><option>Football</option><option>Cricket</option></select></div>
          <div><label className="label">Date</label><input type="date" required value={tDate} onChange={e=>setTDate(e.target.value)} className="input" /></div>
          <div><label className="label">Location</label><input required value={tLoc} onChange={e=>setTLoc(e.target.value)} className="input" placeholder="Main Ground" /></div>
          <div><label className="label">Entry Fee (₹)</label><input type="number" required min="0" value={tPrice} onChange={e=>setTPrice(e.target.value)} className="input" /></div>
          <button type="submit" className="btn md:col-span-1 w-full">Publish</button>
        </form>

        <h3 className="font-bold text-sm text-ink2 uppercase tracking-wide mb-3">Your Active Tournaments</h3>
        {tournaments.length === 0 ? <p className="text-sm text-ink2">No tournaments hosted yet.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map(t => (
              <div key={t.id} className="border border-line p-4 rounded-xl bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <p className="font-bold">{t.name}</p>
                  <span className="badge badge-warn text-xs">₹{t.price}</span>
                </div>
                <p className="text-xs text-ink2 mt-1">📍 {t.loc} · {t.sport}</p>
                <p className="text-xs font-semibold text-brand mt-2">📅 {new Date(t.date).toDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🏟️ GROUNDS SECTION */}
      <div className="card">
        <h2 className="text-xl font-extrabold mb-4">🏟️ Your Grounds</h2>
        {facilities.length === 0 ? <p className="text-sm text-ink2">No grounds added yet.</p> : (
          <div className="space-y-6">
            {facilities.map(f => (
              <div key={f.id} className="border border-line p-4 rounded-xl">
                {f.image && <img src={f.image} alt={f.name} className="w-full h-40 object-cover rounded-lg mb-4" />}
                <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
                  <div>
                    <p className="font-bold text-lg">{f.name}</p>
                    <p className="text-sm text-ink2">{f.sport} · {f.address}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-ink2 font-bold">₹</span>
                      <input type="number" defaultValue={f.price} onBlur={(e) => updatePrice(f.id, e.target.value)} className="w-20 border border-line rounded p-1 text-sm font-bold" />
                    </div>
                    <button onClick={() => toggleClosed(f.id, f.closed)} className={`btn btn-sm ${f.closed ? 'bg-bad text-white' : 'btn-ghost'}`}>{f.closed ? 'Reopen' : 'Close'}</button>
                    <button onClick={() => deleteGround(f.id)} className="btn btn-sm text-bad border border-line hover:bg-bad/10">Delete</button>
                  </div>
                </div>
                <div className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 ${f.closed ? 'opacity-50 pointer-events-none' : ''}`}>
                  {Object.keys(f.slots || {}).sort((a,b) => Number(a) - Number(b)).map(slot => (
                    <button key={slot} onClick={() => toggleSlot(f.id, slot, f.slots[slot])} className={`p-2 rounded-lg text-xs font-bold text-center transition border ${f.slots[slot] ? 'bg-[#e1f5ec] text-ok border-[#ccecd9]' : 'bg-[#fde8e8] text-bad border-[#f3c4c4]'}`}>
                      {formatSlot(slot)}<br/><span className="text-[10px] opacity-80">{f.slots[slot] ? '🟢 Available' : '🔴 Booked'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD GROUND FORM */}
      <div className="card">
        <h2 className="text-lg font-extrabold mb-4">Add a Ground</h2>
        <form onSubmit={handleAddFacility} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div><label className="label">Ground Name</label><input required value={name} onChange={e=>setName(e.target.value)} className="input" /></div>
          <div><label className="label">Address</label><input required value={address} onChange={e=>setAddress(e.target.value)} className="input" /></div>
          <div><label className="label">Sport</label><select value={sport} onChange={e=>setSport(e.target.value)} className="input"><option>Basketball</option><option>Football</option><option>Cricket</option><option>Tennis</option></select></div>
          <div><label className="label">Price (₹/hr)</label><input type="number" required min="1" value={price} onChange={e=>setPrice(e.target.value)} className="input" /></div>
          <div className="md:col-span-2">
            <label className="label">Ground Photo</label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="input" />
          </div>
          <button type="submit" disabled={submitting} className="btn md:col-span-2">{submitting ? 'Uploading...' : 'Add Ground'}</button>
        </form>
      </div>
    </div>
  );
}
