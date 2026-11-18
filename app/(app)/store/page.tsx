'use client';
import { useState, useEffect } from 'react';

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    Promise.all([
      fetch('/api/stores/me').then(r => r.json()),
      fetch('/api/stores/me/products').then(r => r.json()),
      fetch('/api/stores/me/orders').then(r => r.json())
    ]).then(([storeData, prodData, orderData]) => {
      if (storeData.ok) setStore(storeData.data);
      if (prodData.ok) setProducts(prodData.data);
      if (orderData.ok) setOrders(orderData.data);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/stores/me/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sport, price: Number(price), qty: Number(qty) })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('✅ Product added successfully!');
        setName(''); setPrice(''); setQty('1');
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

  async function handleFulfill(orderId: string) {
    setMsg('');
    try {
      const res = await fetch('/api/stores/me/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('✅ Order marked as shipped!');
        loadData();
      } else {
        setMsg(`❌ Error: ${data.error.message}`);
      }
    } catch (err) {
      setMsg('❌ Network error');
    }
  }

  if (loading) return <p className="text-center mt-10">Loading your store...</p>;
  if (!store) return <p className="text-center mt-10 text-bad">Store profile not found. Did you register as a Store?</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{store.storeName} 🏪</h1>
            <p className="text-sm text-ink2">Owner ID: {store.ownerUserId}</p>
          </div>
          <div>
            {store.verificationStatus === 'approved' ? (
              <span className="badge badge-ok">Verified</span>
            ) : (
              <span className="badge badge-warn">Pending Verification</span>
            )}
          </div>
        </div>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand text-sm font-semibold">{msg}</div>}
      </div>

      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
        {/* Add Product Form */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">➕ Add Product</h2>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input required value={name} onChange={e=>setName(e.target.value)} className="input" placeholder="Basketball" />
            </div>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Price (₹)</label>
                <input type="number" required min="1" value={price} onChange={e=>setPrice(e.target.value)} className="input" placeholder="1200" />
              </div>
              <div>
                <label className="label">Qty</label>
                <input type="number" required min="0" value={qty} onChange={e=>setQty(e.target.value)} className="input" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn w-full">
              {submitting ? 'Saving...' : 'Add Product'}
            </button>
          </form>
        </div>

        {/* Inventory List */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">📦 Inventory ({products.length})</h2>
          {products.length === 0 ? (
            <p className="text-sm text-ink2">No products yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {products.map(p => (
                <div key={p.id} className="border border-line p-3 rounded-xl">
                  <p className="font-bold">{p.name}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-ink2">₹{p.price}</p>
                    <span className={`badge ${p.qty > 0 ? 'badge-ok' : 'badge-bad'}`}>{p.qty} in stock</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders List */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4 text-brand">🛍️ Customer Orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-ink2">No orders yet. Ask a Player to buy something!</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {orders.map(o => (
                <div key={o.id} className="border border-brand/30 bg-brand/5 p-3 rounded-xl">
                  <p className="font-bold">{o.productName}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-ink2">Qty: {o.qty} · Total: ₹{o.total}</p>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${o.status === 'shipped' ? 'badge-ok' : 'badge-warn'}`}>
                        {o.status}
                      </span>
                      {o.status === 'pending' && (
                        <button 
                          onClick={() => handleFulfill(o.id)} 
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          Fulfill
                        </button>
                      )}
                    </div>
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
