'use client';
import { useState, useEffect } from 'react';

export default function PlayerDashboard() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/facilities').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ]).then(([facData, prodData]) => {
      if (facData.ok) setFacilities(facData.data);
      if (prodData.ok) setProducts(prodData.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleBook(f: any) {
    setMsg('');
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: f.id, facilityName: f.name, slot: '18', price: f.price })
    });
    const data = await res.json();
    if (data.ok) setMsg(`✅ Successfully booked ${f.name} for 6:00 PM!`);
    else setMsg(`❌ Error: ${data.error.message}`);
  }

  async function handleBuy(p: any) {
    setMsg('');
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productId: p.id, productName: p.name, storeId: p.storeId, price: p.price, qty: 1 
      })
    });
    const data = await res.json();
    if (data.ok) setMsg(`✅ Order placed for ${p.name}! The store will process it.`);
    else setMsg(`❌ Error: ${data.error.message}`);
  }

  if (loading) return <p className="text-center text-ink2 mt-8">Loading...</p>;

  return (
    <div className="space-y-8">
      {msg && <div className="p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}

      {/* GROUNDS SECTION */}
      <section>
        <h1 className="text-2xl font-extrabold mb-4">⚡ Book a Ground</h1>
        <div className="grid gap-4">
          {facilities.map(f => (
            <div key={f.id} className="card flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-extrabold">{f.name}</h2>
                <p className="text-sm text-ink2">{f.sport} · {f.amenities}</p>
                <p className="text-sm font-semibold text-brand mt-1">₹{f.price} / hour</p>
              </div>
              <button onClick={() => handleBook(f)} className="btn">Book Now</button>
            </div>
          ))}
        </div>
      </section>

      {/* GEAR SECTION */}
      <section>
        <h1 className="text-2xl font-extrabold mb-4">🛒 Gear Shop</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="card flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-extrabold">{p.name}</h2>
                <p className="text-sm text-ink2">{p.sport} · {p.storeName}</p>
                <p className="text-sm font-semibold text-brand mt-1">₹{p.price}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`badge ${p.qty > 0 ? 'badge-ok' : 'badge-bad'}`}>
                  {p.qty > 0 ? `${p.qty} in stock` : 'Out of stock'}
                </span>
                <button 
                  onClick={() => handleBuy(p)} 
                  disabled={p.qty === 0} 
                  className="btn btn-sm"
                >
                  Buy 1
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
