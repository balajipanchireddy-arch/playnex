'use client';

import { useState, useEffect } from 'react';
import Toast from '@/components/ui/Toast';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import {
  Store,
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  Truck,
  X,
  Check,
  Calendar,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export default function StoreDashboard() {
  const [store, setStore] = useState<any>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [needsRegistration, setNeedsRegistration] = useState(false);

  // Store registration form state
  const [regStoreName, setRegStoreName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regContact, setRegContact] = useState('');
  const [regDescription, setRegDescription] = useState('');
  const [registeringStore, setRegisteringStore] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Product Form State (Purchase + Rental)
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Basketball');
  const [category, setCategory] = useState('Equipment');
  const [description, setDescription] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('5');
  const [allowPurchase, setAllowPurchase] = useState(true);
  const [allowRental, setAllowRental] = useState(false);
  const [rentalPricePerDay, setRentalPricePerDay] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('0');
  const [rentalQty, setRentalQty] = useState('2');
  const [requiresIdProof, setRequiresIdProof] = useState(false);
  const [targetStoreId, setTargetStoreId] = useState('');
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterSport, setFilterSport] = useState('All');

  // Delete confirmation modal
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  function notify(type: 'ok' | 'err', text: string) {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function handleResubmitApproval() {
    try {
      const res = await fetch('/api/partners/resubmit', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        notify('ok', 'Application resubmitted. Waiting for Admin review.');
        await loadData();
      } else {
        notify('err', data.error?.message || 'Could not resubmit application.');
      }
    } catch {
      notify('err', 'Network error while resubmitting application.');
    }
  }

  async function loadData(storeFilter = selectedStoreId) {
    try {
      const storeQuery =
        storeFilter && storeFilter !== 'all' ? `?storeId=${encodeURIComponent(storeFilter)}` : '';
      const rentalScopeQuery =
        storeFilter && storeFilter !== 'all'
          ? `?scope=store&storeId=${encodeURIComponent(storeFilter)}`
          : '?scope=store';

      const [storeData, prodData, orderData, rentalData, gamesData] = await Promise.all([
        fetch('/api/stores/me').then((r) => r.json()),
        fetch(`/api/stores/me/products${storeQuery}`).then((r) => r.json()),
        fetch(`/api/stores/me/orders${storeQuery}`).then((r) => r.json()),
        fetch(`/api/rentals${rentalScopeQuery}`).then((r) => r.json()).catch(() => ({ ok: false })),
        fetch('/api/games').then((r) => r.json()),
      ]);

      if (storeData.ok && storeData.data) {
        if (storeData.data.isAdmin) {
          setIsAdminView(true);
          setStore(null);
          setNeedsRegistration(false);
          const storesList = storeData.data.stores || [];
          setAllStores(storesList);
          if (!targetStoreId && storesList.length > 0) {
            setTargetStoreId(storesList[0].id);
          }
        } else if (storeData.data.needsRegistration) {
          setIsAdminView(false);
          setStore(null);
          setNeedsRegistration(true);
        } else {
          setIsAdminView(false);
          setNeedsRegistration(false);
          setStore(storeData.data);
        }
      }
      if (prodData.ok) setProducts(prodData.data || []);
      if (orderData.ok) setOrders(orderData.data || []);
      if (rentalData.ok) setRentals(rentalData.data || []);
      if (gamesData.ok) setGames(gamesData.data || []);
    } catch {
      notify('err', 'Could not load store data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRegisterStore(e: React.FormEvent) {
    e.preventDefault();
    setRegisteringStore(true);
    try {
      const res = await fetch('/api/stores/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: regStoreName,
          address: regAddress,
          contact: regContact,
          description: regDescription,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Store "${regStoreName}" registered successfully!`);
        setRegStoreName('');
        setRegAddress('');
        setRegContact('');
        setRegDescription('');
        setShowRegisterModal(false);
        await loadData();
      } else {
        notify('err', data.error?.message || 'Failed to register store.');
      }
    } catch {
      notify('err', 'Network error registering store.');
    } finally {
      setRegisteringStore(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!allowPurchase && !allowRental) {
      notify('err', 'Enable Purchase, Rental, or both.');
      return;
    }
    setSubmittingProduct(true);
    try {
      const res = await fetch('/api/stores/me/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sport,
          category: category.trim(),
          description: description.trim(),
          price: Number(price || 0),
          qty: Number(qty || 0),
          allowPurchase,
          allowRental,
          rentalPricePerDay: allowRental ? Number(rentalPricePerDay || 0) : 0,
          securityDeposit: allowRental ? Number(securityDeposit || 0) : 0,
          rentalQty: allowRental ? Number(rentalQty || qty || 0) : 0,
          requiresIdProof: allowRental ? requiresIdProof : false,
          image: productImageUrl.trim(),
          ...(isAdminView && targetStoreId ? { storeId: targetStoreId } : {}),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        notify('ok', `Added "${name}" to your shop catalog!`);
        setName('');
        setPrice('');
        setQty('5');
        setDescription('');
        setProductImageUrl('');
        setRentalPricePerDay('');
        setSecurityDeposit('0');
        setRequiresIdProof(false);
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
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, qty: newQty } : p)));
    await fetch('/api/stores/me/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, qty: newQty }),
    });
  }

  async function updatePrice(id: string, newPrice: string) {
    const p = Number(newPrice);
    if (isNaN(p) || p <= 0) return;
    setProducts((prev) => prev.map((x) => (x.id === id ? { ...x, price: p } : x)));
    await fetch('/api/stores/me/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, price: p }),
    });
    notify('ok', 'Item price updated.');
  }

  async function handleConfirmDeleteProduct() {
    if (!productToDelete) return;
    setDeletingProduct(true);
    try {
      const res = await fetch(
        `/api/stores/me/products?productId=${encodeURIComponent(productToDelete.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.ok) {
        notify(
          'ok',
          `Product "${productToDelete.name}" deleted. ${data.data?.ordersPreserved || 0} historical order(s) preserved.`
        );
        setProductToDelete(null);
        await loadData();
      } else {
        notify('err', data.error?.message || 'Could not delete product.');
      }
    } catch {
      notify('err', 'Network error deleting product.');
    } finally {
      setDeletingProduct(false);
    }
  }

  async function handleOrderStatus(orderId: string, status: 'confirmed' | 'shipped' | 'delivered') {
    try {
      const res = await fetch('/api/stores/me/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Order marked as ${status}!`);
        loadData();
      } else {
        notify('err', json.error?.message || 'Failed to update order status.');
      }
    } catch {
      notify('err', 'Failed to update order status.');
    }
  }

  async function handleRentalStatus(
    rentalId: string,
    status: 'active' | 'returned' | 'overdue' | 'cancelled'
  ) {
    try {
      const res = await fetch('/api/rentals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId, status }),
      });
      const json = await res.json();
      if (json.ok) {
        notify('ok', `Rental updated to ${status}.`);
        loadData();
      } else {
        notify('err', json.error?.message || 'Failed to update rental.');
      }
    } catch {
      notify('err', 'Network error updating rental.');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#16A36A] border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-[#667085]">Loading sports store inventory...</p>
      </div>
    );
  }

  if (!isAdminView && (needsRegistration || !store)) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Toast message={notification} onClose={() => setNotification(null)} />
        <div className="card p-6 sm:p-8 border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#16A36A] shrink-0">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#172033]">Register Your Sports Store</h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Set up your PlayNex store profile to sell or rent sports equipment and fulfill orders.
              </p>
            </div>
          </div>

          <form onSubmit={handleRegisterStore} className="space-y-4">
            <div>
              <label className="label">Store Name *</label>
              <input
                required
                value={regStoreName}
                onChange={(e) => setRegStoreName(e.target.value)}
                className="input"
                placeholder="e.g. Apex Sports Gear"
              />
            </div>
            <div>
              <label className="label">Store Address / City *</label>
              <input
                required
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                className="input"
                placeholder="e.g. 42 Stadium Road, Visakhapatnam"
              />
            </div>
            <div>
              <label className="label">Contact Phone *</label>
              <input
                required
                value={regContact}
                onChange={(e) => setRegContact(e.target.value)}
                className="input"
                placeholder="e.g. +91 98765 43210"
              />
            </div>
            <div>
              <label className="label">Store Description (Optional)</label>
              <textarea
                rows={3}
                value={regDescription}
                onChange={(e) => setRegDescription(e.target.value)}
                className="input"
                placeholder="Tell players what gear, apparel, and rentals you carry..."
              />
            </div>
            <button type="submit" disabled={registeringStore} className="btn w-full">
              {registeringStore ? 'Creating Store Profile...' : 'Register Store'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const total = products.length;
  const inStock = products.filter((p) => p.qty > 0 || (p.allowRental && p.rentalQty > 0)).length;
  const outOfStock = products.filter((p) => p.qty === 0).length;
  const activeRentalsCount = rentals.filter((r) => ['pending', 'active', 'overdue'].includes(r.status)).length;
  const isApproved = isAdminView || store?.verificationStatus === 'approved';

  const filteredProducts = products.filter(
    (p) => filterSport === 'All' || p.sport?.toLowerCase() === filterSport.toLowerCase()
  );

  return (
    <div className="space-y-8 relative">
      <Toast message={notification} onClose={() => setNotification(null)} />

      {/* Store Hero Banner */}
      <div className="card bg-white text-[#172033] border-[#E5E7EB] p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#16A36A] overflow-hidden shrink-0">
              <img src="/icons/store.png" alt="Store" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  {isAdminView ? 'Platform Store Administration' : 'Sports Merchant Hub'}
                </span>
                <span
                  className={`badge text-[10px] font-bold uppercase ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isAdminView
                    ? 'Admin Full Access'
                    : isApproved
                    ? 'Verified Partner'
                    : store?.verificationStatus === 'rejected'
                    ? 'Verification Rejected'
                    : 'Verification Pending'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172033]">
                {isAdminView ? 'Admin Store Dashboard' : store?.storeName}
              </h1>
              <p className="text-xs text-[#667085] mt-0.5">
                {isAdminView
                  ? `Managing ${allStores.length} store(s), ${products.length} product(s), ${orders.length} order(s), and ${rentals.length} rental(s).`
                  : store?.address || 'Authorized Sports Equipment Purchase & Rental Provider'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminView && (
              <button
                onClick={() => setShowRegisterModal(!showRegisterModal)}
                className="btn-secondary btn-sm text-xs"
              >
                <Store className="h-4 w-4" />
                Create Store
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-sm btn-emerald text-xs"
            >
              <Plus className="h-4 w-4" />
              Add Gear Item
            </button>
          </div>
        </div>
      </div>

      {/* Admin: Create Store Modal/Panel */}
      {isAdminView && showRegisterModal && (
        <div className="card border-2 border-[#16A36A]/30 bg-[#E8F5EE]/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#172033]">Register New Platform Store</h2>
            <button onClick={() => setShowRegisterModal(false)} className="text-[#667085] hover:text-[#172033]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleRegisterStore} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Store Name *</label>
              <input required value={regStoreName} onChange={(e) => setRegStoreName(e.target.value)} className="input" placeholder="Store name" />
            </div>
            <div>
              <label className="label">Address *</label>
              <input required value={regAddress} onChange={(e) => setRegAddress(e.target.value)} className="input" placeholder="City / Address" />
            </div>
            <div>
              <label className="label">Contact *</label>
              <input required value={regContact} onChange={(e) => setRegContact(e.target.value)} className="input" placeholder="+91 ..." />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowRegisterModal(false)} className="btn-secondary btn-sm text-xs">Cancel</button>
              <button type="submit" disabled={registeringStore} className="btn btn-sm text-xs">
                {registeringStore ? 'Creating...' : 'Create Store'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin: Registered Stores Directory */}
      {isAdminView && (
        <div className="card p-6 border-[#E5E7EB]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-[#172033]">
                Registered Stores ({allStores.length})
              </h2>
              <p className="text-xs text-[#667085]">
                Select a store to filter its products, orders, and rentals.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStoreId('all');
                loadData('all');
              }}
              className={`btn-sm text-xs rounded-xl border font-semibold px-3 py-1.5 ${
                selectedStoreId === 'all'
                  ? 'bg-[#101828] text-white border-[#101828]'
                  : 'bg-white text-[#172033] border-[#E5E7EB]'
              }`}
            >
              All Stores
            </button>
          </div>

          {allStores.length === 0 ? (
            <p className="text-xs text-[#667085] py-4">No stores registered yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allStores.map((s) => {
                const isSelected = selectedStoreId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStoreId(s.id);
                      setTargetStoreId(s.id);
                      loadData(s.id);
                    }}
                    className={`text-left rounded-xl border p-4 transition ${
                      isSelected
                        ? 'border-[#16A36A] bg-[#E8F5EE]/40 shadow-xs'
                        : 'border-[#E5E7EB] bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#172033] truncate">{s.storeName || 'Unnamed Store'}</h3>
                      <span
                        className={`badge text-[10px] uppercase ${
                          s.verificationStatus === 'approved'
                            ? 'badge-ok'
                            : s.verificationStatus === 'rejected'
                            ? 'badge-bad'
                            : 'badge-warn'
                        }`}
                      >
                        {s.verificationStatus || 'pending'}
                      </span>
                    </div>
                    <p className="text-xs text-[#667085] mt-1 truncate">{s.address || 'No address'}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isAdminView && store && store.verificationStatus !== 'approved' && (
        <div
          className={`rounded-2xl p-4 text-xs ${
            store.verificationStatus === 'rejected'
              ? 'border border-rose-200 bg-rose-50 text-rose-900'
              : 'border border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-bold">
            {store.verificationStatus === 'rejected'
              ? 'Store Verification Rejected'
              : 'Store Verification Pending'}
          </p>
          <p className="mt-1">
            {store.verificationStatus === 'rejected'
              ? 'Your application was rejected. You can request another review by resubmitting it.'
              : 'Your store is awaiting administrator verification. Product creation and editing remain restricted until approval.'}
          </p>
          {store.verificationStatus === 'rejected' && (
            <button type="button" onClick={handleResubmitApproval} className="btn btn-sm btn-emerald mt-3">
              Request Approval Again
            </button>
          )}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 border-[#E5E7EB]">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Catalog</span>
            <Package className="h-4 w-4 text-[#16A36A]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#172033]">{total}</p>
          <p className="text-[11px] text-[#667085] mt-1">Total items listed</p>
        </div>

        <div className="card p-5 border-[#E5E7EB]">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{inStock}</p>
          <p className="text-[11px] text-[#667085] mt-1">Purchase or rental ready</p>
        </div>

        <div className="card p-5 border-[#E5E7EB]">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Rentals</span>
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{activeRentalsCount}</p>
          <p className="text-[11px] text-[#667085] mt-1">Pending / checked out</p>
        </div>

        <div className="card p-5 border-[#E5E7EB]">
          <div className="flex items-center justify-between text-[#667085] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Out of Stock</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600">{outOfStock}</p>
          <p className="text-[11px] text-[#667085] mt-1">Purchase stock depleted</p>
        </div>
      </div>

      {/* EXPANDABLE ADD PRODUCT FORM */}
      {showAddForm && (
        <div className="card border-2 border-[#16A36A]/30 bg-[#E8F5EE]/20 p-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#C5E9D7] text-[#0E7055] flex items-center justify-center font-bold">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-[#172033]">Add Gear (Purchase &amp; Rental)</h2>
            </div>
            <button onClick={() => setShowAddForm(false)} className="rounded-lg p-1 text-[#667085] hover:text-[#172033]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {isAdminView && allStores.length > 0 && (
              <div className="md:col-span-4">
                <label className="label">Target Store *</label>
                <select value={targetStoreId} onChange={(e) => setTargetStoreId(e.target.value)} className="input">
                  {allStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName} ({s.verificationStatus || 'pending'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="label">Item Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Yonex Astrox Pro Badminton Racket"
              />
            </div>

            <div>
              <label className="label">Sport *</label>
              <select value={sport} onChange={(e) => setSport(e.target.value)} className="input">
                {games.length > 0 ? (
                  games.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))
                ) : (
                  <>
                    <option>Badminton</option>
                    <option>Football</option>
                    <option>Cricket</option>
                    <option>Basketball</option>
                    <option>Tennis</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                <option>Equipment</option>
                <option>Apparel</option>
                <option>Footwear</option>
                <option>Accessories</option>
                <option>Kit Bag</option>
                <option>Other</option>
              </select>
            </div>

            {/* Purchase & Rental Mode Toggles */}
            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#172033] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPurchase}
                    onChange={(e) => setAllowPurchase(e.target.checked)}
                    className="rounded text-[#16A36A] h-4 w-4"
                  />
                  Enable Purchase (Buy Now)
                </label>
                {allowPurchase && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Sale Price (₹) *</label>
                      <input
                        type="number"
                        required={allowPurchase}
                        min="1"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="input"
                        placeholder="1499"
                      />
                    </div>
                    <div>
                      <label className="label">Sale Stock Qty *</label>
                      <input
                        type="number"
                        required={allowPurchase}
                        min="0"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="input"
                        placeholder="10"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#172033] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRental}
                    onChange={(e) => setAllowRental(e.target.checked)}
                    className="rounded text-[#16A36A] h-4 w-4"
                  />
                  Enable Gear Rental (Daily Rate &amp; Security Deposit)
                </label>
                {allowRental && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label">Rate / Day (₹) *</label>
                        <input
                          type="number"
                          required={allowRental}
                          min="1"
                          value={rentalPricePerDay}
                          onChange={(e) => setRentalPricePerDay(e.target.value)}
                          className="input"
                          placeholder="150"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={securityDeposit}
                          onChange={(e) => setSecurityDeposit(e.target.value)}
                          className="input"
                          placeholder="500"
                        />
                      </div>
                      <div>
                        <label className="label">Rental Units *</label>
                        <input
                          type="number"
                          required={allowRental}
                          min="1"
                          value={rentalQty}
                          onChange={(e) => setRentalQty(e.target.value)}
                          className="input"
                          placeholder="3"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-[#667085] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiresIdProof}
                        onChange={(e) => setRequiresIdProof(e.target.checked)}
                        className="rounded text-[#16A36A] h-3.5 w-3.5"
                      />
                      Require private ID proof from renter (stored in secure vault)
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">Product Description (Optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input text-xs"
                placeholder="Specifications, size guide, rental condition..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Product Image URL (Optional)</label>
              <input
                type="url"
                value={productImageUrl}
                onChange={(e) => setProductImageUrl(e.target.value)}
                className="input text-xs"
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <div className="md:col-span-4 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary text-xs w-full sm:w-auto">
                Cancel
              </button>
              <button type="submit" disabled={submittingProduct} className="btn text-xs w-full sm:w-auto">
                {submittingProduct ? 'Saving Product...' : 'Add to Catalog'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Inventory & Orders + Rentals */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Inventory Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center overflow-hidden">
                <img src="/icons/gear.jpg" alt="Gear" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-lg font-extrabold text-[#172033]">
                Inventory Catalog ({filteredProducts.length})
              </h2>
            </div>

            <div className="flex items-center gap-1 text-xs">
              {['All', 'Basketball', 'Football', 'Cricket', 'Badminton'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSport(s)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterSport === s
                      ? 'bg-[#101828] text-white shadow-xs'
                      : 'text-[#667085] hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="card text-center py-12">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[#172033]">No products added yet</h3>
              <p className="text-xs text-[#667085] mt-1 max-w-sm mx-auto">
                Add equipment for purchase or rental to make it visible to athletes.
              </p>
              <button onClick={() => setShowAddForm(true)} className="btn btn-sm btn-emerald mt-4">
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
                    className="card p-4 border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-14 w-14 rounded-xl object-cover border border-[#E5E7EB] shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-[#172033]">{p.name}</h4>
                          <span className="badge badge-brand text-[10px]">{p.sport}</span>
                          {p.allowPurchase !== false && (
                            <span className="badge badge-navy text-[10px]">Buy ₹{p.price}</span>
                          )}
                          {p.allowRental && (
                            <span className="badge bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                              Rent ₹{p.rentalPricePerDay}/day · Deposit ₹{p.securityDeposit || 0}
                            </span>
                          )}
                          {isOut && p.allowPurchase !== false && (
                            <span className="badge badge-bad text-[10px]">Out of stock</span>
                          )}
                          {isLow && <span className="badge badge-warn text-[10px]">Low stock</span>}
                        </div>
                        {p.description && (
                          <p className="text-xs text-[#667085] mt-1 line-clamp-1">{p.description}</p>
                        )}
                        <p className="text-[11px] text-[#98A2B3] mt-0.5">
                          ID: {p.id.slice(0, 8)} {p.allowRental ? `· Rental units: ${p.rentalQty ?? p.qty}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] p-1">
                        <button
                          onClick={() => updateQty(p.id, p.qty, -1)}
                          className="h-7 w-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#172033] font-bold hover:bg-slate-100 transition"
                          title="Decrease stock"
                        >
                          −
                        </button>
                        <span className="font-extrabold text-sm w-7 text-center text-[#172033]">
                          {p.qty}
                        </span>
                        <button
                          onClick={() => updateQty(p.id, p.qty, 1)}
                          className="h-7 w-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#172033] font-bold hover:bg-slate-100 transition"
                          title="Increase stock"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs">
                        <span className="font-bold text-[#667085]">₹</span>
                        <input
                          type="number"
                          defaultValue={p.price}
                          onBlur={(e) => updatePrice(p.id, e.target.value)}
                          className="w-14 font-extrabold text-right focus:outline-none"
                          title="Click to edit price"
                        />
                      </div>

                      <button
                        onClick={() => setProductToDelete(p)}
                        className="text-[#667085] hover:text-rose-600 transition p-1"
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

        {/* Orders & Rentals Column */}
        <div className="space-y-6">
          {/* Purchase Orders */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-extrabold text-[#172033]">
                Purchase Orders ({orders.length})
              </h2>
            </div>

            {orders.length === 0 ? (
              <div className="card text-center py-8">
                <Truck className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-[#667085]">No purchase orders yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className={`card p-4 border-[#E5E7EB] transition ${
                      o.status === 'delivered' || o.status === 'shipped'
                        ? 'bg-slate-50/70'
                        : 'border-l-4 border-l-[#16A36A]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#172033]">{o.productName}</h4>
                        <p className="text-xs text-[#667085] mt-0.5">
                          Qty: <span className="font-semibold text-[#172033]">{o.qty}</span> · Total:{' '}
                          <span className="font-extrabold text-[#16A36A]">₹{o.total}</span>
                        </p>
                        <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          Payment: {o.paymentStatus || 'unpaid'}
                        </p>
                      </div>
                      <span
                        className={`badge text-[10px] uppercase ${
                          o.status === 'delivered' || o.status === 'shipped'
                            ? 'badge-ok'
                            : 'badge-warn'
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2 flex-wrap">
                      <span className="text-[11px] text-[#98A2B3] font-mono">#{o.id.slice(0, 6)}</span>
                      <div className="flex items-center gap-2">
                        {o.status === 'pending' && (
                          <button
                            onClick={() => handleOrderStatus(o.id, 'confirmed')}
                            className="font-bold text-[#101828] hover:underline"
                          >
                            Confirm
                          </button>
                        )}
                        {(o.status === 'pending' || o.status === 'confirmed') && (
                          <button
                            onClick={() => handleOrderStatus(o.id, 'shipped')}
                            className="inline-flex items-center gap-1 font-bold text-[#16A36A] hover:text-[#0E7055]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Ship
                          </button>
                        )}
                        {o.status === 'shipped' && (
                          <button
                            onClick={() => handleOrderStatus(o.id, 'delivered')}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gear Rentals Management */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-extrabold text-[#172033]">
                Gear Rentals ({rentals.length})
              </h2>
            </div>

            {rentals.length === 0 ? (
              <div className="card text-center py-8">
                <Calendar className="h-7 w-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-[#667085]">No gear rentals yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rentals.map((r) => (
                  <div key={r.id} className="card p-4 border-[#E5E7EB] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#172033]">{r.productName}</h4>
                        <p className="text-[11px] text-[#667085]">
                          {r.startDate} → {r.returnDate} ({r.durationDays}d · Qty {r.qty})
                        </p>
                        <p className="text-[11px] text-[#172033] font-semibold mt-0.5">
                          Rental ₹{r.rentalSubtotal} + Deposit ₹{r.securityDeposit || 0} ({r.depositStatus})
                        </p>
                        <p className="text-[10px] text-amber-700 font-semibold">
                          Payment: {r.paymentStatus || 'unpaid'}
                        </p>
                      </div>
                      <span
                        className={`badge text-[10px] uppercase ${
                          r.status === 'returned'
                            ? 'badge-ok'
                            : r.status === 'overdue' || r.status === 'cancelled'
                            ? 'badge-bad'
                            : 'badge-warn'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    {r.privateDocUrl && (
                      <a
                        href={r.privateDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A36A] hover:underline"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        View Private ID Proof <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px]">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleRentalStatus(r.id, 'active')}
                            className="btn btn-sm text-[11px] py-1 px-2.5"
                          >
                            Mark Active (Picked Up)
                          </button>
                          <button
                            onClick={() => handleRentalStatus(r.id, 'cancelled')}
                            className="btn-secondary btn-sm text-[11px] py-1 px-2"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {(r.status === 'active' || r.status === 'overdue') && (
                        <>
                          <button
                            onClick={() => handleRentalStatus(r.id, 'returned')}
                            className="btn btn-sm text-[11px] py-1 px-2.5"
                          >
                            Mark Returned &amp; Release Deposit
                          </button>
                          {r.status === 'active' && (
                            <button
                              onClick={() => handleRentalStatus(r.id, 'overdue')}
                              className="btn-danger btn-sm text-[11px] py-1 px-2"
                            >
                              Mark Overdue
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDeleteProduct}
        title="Delete Product"
        recordName={productToDelete?.name || ''}
        recordType="Product"
        warningText="Deletes this item from catalog and removes associated ratings/images. Historical financial orders are preserved; deletion is blocked if active rentals exist."
        loading={deletingProduct}
      />
    </div>
  );
}
