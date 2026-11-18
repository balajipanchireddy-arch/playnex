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
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const res = await fetch('/api/academies/me/facilities');
      const data = await res.json();
      if (data.ok) setFacilities(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/academies/me/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, sport, price: Number(price) })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('✅ Ground added successfully! Players can now see it.');
        setName(''); setAddress(''); setPrice('');
        loadData();
      } else {
        setMsg(`❌ Error: ${data.error.message}`);
      }
    } catch (err) {
      setMsg('❌ Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center mt-10">Loading your academy...</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-extrabold">🏟️ Academy Dashboard</h1>
        <p className="text-sm text-ink2 mt-1">Manage your grounds and locations.</p>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">➕ Add a Ground</h2>
          <form onSubmit={handleAddFacility} className="space-y-4">
            <div>
              <label className="label">Ground Name</label>
              <input required value={name} onChange={e=>setName(e.target.value)} className="input" placeholder="e.g. Arena A" />
            </div>
            <div>
              <label className="label">Full Address / Location</label>
              <input required value={address} onChange={e=>setAddress(e.target.value)} className="input" placeholder="e.g. Beach Road, Vizag" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sport</label>
                <select value={sport} onChange={e=>setSport(e.target.value)} className="input">
                  <option>Basketball</option>
                  <option>Football</option>
                  <option>Cricket</option>
                  <option>Tennis</option>
                  <option>Badminton</option>
                </select>
              </div>
              <div>
                <label className="label">Price per hour (₹)</label>
                <input type="number" required min="1" value={price} onChange={e=>setPrice(e.target.value)} className="input" placeholder="500" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn w-full">
              {submitting ? 'Adding...' : 'Add Ground'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">📍 Your Grounds ({facilities.length})</h2>
          {facilities.length === 0 ? (
            <p className="text-sm text-ink2">No grounds added yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {facilities.map(f => (
                <div key={f.id} className="border border-line p-3 rounded-xl">
                  <p className="font-bold">{f.name}</p>
                  <p className="text-xs text-ink2">{f.address}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs font-semibold text-brand">₹{f.price} / hour</p>
                    <span className="badge badge-ok">{f.sport}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
