'use client';
import { useState, useEffect } from 'react';

export default function PlayerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [search, setSearch] = useState({ sport: 'Basketball', players: 5, radius: 5, time: 18 });
  const [searched, setSearched] = useState(false);

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

  async function toggleAvailability() {
    if (!profile) return;
    const newState = !profile.available;
    setProfile({ ...profile, available: newState });
    await fetch('/api/player/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: newState })
    });
    setMsg(newState ? 'You are visible to nearby players' : 'You are no longer listed as available');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }

  async function handleBook(f: any) {
    setMsg('');
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: f.id, facilityName: f.name, slot: '18', price: f.price })
    });
    const data = await res.json();
    if (data.ok) {
      setMsg(`✅ Successfully booked ${f.name} for 6:00 PM!`);
      loadData();
    } else { setMsg(`❌ Error: ${data.error.message}`); }
  }

  async function handleBuy(p: any) {
    setMsg('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id, productName: p.name, storeId: p.storeId, price: p.price, qty: 1 })
    });
    const data = await res.json();
    if (data.ok) { setMsg(`✅ Order placed for ${p.name}!`); loadData(); } 
    else { setMsg(`❌ Error: ${data.error.message}`); }
  }

  if (loading) return <p className="text-center mt-10">Loading dashboard...</p>;
  if (!profile) return <p className="text-center mt-10 text-bad">Could not load profile.</p>;

  return (
    <div className="space-y-6">
      {/* 1. Profile Bar */}
      <section className="card flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold">Welcome, {profile.name} 👋</h2>
          <p className="text-sm text-ink2 mt-1">{profile.skill} player · {profile.location}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm">Edit profile</button>
          <button onClick={toggleAvailability} className={`btn btn-sm ${profile.available ? 'bg-ok text-white' : 'bg-gray-200 text-gray-700'}`}>
            {profile.available ? '🟢 Available to play' : '⚪ Not available'}
          </button>
        </div>
      </section>

      {msg && <div className="p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}

      {/* 2. Search Form */}
      <section className="card">
        <h2 className="text-lg font-extrabold mb-4 flex justify-between items-end">
          <span>⚡ PLAY NOW</span>
          <span className="text-sm font-normal text-ink2">Find a game, teammates and a nearby ground</span>
        </h2>
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label">Sport</label>
            <select className="input" value={search.sport} onChange={e => setSearch({...search, sport: e.target.value})}>
              <option>Basketball</option><option>Football</option><option>Cricket</option><option>Tennis</option><option>Badminton</option>
            </select>
          </div>
          <div>
            <label className="label">Players needed</label>
            <input type="number" className="input" value={search.players} onChange={e => setSearch({...search, players: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label">Within (km)</label>
            <input type="number" className="input" value={search.radius} onChange={e => setSearch({...search, radius: Number(e.target.value)})} />
          </div>
          <button type="submit" className="btn w-full">Find my game →</button>
        </form>
      </section>

      {/* 3. Results Sections */}
      {searched ? (
        <div className="space-y-6">
          
          {/* Games Near You */}
          <section className="card">
            <h2 className="text-lg font-extrabold mb-4">🏆 Games near you</h2>
            {events.length === 0 ? <p className="text-sm text-ink2">No upcoming events.</p> : (
              <div className="space-y-3">
                {events.map(e => (
                  <div key={e.id} className="flex justify-between items-center border border-line p-4 rounded-xl flex-wrap gap-2">
                    <div>
                      <p className="font-bold">{e.name}</p>
                      <p className="text-xs text-ink2">📍 {e.loc} · 📅 {e.date}</p>
                    </div>
                    <button className="btn btn-sm">Register</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Academies Near You */}
          <section className="card">
            <h2 className="text-lg font-extrabold mb-4">🏟️ Academies near you</h2>
            {facilities.length === 0 ? <p className="text-sm text-ink2">No grounds available.</p> : (
              <div className="space-y-3">
                {facilities.map(f => (
                  <div key={f.id} className="flex justify-between items-center border border-line p-4 rounded-xl flex-wrap gap-2">
                    <div>
                      <p className="font-bold">{f.name}</p>
                      <p className="text-xs text-ink2">📍 {f.address || 'Location not provided'} · {f.sport}</p>
                      <p className="text-sm font-semibold text-brand mt-1">₹{f.price} / hour</p>
                    </div>
                    <button onClick={() => handleBook(f)} className="btn btn-sm">Book 6 PM</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Stores Near By */}
          <section className="card">
            <h2 className="text-lg font-extrabold mb-4">🏪 Stores nearby</h2>
            {products.length === 0 ? <p className="text-sm text-ink2">No products in stock.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map(p => (
                  <div key={p.id} className="border border-line p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-ink2">{p.sport} · {p.storeName}</p>
                      <p className="text-sm font-semibold text-brand mt-1">₹{p.price}</p>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className={`badge ${p.qty > 0 ? 'badge-ok' : 'badge-bad'}`}>{p.qty > 0 ? `${p.qty} in stock` : 'Out of stock'}</span>
                      <button onClick={() => handleBuy(p)} disabled={p.qty === 0} className="btn btn-sm">Buy 1</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="card text-center py-10 text-ink2">
          Choose a sport and tap <b>Find my game</b>. PlayNex will bring together nearby grounds, players, equipment and competitions.
        </div>
      )}
    </div>
  );
}
