'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  User,
  Loader2,
  Trash2,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isError?: boolean;
  timestamp: string;
}

const STARTER_PROMPTS = [
  'How does the 5-day player verification work?',
  'How do QR ground bookings and check-ins work?',
  'How can I rent or buy sports gear?',
  'How do I match and chat with players nearby?',
];

export default function PlayNexAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Hi! I'm **PlayNex AI**, connected to the live Gemini assistant API. Ask me anything about bookings, QR passes, matchmaking, gear rentals, tournaments, or managing your portal.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setConfigNotice(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: nextHistory
            .filter((m) => !m.isError)
            .slice(-10)
            .map((m) => ({
              sender: m.sender,
              text: m.text,
            })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorCode = data?.error?.code;
        const errorMessage =
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message || 'AI Assistant is momentarily unavailable.';

        if (errorCode === 'AI_NOT_CONFIGURED') {
          setConfigNotice(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const reply = data?.data?.reply;
      if (typeof reply !== 'string' || !reply.trim()) {
        throw new Error('The AI service returned an empty response. Please try again.');
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        isError: true,
        text: err?.message || 'Unable to reach PlayNex AI right now.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setConfigNotice(null);
    setMessages([
      {
        id: `clear-${Date.now()}`,
        sender: 'ai',
        text: 'Conversation cleared. How can I assist you on PlayNex?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 rounded-full bg-[#101828] hover:bg-[#1D2F60] p-3.5 sm:px-5 sm:py-3.5 text-white shadow-lg active:scale-95 transition-all duration-150"
          aria-label="Open PlayNex AI"
        >
          <div className="relative h-6 w-6 rounded-full overflow-hidden border border-white/60 shadow-xs shrink-0">
            <img src="/icons/ai-copilot.jpg" alt="PlayNex AI" className="w-full h-full object-cover" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-[#16A36A] animate-ping" />
          </div>
          <span className="hidden sm:inline-block font-bold text-sm tracking-wide">
            PlayNex <span className="text-[#6DC5A0]">AI</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden transition-all duration-150 shadow-2xl border border-[#E5E7EB] bg-white text-[#172033] ${
            isExpanded
              ? 'inset-3 sm:inset-10 rounded-2xl'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[580px] max-h-[85vh] rounded-2xl'
          }`}
          role="dialog"
          aria-label="PlayNex AI Assistant"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#F8FAFC] relative">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border border-[#E5E7EB] shadow-xs shrink-0 bg-white">
                <img src="/icons/ai-copilot.jpg" alt="PlayNex AI" className="w-full h-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#16A36A] border-2 border-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-[#172033]">PlayNex AI</h3>
                  <span className="rounded-full bg-[#C5E9D7] px-2 py-0.5 text-[9px] font-bold text-[#0E7055] border border-green-200 uppercase">
                    LIVE API
                  </span>
                </div>
                <p className="text-[10px] text-[#667085]">Context-aware Gemini assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#667085]">
              <button
                onClick={clearHistory}
                className="p-1.5 rounded-lg hover:bg-slate-200 hover:text-[#172033] transition"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:block p-1.5 rounded-lg hover:bg-slate-200 hover:text-[#172033] transition"
                title={isExpanded ? 'Restore window' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 hover:text-[#172033] transition"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {configNotice && (
            <div className="mx-4 mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[11px] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">AI API Key Required</p>
                <p className="mt-0.5">{configNotice}</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs overflow-hidden ${
                      isUser
                        ? 'bg-[#101828] text-white'
                        : 'bg-white border border-[#E5E7EB]'
                    }`}
                  >
                    {isUser ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <img src="/icons/ai-copilot.jpg" alt="AI" className="h-full w-full object-cover" />
                    )}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#101828] text-white rounded-tr-none'
                        : m.isError
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none'
                        : 'bg-[#F8FAFC] text-[#172033] border border-[#E5E7EB] rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <span
                      className={`block text-[9px] mt-1.5 font-medium ${
                        isUser ? 'text-slate-300 text-right' : 'text-[#667085]'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2.5 text-[#667085] text-xs py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl overflow-hidden border border-[#E5E7EB] bg-white shrink-0">
                  <img src="/icons/ai-copilot.jpg" alt="AI" className="h-full w-full object-cover animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl px-3.5 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16A36A]" />
                  <span className="text-[11px] font-semibold text-[#667085]">PlayNex AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-2 border-t border-[#E5E7EB] bg-[#F8FAFC] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="shrink-0 text-[11px] font-semibold text-[#172033] bg-white hover:bg-[#E8F5EE] hover:text-[#0E7055] hover:border-green-200 px-3 py-1 rounded-full border border-[#E5E7EB] transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 sm:p-4 border-t border-[#E5E7EB] bg-[#F8FAFC] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask PlayNex AI anything..."
              disabled={loading}
              className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#172033] placeholder:text-[#667085] focus:outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-green-500/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A36A] hover:bg-[#12896A] text-white shadow-xs active:scale-95 disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
