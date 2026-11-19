'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Truck, 
  Clock, 
  ShieldCheck, 
  X,
  Search,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  
  // Product Form State
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterSport, setFilterSport] = useState('All');

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function loadData() {
    try {
      const [storeData, prodData, orderData] = await Promise.all([
        fetch('/api/stores/me').then(r => r.json()),
        fetch('/api/stores/me/products').then(r => r.json()),
        fetch('/api/stores/me/orders').then(r => r.json())
      ]);
      if (storeData.ok) setStore(storeData.data);
      if (prodData.ok) setProducts(prodData.data);
      if (orderData.ok) setOrders(orderData.data);
    } catch {
      notify('err', 'Could not load store data.');
    } finally { 
      setLoading(false); 
    }
  }

  useEffect(() => { 
    loadData(); 
  }, []);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingProduct(true);
    try {
      const res = await fetch('/api/stores/me/products', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sport, price: Number(price), qty: Number(qty) })
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Added "${name}" to your shop catalog!`);
        setName(''); 
        setPrice(''); 
        setQty('1');
        setShowAddForm(false);
        loadData();
      } else {
        notify('err', data.error?.message || 'Failed to add product.');
      }
    } catch {
      notify('err', 'Network error.');
    } finally {
      setSubmittingProduct(false);
    }
  }

  async function updateQty(id: string, currentQty: number, diff: number) {
    const newQty = Math.max(0, currentQty + diff);
    setProducts(products.map(p => p.id === id ? { ...p, qty: newQty } : p));
    await fetch('/api/stores/me/products', { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ productId: id, qty: newQty }) 
    });
  }

  async function updatePrice(id: string, newPrice: string) {
    const p = Number(newPrice); 
    if (isNaN(p) || p <= 0) return;
    setProducts(products.map(x => x.id === id ? { ...x, price: p } : x));
    await fetch('/api/stores/me/products', { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ productId: id, price: p }) 
    });
    notify('ok', 'Item price updated.');
  }

  async function deleteProduct(id: string) {
    if (!confirm('Remove this product from your inventory?')) return;
    await fetch(`/api/stores/me/products?productId=${id}`, { method: 'DELETE' });
    notify('ok', 'Item removed.');
    loadData();
  }

  async function handleFulfill(orderId: string) {
    try {
      const res = await fetch('/api/stores/me/orders', { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ orderId }) 
      });
      if ((await res.json()).ok) {
        notify('ok', 'Order marked as fulfilled & shipped!');
        loadData();
      }
    } catch {
      notify('err', 'Failed to update order status.');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Loading sports store inventory...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Store Profile Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">Please make sure your account is registered as a store partner.</p>
      </div>
    );
  }

  const total = products.length;
  const inStock = products.filter(p => p.qty > 0).length;
  const outOfStock = products.filter(p => p.qty === 0).length;
  const lowStock = products.filter(p => p.qty > 0 && p.qty <= 2).length;

  const isApproved = store.verificationStatus === 'approved';

  const filteredProducts = products.filter(p => 
    filterSport === 'All' || p.sport?.toLowerCase() === filterSport.toLowerCase()
  );

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom duration-200 ${
          notification.type === 'ok' 
            ? 'bg-emerald-900/90 text-white border-emerald-700/80' 
            : 'bg-rose-900/90 text-white border-rose-700/80'
        }`}>
          {notification.type === 'ok' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notification.text}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 rounded-lg p-1 text-white/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Store Hero Banner */}
      <div className="card bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800 p-6 sm:p-8 relative overflow-hidden">
        <div 
          aria-hidden 
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-brand-500/15 blur-3xl pointer-events-none" 
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white shadow-lg shadow-brand-500/25">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sports Merchant Hub
                </span>
                <span className={`badge text-[10px] font-black uppercase ${
                  isApproved 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isApproved ? 'Verified Partner' : 'Verification Pending'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {store.storeName}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {store.address || 'Authorized Sports Equipment & Apparel Provider'}
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-sm btn-emerald text-xs"
            >
              <Plus className="h-4 w-4" />
              Add Equipment Item
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 border-slate-200">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Catalog</span>
            <Package className="h-4 w-4 text-brand-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total items listed</p>
        </div>

        <div className="card p-5 border-slate-200">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">In Stock</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{inStock}</p>
          <p className="text-[11px] text-slate-500 mt-1">Ready to purchase</p>
        </div>

        <div className="card p-5 border-slate-200">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600">{outOfStock}</p>
          <p className="text-[11px] text-slate-500 mt-1">Needs replenishment</p>
        </div>

        <div className="card p-5 border-slate-200">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{lowStock}</p>
          <p className="text-[11px] text-slate-500 mt-1">2 or fewer units left</p>
        </div>
      </div>

      {/* EXPANDABLE ADD PRODUCT FORM */}
      {showAddForm && (
        <div className="card border-2 border-brand-500/30 bg-brand-50/20 p-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Add New Gear to Store</h2>
            </div>
            <button 
              onClick={() => setShowAddForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="label">Item Name</label>
              <input 
                required 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="input" 
                placeholder="e.g. Wilson NBA Official Basketball" 
              />
            </div>
            <div>
              <label className="label">Sport Category</label>
              <select 
                value={sport} 
                onChange={e => setSport(e.target.value)} 
                className="input"
              >
                <option>Basketball</option>
                <option>Football</option>
                <option>Cricket</option>
                <option>Tennis</option>
              </select>
            </div>
            <div>
              <label className="label">Price (₹)</label>
              <input 
                type="number" 
                required 
                min="1" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="input" 
                placeholder="e.g. 1499" 
              />
            </div>
            <div>
              <label className="label">Initial Stock Qty</label>
              <input 
                type="number" 
                required 
                min="0" 
                value={qty} 
                onChange={e => setQty(e.target.value)} 
                className="input" 
                placeholder="e.g. 10" 
              />
            </div>
            <div className="md:col-span-3 flex items-end justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submittingProduct} 
                className="btn text-xs"
              >
                {submittingProduct ? 'Saving Product...' : 'Add to Catalog'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Inventory & Orders */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Inventory Column (2 cols on LG) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Inventory Catalog ({filteredProducts.length})
              </h2>
            </div>

            {/* Quick Sport Filter */}
            <div className="flex items-center gap-1 text-xs">
              {['All', 'Basketball', 'Football', 'Cricket'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSport(s)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterSport === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="card text-center py-12">
              <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No products added yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add equipment to your pro shop to make it visible to local athletes.
              </p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="btn btn-sm btn-emerald mt-4"
              >
                <Plus className="h-4 w-4" />
                Add Your First Item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((p) => {
                const isOut = p.qty === 0;
                const isLow = p.qty > 0 && p.qty <= 2;
                return (
                  <div 
                    key={p.id} 
                    className="card p-4 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-slate-900">{p.name}</h4>
                        <span className="badge badge-brand text-[10px]">{p.sport}</span>
                        {isOut && <span className="badge badge-bad text-[10px]">Out of stock</span>}
                        {isLow && <span className="badge badge-warn text-[10px]">Low stock</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">ID: {p.id.slice(0, 8)}</p>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      {/* Qty Controls */}
                      <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 p-1">
                        <button
                          onClick={() => updateQty(p.id, p.qty, -1)}
                          className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold hover:bg-slate-100 transition"
                          title="Decrease stock"
                        >
                          −
                        </button>
                        <span className="font-extrabold text-sm w-7 text-center text-slate-900">
                          {p.qty}
                        </span>
                        <button
                          onClick={() => updateQty(p.id, p.qty, 1)}
                          className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold hover:bg-slate-100 transition"
                          title="Increase stock"
                        >
                          +
                        </button>
                      </div>

                      {/* Price editor */}
                      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs">
                        <span className="font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          defaultValue={p.price}
                          onBlur={(e) => updatePrice(p.id, e.target.value)}
                          className="w-14 font-extrabold text-right focus:outline-none"
                          title="Click to edit price"
                        />
                      </div>

                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Orders & Fulfillment Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Customer Orders ({orders.length})
              </h2>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="card text-center py-10">
              <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No incoming customer orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const isShipped = o.status === 'shipped';
                return (
                  <div 
                    key={o.id} 
                    className={`card p-4 border-slate-200 transition ${
                      isShipped ? 'bg-slate-50/70' : 'border-l-4 border-l-brand-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{o.productName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Qty: <span className="font-semibold text-slate-800">{o.qty}</span> · Total: <span className="font-extrabold text-brand-600">₹{o.total}</span>
                        </p>
                      </div>
                      <span className={`badge text-[10px] ${isShipped ? 'badge-ok' : 'badge-warn'}`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono">
                        #{o.id.slice(0, 6)}
                      </span>
                      {!isShipped && (
                        <button
                          onClick={() => handleFulfill(o.id)}
                          className="inline-flex items-center gap-1 font-bold text-brand-600 hover:text-brand-700 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Mark Shipped
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
