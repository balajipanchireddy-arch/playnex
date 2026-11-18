'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function fetchPending() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verifications');
      const data = await res.json();
      if (data.ok) setRequests(data.data);
      else setMsg(`❌ Error: ${data.error.message}`);
    } catch (err) {
      setMsg('❌ Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPending(); }, []);

  async function handleReview(id: string, type: 'store' | 'academy', status: 'approved' | 'rejected') {
    setMsg('');
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, status })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ ${type} ${status} successfully!`);
        setRequests(requests.filter(r => r.id !== id));
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
        <p className="text-sm text-ink2 mt-1">Manage platform verifications.</p>
        {msg && <div className="mt-4 p-3 rounded-xl bg-brand/10 text-brand font-semibold text-sm">{msg}</div>}
      </div>

      <div className="card">
        <h2 className="text-lg font-extrabold mb-4">Pending Verifications ({requests.length})</h2>
        
        {loading ? (
          <p className="text-sm text-ink2">Loading pending requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-ink2">No pending requests. All caught up!</p>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="flex justify-between items-center border border-line p-4 rounded-xl flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{req.displayName}</p>
                    <span className={`badge ${req.type === 'store' ? 'badge-warn' : 'badge-na'}`}>
                      {req.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-ink2 mt-1">ID: {req.id}</p>
                  <p className="text-xs text-ink2">Address: {req.address}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReview(req.id, req.type, 'approved')} 
                    className="btn btn-sm bg-ok hover:bg-ok/90"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleReview(req.id, req.type, 'rejected')} 
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
