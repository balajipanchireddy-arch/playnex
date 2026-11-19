'use client';
import { useState, useEffect } from 'react';

export default function AcademyDashboard() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');

  async function loadData() {
    try {
      const res = await fetch('/api/academies/me/facilities');
      const data = await res.json();
      if (data.ok) setFacilities(data.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/academies/me/facilities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, sport, price: Number(price) })
    });
    if ((await res.json()).ok) {
      setMsg('✅ Ground added successfully!');
      setName(''); setAddress(''); setPrice('');
      loadData();
    }
  }

  async function toggleSlot(facilityId: string, slot: string, currentAvail: boolean) {
    setFacilities(facilities.map(f => {
      if (f.id === facilityId) return { ...f, slots: { ...f.slots, [slot]: !currentAvail } };
      return f;
    }));
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, slot, available: !currentAvail })
    });
  }

  async function updatePrice(facilityId: string, newPrice: string) {
    const p = Number(newPrice);
    if (isNaN(p)) return;
    setFacilities(facilities.map(f => f.id === facilityId ? { ...f, price: p } : f));
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, price: p })
    });
  }

  async function toggleClosed(facilityId: string, currentClosed: boolean) {
    setFacilities(facilities.map(f => f.id === facilityId ? { ...f, closed: !currentClosed } : f));
    await fetch('/api/academies/me/facilities', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, closed: !currentClosed })
    });
  }

  async function deleteGround(facilityId: string) {
    if (!confirm('Delete this ground?')) return;
    await fetch(`/api/academies/me/facilities?facilityId=${facilityId}`, { method: 'DELETE' });
    loadData();
  }

  // Helper to format hour (e.g. 18 -> 6 PM)
  const formatSlot = (h: string) => {
    const hour = parseInt(h);
    return `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-extrabold">🏟️ Academy Dashboard</h1>
        <p className="text-sm text-ink2 mt-1">Manage your grounds, prices, and time slots.</p>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}
      </div>

      {/* Grounds List */}
      <div className="card">
        <h2 className="text-lg font-extrabold mb-4">Your Grounds <small className="text-xs font-normal text-ink2">Tap a slot to switch between available/booked</small></h2>
        {facilities.length === 0 ? <p className="text-sm text-ink2">No grounds added yet.</p> : (
          <div className="space-y-6">
            {facilities.map(f => (
              <div key={f.id} className="border border-line p-4 rounded-xl">
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
                    <button onClick={() => toggleClosed(f.id, f.closed)} className={`btn btn-sm ${f.closed ? 'bg-bad text-white' : 'btn-ghost'}`}>
                      {f.closed ? 'Reopen Ground' : 'Temporarily Close'}
                    </button>
                    <button onClick={() => deleteGround(f.id)} className="btn btn-sm text-bad border border-line hover:bg-bad/10">Delete</button>
                  </div>
                </div>

                {/* Time Slots Grid */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 ${f.closed ? 'opacity-50 pointer-events-none' : ''}`}>
                  {Object.keys(f.slots || {}).sort((a,b) => Number(a) - Number(b)).map(slot => (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(f.id, slot, f.slots[slot])}
                      className={`p-2 rounded-lg text-xs font-bold text-center transition border ${
                        f.slots[slot] 
                          ? 'bg-[#e1f5ec] text-ok border-[#ccecd9] hover:bg-[#d1f0e2]' 
                          : 'bg-[#fde8e8] text-bad border-[#f3c4c4] hover:bg-[#fbd4d4]'
                      }`}
                    >
                      {formatSlot(slot)}<br/>
                      <span className="text-[10px] opacity-80">{f.slots[slot] ? '🟢 Available' : '🔴 Booked'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Ground Form */}
      <div className="card">
        <h2 className="text-lg font-extrabold mb-4">Add a Ground</h2>
        <form onSubmit={handleAddFacility} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div><label className="label">Ground Name</label><input required value={name} onChange={e=>setName(e.target.value)} className="input" placeholder="e.g. Arena A" /></div>
          <div><label className="label">Address</label><input required value={address} onChange={e=>setAddress(e.target.value)} className="input" placeholder="Beach Road" /></div>
          <div>
            <label className="label">Sport</label>
            <select value={sport} onChange={e=>setSport(e.target.value)} className="input">
              <option>Basketball</option><option>Football</option><option>Cricket</option><option>Tennis</option><option>Badminton</option>
            </select>
          </div>
          <div><label className="label">Price (₹/hr)</label><input type="number" required min="1" value={price} onChange={e=>setPrice(e.target.value)} className="input" placeholder="500" /></div>
          <button type="submit" className="btn md:col-span-4">Add Ground</button>
        </form>
      </div>
    </div>
  );
}
