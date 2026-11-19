'use client';
import { useState, useEffect } from 'react';

function StarRating({ rating, count }: { rating: number, count: number }) {
  if (!count) return <span className="text-xs text-ink2">No ratings</span>;
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-yellow-500 text-lg leading-none">★</span>
      <span className="font-bold">{rating}</span>
      <span className="text-xs text-ink2">({count})</span>
    </div>
  );
}

export default function PlayerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [search, setSearch] = useState({ sport: 'All' });
  const [ratingModal, setRatingModal] = useState<{ id: string, type: 'facility' | 'product', name: string } | null>(null);

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

  useEffect(() => { loadData(); }, []);

  async function toggleAvailability() {
    if (!profile) return;
    const newState = !profile.available;
    setProfile({ ...profile, available: newState });
    await fetch('/api/player/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: newState }) });
    setMsg(newState ? 'You are visible to nearby players' : 'You are no longer listed as available');
  }

  async function handleBook(f: any) {
    setMsg('');
    const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facilityId: f.id, facilityName: f.name, slot: '18', price: f.price }) });
    if ((await res.json()).ok) { setMsg(`✅ Booked ${f.name}!`); loadData(); } else { setMsg(`❌ Error booking.`); }
  }

  async function handleBuy(p: any) {
    setMsg('');
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, productName: p.name, storeId: p.storeId, price: p.price, qty: 1 }) });
    if ((await res.json()).ok) { setMsg(`✅ Order placed for ${p.name}!`); loadData(); } else { setMsg(`❌ Error ordering.`); }
  }

  async function handleRegisterEvent(e: any) {
    setMsg('');
    const res = await fetch('/api/events/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: e.id })
    });
    const data = await res.json();
    if (data.ok) setMsg(`✅ Successfully registered for ${e.name}!`);
    else setMsg(`❌ ${data.error.message}`);
  }

  async function submitRating(score: number) {
    if (!ratingModal) return;
    setMsg('');
    const res = await fetch('/api/ratings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: ratingModal.id, targetType: ratingModal.type, rating: score })
    });
    if ((await res.json()).ok) {
      setMsg(`✅ Thanks for rating ${ratingModal.name} ${score} stars!`);
      setRatingModal(null); loadData();
    }
  }

  if (loading) return <p className="text-center mt-10">Loading dashboard...</p>;
  if (!profile) return <p className="text-center mt-10 text-bad">Could not load profile.</p>;

  const filteredFacilities = facilities.filter(f => search.sport === 'All' || f.sport === search.sport);
  const filteredProducts = products.filter(p => search.sport === 'All' || p.sport === search.sport);
  const filteredEvents = events.filter(e => search.sport === 'All' || e.sport === search.sport);

  return (
    <div className="space-y-8 relative">
      
      {ratingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card text-center max-w-sm w-full">
            <h3 className="font-extrabold text-xl mb-2">Rate {ratingModal.name}</h3>
            <p className="text-sm text-ink2 mb-6">How was your experience?</p>
            <div className="flex justify-center gap-2 mb-6">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => submitRating(star)} className="text-4xl text-gray-300 hover:text-yellow-400 transition">★</button>
              ))}
            </div>
            <button onClick={() => setRatingModal(null)} className="btn btn-ghost w-full">Cancel</button>
          </div>
        </div>
      )}

      <section className="card flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold">Welcome, {profile.name} 👋</h2>
          <p className="text-sm text-ink2 mt-1">{profile.skill} player · {profile.location}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleAvailability} className={`btn btn-sm ${profile.available ? 'bg-ok text-white' : 'bg-gray-200 text-gray-700'}`}>
            {profile.available ? '🟢 Available to play' : '⚪ Not available'}
          </button>
        </div>
      </section>

      {msg && <div className="p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}

      <section className="card">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-ink2">Filter by Sport:</span>
            <select className="input py-1.5 min-w-[150px]" value={search.sport} onChange={e => setSearch({...search, sport: e.target.value})}>
              <option value="All">All Sports</option>
              <option>Basketball</option><option>Football</option><option>Cricket</option><option>Tennis</option>
            </select>
          </div>
        </div>
      </section>

      {filteredEvents.length > 0 && (
        <section>
          <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">🏆 Tournaments near you</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map(e => (
              <div key={e.id} className="card flex flex-col justify-between border-l-4 border-brand">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{e.name}</h3>
                    <p className="text-xs text-ink2 mt-1">📍 {e.loc || 'Location TBA'} · {e.sport}</p>
                    <p className="text-xs font-semibold text-brand mt-2">📅 {new Date(e.date).toDateString()}</p>
                  </div>
                  <span className="badge badge-warn">Entry: ₹{e.price}</span>
                </div>
                <button onClick={() => handleRegisterEvent(e)} className="btn btn-sm mt-4 w-full">Register Now</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">🏟️ Academies & Grounds near you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map(f => (
            <div key={f.id} className="card p-0 overflow-hidden flex flex-col hover:shadow-lg transition relative">
              {f.image ? <img src={f.image} alt={f.name} className="w-full h-48 object-cover" /> : <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-4xl">🏟️</div>}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{f.name}</h3>
                    <StarRating rating={f.rating || 0} count={f.ratingCount || 0} />
                  </div>
                  <p className="text-xs text-ink2 mt-1">📍 {f.address || 'Location not provided'}</p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="badge badge-ok">{f.sport}</span>
                    <span className="font-bold text-brand">₹{f.price}/hr</span>
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button onClick={() => handleBook(f)} className="btn flex-1">Book</button>
                  <button onClick={() => setRatingModal({ id: f.id, type: 'facility', name: f.name })} className="btn btn-ghost flex-1">Rate</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">🏪 Gear & Stores nearby</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(p => (
            <div key={p.id} className="card p-0 overflow-hidden flex flex-col hover:shadow-lg transition relative">
              {p.image ? <img src={p.image} alt={p.name} className="w-full h-32 object-cover" /> : <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-4xl">🎒</div>}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <h3 className="font-bold text-sm leading-tight">{p.name}</h3>
                    <StarRating rating={p.rating || 0} count={p.ratingCount || 0} />
                  </div>
                  <p className="text-[11px] text-ink2 mt-1">{p.storeName}</p>
                  <p className="font-bold text-brand mt-2">₹{p.price}</p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button onClick={() => handleBuy(p)} disabled={p.qty === 0} className="btn btn-sm w-full">{p.qty === 0 ? 'Out of stock' : 'Buy Now'}</button>
                  <button onClick={() => setRatingModal({ id: p.id, type: 'product', name: p.name })} className="text-xs font-bold text-brand hover:underline">Rate this item</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
