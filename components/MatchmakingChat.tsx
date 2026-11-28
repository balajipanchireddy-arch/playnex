'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  ShieldAlert,
  Ban,
  CheckCircle2,
  Loader2,
  Users,
  X,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface MatchmakingChatProps {
  currentUserId: string;
  onNotify: (type: 'ok' | 'err', text: string) => void;
  initialChatId?: string | null;
}

export default function MatchmakingChat({
  currentUserId,
  onNotify,
  initialChatId,
}: MatchmakingChatProps) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reportModal, setReportModal] = useState<{ targetUserId: string; targetName: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats');
      const json = await res.json();
      if (json.ok) {
        const list = json.data || [];
        setChats(list);
        if (!selectedChatId && list.length > 0) {
          setSelectedChatId(list[0].id);
        }
      }
    } catch {
      // Ignore transient load error
    } finally {
      setLoadingChats(false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    if (initialChatId) {
      setSelectedChatId(initialChatId);
    }
  }, [initialChatId]);

  useEffect(() => {
    loadChats();
    const timer = setInterval(loadChats, 15000);
    return () => clearInterval(timer);
  }, [loadChats]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`);
      const json = await res.json();
      if (json.ok) {
        setMessages(json.data?.messages || []);
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedChatId);

    // Real-time Firestore listener for authorized participants
    let unsub: (() => void) | null = null;
    try {
      const q = query(
        collection(db, 'chats', selectedChatId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const live = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMessages(live);
        },
        () => {
          // Fallback to API polling if client auth hasn't synced
        }
      );
    } catch {
      // Fallback
    }

    return () => {
      if (unsub) unsub();
    };
  }, [selectedChatId, fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChat = chats.find((c) => c.id === selectedChatId) || null;
  const otherParticipants: Array<{ uid: string; name: string }> = activeChat
    ? (activeChat.participants || [])
        .filter((uid: string) => uid !== currentUserId)
        .map((uid: string) => ({
          uid,
          name: activeChat.participantNames?.[uid] || 'Player',
        }))
    : [];

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChatId || !draft.trim() || sending) return;

    setSending(true);
    const text = draft.trim();
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(selectedChatId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (json.ok) {
        setDraft('');
        setMessages((prev) =>
          prev.some((m) => m.id === json.data.id) ? prev : [...prev, json.data]
        );
        loadChats();
      } else {
        onNotify('err', json.error?.message || 'Failed to send message.');
      }
    } catch {
      onNotify('err', 'Network error sending message.');
    } finally {
      setSending(false);
    }
  }

  async function handleBlockUser(targetUserId: string, currentlyBlocked: boolean) {
    try {
      const res = currentlyBlocked
        ? await fetch(`/api/users/block?targetUserId=${encodeURIComponent(targetUserId)}`, {
            method: 'DELETE',
          })
        : await fetch('/api/users/block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId, reason: 'Blocked via matchmaking chat' }),
          });
      const json = await res.json();
      if (json.ok) {
        onNotify('ok', currentlyBlocked ? 'User unblocked.' : 'User blocked. Messaging disabled.');
        loadChats();
      } else {
        onNotify('err', json.error?.message || 'Action failed.');
      }
    } catch {
      onNotify('err', 'Network error.');
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportModal || !reportReason.trim()) return;
    try {
      const res = await fetch('/api/users/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: reportModal.targetUserId,
          reason: reportReason.trim(),
          chatId: selectedChatId || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onNotify('ok', `Report submitted for ${reportModal.targetName}. Administrators notified.`);
        setReportModal(null);
        setReportReason('');
      } else {
        onNotify('err', json.error?.message || 'Failed to submit report.');
      }
    } catch {
      onNotify('err', 'Network error.');
    }
  }

  const totalUnread = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className="card p-0 overflow-hidden border-[#E5E7EB]">
      <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F5EE] text-[#16A36A] flex items-center justify-center">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#172033]">Matchmaking Chat</h3>
              {totalUnread > 0 && (
                <span className="badge badge-bad text-[10px]">{totalUnread} unread</span>
              )}
            </div>
            <p className="text-[11px] text-[#667085]">
              Available only between accepted match teammates and accepted requests
            </p>
          </div>
        </div>
      </div>

      {loadingChats ? (
        <div className="py-10 text-center text-xs text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#16A36A]" />
          Loading conversations...
        </div>
      ) : chats.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <Users className="h-8 w-8 text-[#98A2B3] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#172033]">No active conversations yet</p>
          <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
            Send a matchmaking request to a nearby player or get accepted into an open match to unlock private chat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 min-h-[380px]">
          {/* Conversations Sidebar */}
          <div className="border-b md:border-b-0 md:border-r border-[#E5E7EB] divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {chats.map((c) => {
              const isSelected = c.id === selectedChatId;
              const others = (c.participants || [])
                .filter((u: string) => u !== currentUserId)
                .map((u: string) => c.participantNames?.[u] || 'Player')
                .join(', ');
              const displayTitle = c.title || others || 'Match Chat';

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChatId(c.id)}
                  className={`w-full text-left p-3.5 transition flex items-start justify-between gap-2 ${
                    isSelected ? 'bg-[#E8F5EE]/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="badge badge-navy text-[9px] uppercase">
                        {c.type === 'match' ? 'Match' : 'Direct'}
                      </span>
                      {c.isBlocked && (
                        <span className="badge badge-bad text-[9px] uppercase">Blocked</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#172033] truncate mt-1">
                      {displayTitle}
                    </p>
                    <p className="text-[11px] text-[#667085] truncate mt-0.5">
                      {c.lastMessage || 'No messages yet — say hello!'}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="h-5 min-w-[20px] rounded-full bg-[#16A36A] text-white text-[10px] font-bold flex items-center justify-center px-1.5 shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Thread */}
          <div className="md:col-span-2 flex flex-col justify-between max-h-[420px]">
            {activeChat ? (
              <>
                <div className="px-4 py-2.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2 bg-white">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#172033] truncate">
                      {activeChat.title ||
                        otherParticipants.map((o) => o.name).join(', ') ||
                        'Conversation'}
                    </p>
                    <p className="text-[10px] text-[#667085]">
                      {activeChat.participants?.length || 2} participant(s)
                    </p>
                  </div>

                  {otherParticipants.length > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleBlockUser(otherParticipants[0].uid, Boolean(activeChat.isBlocked))
                        }
                        className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                      >
                        <Ban className="h-3 w-3 text-rose-600" />
                        {activeChat.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReportModal({
                            targetUserId: otherParticipants[0].uid,
                            targetName: otherParticipants[0].name,
                          })
                        }
                        className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                      >
                        <ShieldAlert className="h-3 w-3 text-amber-600" />
                        Report
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]/50">
                  {loadingMsgs && messages.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#667085]">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#667085]">
                      <CheckCircle2 className="h-6 w-6 text-[#16A36A] mx-auto mb-1" />
                      Connection established! Coordinate timing, court, and equipment here.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderId === currentUserId;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs ${
                              mine
                                ? 'bg-[#101828] text-white rounded-br-none'
                                : 'bg-white border border-[#E5E7EB] text-[#172033] rounded-bl-none'
                            }`}
                          >
                            {!mine && (
                              <p className="text-[10px] font-bold text-[#16A36A] mb-0.5">
                                {m.senderName || 'Player'}
                              </p>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          </div>
                          <span className="text-[9px] text-[#98A2B3] mt-0.5 px-1">
                            {m.createdAt
                              ? new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <form
                  onSubmit={handleSend}
                  className="p-3 border-t border-[#E5E7EB] bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={sending || Boolean(activeChat.isBlocked)}
                    placeholder={
                      activeChat.isBlocked
                        ? 'Messaging disabled while user is blocked'
                        : 'Type a message...'
                    }
                    className="input py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending || Boolean(activeChat.isBlocked)}
                    className="btn btn-sm shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#667085]">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}

      {reportModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <h3 className="modal-title text-base">Report User: {reportModal.targetName}</h3>
              <button
                onClick={() => setReportModal(null)}
                className="text-[#667085] hover:text-[#172033]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="modal-body space-y-3 text-xs">
              <div>
                <label className="label">Reason for Report *</label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="input"
                  placeholder="Describe inappropriate behavior, spam, or no-show abuse..."
                />
              </div>
              <div className="modal-footer px-0 pb-0">
                <button
                  type="button"
                  onClick={() => setReportModal(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm bg-rose-600 hover:bg-rose-700">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
