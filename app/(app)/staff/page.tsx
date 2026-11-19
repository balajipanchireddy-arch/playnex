'use client';
import { useState, useEffect } from 'react';

export default function StaffDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    try {
      const res = await fetch('/api/staff/me/tasks');
      const data = await res.json();
      if (data.ok) setTasks(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function completeTask(taskId: string) {
    await fetch('/api/staff/me/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    loadTasks(); // Refresh list
  }

  if (loading) return <p className="text-center mt-10">Loading your tasks...</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-extrabold">🧑‍🏫 Staff Dashboard</h1>
        <p className="text-sm text-ink2 mt-1">Welcome to your workspace. Here are your assigned tasks.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tasks List */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">📋 My Tasks ({tasks.filter(t => t.status === 'pending').length} pending)</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink2">No tasks assigned yet. You are all caught up!</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} className={`border p-4 rounded-xl flex justify-between items-center gap-4 ${t.status === 'completed' ? 'border-green-200 bg-green-50 opacity-60' : 'border-line'}`}>
                  <div>
                    <p className={`font-bold ${t.status === 'completed' ? 'line-through text-ink2' : ''}`}>{t.title}</p>
                    <p className="text-xs text-ink2 mt-1">{t.description}</p>
                  </div>
                  {t.status === 'pending' ? (
                    <button onClick={() => completeTask(t.id)} className="btn btn-sm bg-ok hover:bg-ok/90">Done</button>
                  ) : (
                    <span className="badge badge-ok">✓ Done</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule (Read-only) */}
        <div className="card">
          <h2 className="text-lg font-extrabold mb-4">🕒 Today's Schedule</h2>
          <div className="space-y-3">
            <div className="border-l-4 border-brand pl-3 py-1">
              <p className="font-bold text-sm">6:00 PM - 7:00 PM</p>
              <p className="text-xs text-ink2">Arena A · Basketball Booking</p>
            </div>
            <div className="border-l-4 border-brand pl-3 py-1">
              <p className="font-bold text-sm">7:00 PM - 8:00 PM</p>
              <p className="text-xs text-ink2">Arena A · Football Booking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
