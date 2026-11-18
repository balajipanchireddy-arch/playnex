'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function fetchPending() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verifications');
      const data = await res.json();
      if (data.ok) {
        setStores(data.data);
      } else {
        setMsg(`❌ Error: ${data.error.message}`);
      }
    } catch (err) {
      setMsg('❌ Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPending();
  }, []);

  async function handleReview(storeId: string, status: 'approved' | 'rejected') {
    setMsg('');
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, status })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ Store ${status} successfully!`);
        // Remove from local list
        setStores(stores.filter(s => s.id !== storeId));
      } else {
        setMsg(`❌ Error: ${data.error.message}`);
      }
    } catch (err) {
      setMsg('❌ Network error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-extrabold">Admin Dashboard 🛡️</h1>
        <p className="text-sm text-ink2 mt-1">Manage platform verifications and users.</p>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}
      </div>

      <div className="card">
        <h2 className="text-lg font-extrabold mb-4">Pending Store Verifications ({stores.length})</h2>
        
        {loading ? (
          <p className="text-sm text-ink2">Loading pending requests...</p>
        ) : stores.length === 0 ? (
          <p className="text-sm text-ink2">No pending requests. All caught up!</p>
        ) : (
          <div className="space-y-3">
            {stores.map(store => (
              <div key={store.id} className="flex justify-between items-center border border-line p-4 rounded-xl flex-wrap gap-4">
                <div>
                  <p className="font-bold">{store.storeName}</p>
                  <p className="text-xs text-ink2">ID: {store.storeId}</p>
                  <p className="text-xs text-ink2">Address: {store.address}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReview(store.id, 'approved')} 
                    className="btn btn-sm bg-ok hover:bg-ok/90"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleReview(store.id, 'rejected')} 
                    className="btn btn-sm bg-bad hover:bg-bad/90"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
