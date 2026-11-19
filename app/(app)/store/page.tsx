'use client';
import { useState, useEffect } from 'react';

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');

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

  useEffect(() => { loadData(); }, []);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/stores/me/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sport, price: Number(price), qty: Number(qty) })
    });
    if ((await res.json()).ok) {
      setMsg('✅ Product added!');
      setName(''); setPrice(''); setQty('1');
      loadData();
    }
  }

  async function updateQty(id: string, currentQty: number, diff: number) {
    const newQty = Math.max(0, currentQty + diff);
    setProducts(products.map(p => p.id === id ? { ...p, qty: newQty } : p));
    await fetch('/api/stores/me/products', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, qty: newQty })
    });
  }

  async function updatePrice(id: string, newPrice: string) {
    const p = Number(newPrice);
    if (isNaN(p)) return;
    setProducts(products.map(x => x.id === id ? { ...x, price: p } : x));
    await fetch('/api/stores/me/products', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, price: p })
    });
  }

  async function deleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await fetch(`/api/stores/me/products?productId=${id}`, { method: 'DELETE' });
    loadData();
  }

  async function handleFulfill(orderId: string) {
    await fetch('/api/stores/me/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    loadData();
  }

  if (loading) return <p className="text-center mt-10">Loading your store...</p>;
  if (!store) return <p className="text-center mt-10 text-bad">Store profile not found.</p>;

  // Stats calculation
  const total = products.length;
  const inStock = products.filter(p => p.qty > 0).length;
  const outOfStock = products.filter(p => p.qty === 0).length;
  const lowStock = products.filter(p => p.qty > 0 && p.qty <= 2).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{store.storeName} 🏪</h1>
          <p className="text-sm text-ink2">Owner ID: {store.ownerUserId}</p>
        </div>
        <span className={`badge ${store.verificationStatus === 'approved' ? 'badge-ok' : 'badge-warn'}`}>
          {store.verificationStatus}
        </span>
      </div>

      {msg && <div className="p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center py-4"><b className="text-3xl text-brand">{total}</b><br/><span className="text-xs text-ink2 font-bold uppercase">Products</span></div>
        <div className="card text-center py-4"><b className="text-3xl text-ok">{inStock}</b><br/><span className="text-xs text-ink2 font-bold uppercase">In Stock</span></div>
        <div className="card text-center py-4"><b className="text-3xl text-bad">{outOfStock}</b><br/><span className="text-xs text-ink2 font-bold uppercase">Out of Stock</span></div>
        <div className="card text-center py-4"><b className="text-3xl text-warn">{lowStock}</b><br/><span className="text-xs text-ink2 font-bold uppercase">Low Stock</span></div>
      </div>

      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
        {/* Add Product Form */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">➕ Add Product</h2>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div><label className="label">Name</label><input required value={name} onChange={e=>setName(e.target.value)} className="input" placeholder="Basketball" /></div>
            <div>
              <label className="label">Sport</label>
              <select value={sport} onChange={e=>setSport(e.target.value)} className="input">
                <option>Basketball</option><option>Football</option><option>Cricket</option><option>Tennis</option><option>Badminton</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Price (₹)</label><input type="number" required min="1" value={price} onChange={e=>setPrice(e.target.value)} className="input" placeholder="1200" /></div>
              <div><label className="label">Qty</label><input type="number" required min="0" value={qty} onChange={e=>setQty(e.target.value)} className="input" /></div>
            </div>
            <button type="submit" className="btn w-full">Add Product</button>
          </form>
        </div>

        {/* Inventory List */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">📦 Inventory</h2>
          {products.length === 0 ? <p className="text-sm text-ink2">No products yet.</p> : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {products.map(p => (
                <div key={p.id} className="border border-line p-3 rounded-xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-ink2">{p.sport}</p>
                    </div>
                    <button onClick={() => deleteProduct(p.id)} className="text-xs text-bad hover:underline">Delete</button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(p.id, p.qty, -1)} className="w-7 h-7 rounded-full border border-line flex items-center justify-center bg-gray-50">−</button>
                      <span className="font-bold text-sm w-6 text-center">{p.qty}</span>
                      <button onClick={() => updateQty(p.id, p.qty, 1)} className="w-7 h-7 rounded-full border border-line flex items-center justify-center bg-gray-50">+</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-ink2">₹</span>
                      <input type="number" defaultValue={p.price} onBlur={(e) => updatePrice(p.id, e.target.value)} className="w-16 text-sm border border-line rounded p-1 text-right" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders List */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4 text-brand">🛍️ Customer Orders</h2>
          {orders.length === 0 ? <p className="text-sm text-ink2">No orders yet.</p> : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {orders.map(o => (
                <div key={o.id} className="border border-brand/30 bg-brand/5 p-3 rounded-xl">
                  <p className="font-bold">{o.productName}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-ink2">Qty: {o.qty} · Total: ₹{o.total}</p>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${o.status === 'shipped' ? 'badge-ok' : 'badge-warn'}`}>{o.status}</span>
                      {o.status === 'pending' && <button onClick={() => handleFulfill(o.id)} className="text-xs font-bold text-brand hover:underline">Fulfill</button>}
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
