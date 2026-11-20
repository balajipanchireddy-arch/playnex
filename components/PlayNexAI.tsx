'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  Maximize2, 
  Minimize2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  'How do I register for tournaments?',
  'How do hourly turf bookings work?',
  'What games and sports are supported?',
  'How can academies host tournaments?',
];

export default function PlayNexAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "👋 Hi! I'm **PlayNex AI**, your sports & gaming assistant. Ask me anything about finding matches, registering for tournaments, reserving turf slots, or managing your academy and store!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'AI Assistant is momentarily unavailable.');
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'I could not process that request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: err?.message || 'Sorry, something went wrong. Please try again later.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([
      {
        id: `clear-${Date.now()}`,
        sender: 'ai',
        text: "Conversation cleared. How can I assist your sports & gaming journey?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] p-3.5 sm:px-5 sm:py-3.5 text-white shadow-lg active:scale-95 transition-all duration-150"
          aria-label="Open PlayNex AI"
        >
          <div className="relative h-6 w-6 rounded-full overflow-hidden border border-white/60 shadow-xs shrink-0">
            <img src="/icons/ai-copilot.jpg" alt="PlayNex AI" className="w-full h-full object-cover" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="hidden sm:inline-block font-bold text-sm tracking-wide">
            PlayNex <span className="text-blue-100">AI</span>
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden transition-all duration-150 shadow-2xl border border-[#E2E8F0] bg-white text-[#172033] ${
            isExpanded
              ? 'inset-3 sm:inset-10 rounded-2xl'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[580px] max-h-[85vh] rounded-2xl'
          }`}
          role="dialog"
          aria-label="PlayNex AI Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-slate-50 relative">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border border-[#E2E8F0] shadow-xs shrink-0 bg-white">
                <img src="/icons/ai-copilot.jpg" alt="PlayNex AI" className="w-full h-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-[#172033]">PlayNex AI</h3>
                  <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[9px] font-bold text-[#1E40AF] border border-blue-200 uppercase">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-[#64748B]">Connected to sports knowledge engine</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#64748B]">
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

          {/* Messages Feed */}
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
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-white border border-[#E2E8F0]'
                    }`}
                  >
                    {isUser ? <User className="h-3.5 w-3.5" /> : <img src="/icons/ai-copilot.jpg" alt="AI" className="h-full w-full object-cover" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#2563EB] text-white rounded-tr-none'
                        : 'bg-slate-100 text-[#172033] border border-[#E2E8F0] rounded-tl-none prose-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <span
                      className={`block text-[9px] mt-1.5 font-medium ${
                        isUser ? 'text-blue-100 text-right' : 'text-[#64748B]'
                      }`}
                    >
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2.5 text-[#64748B] text-xs py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl overflow-hidden border border-[#E2E8F0] bg-white shrink-0">
                  <img src="/icons/ai-copilot.jpg" alt="AI" className="h-full w-full object-cover animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-[#E2E8F0] rounded-2xl px-3.5 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2563EB]" />
                  <span className="text-[11px] font-semibold text-[#64748B]">PlayNex AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 border-t border-[#E2E8F0] bg-slate-50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="shrink-0 text-[11px] font-semibold text-[#172033] bg-white hover:bg-blue-50 hover:text-[#2563EB] hover:border-blue-200 px-3 py-1 rounded-full border border-[#E2E8F0] transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 sm:p-4 border-t border-[#E2E8F0] bg-slate-50 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask PlayNex AI anything about sports, turfs..."
              disabled={loading}
              className="flex-1 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#172033] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs active:scale-95 disabled:opacity-40 transition"
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
