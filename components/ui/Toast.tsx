'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  type: 'ok' | 'err';
  text: string;
}

interface ToastProps {
  message: ToastMessage | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const isOk = message.type === 'ok';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 transition-all duration-300 pointer-events-none 
                 bottom-6 inset-x-4 sm:inset-x-auto sm:bottom-auto sm:top-6 sm:right-6 
                 flex justify-center sm:justify-end"
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-4 duration-200 max-w-md w-full sm:w-auto ${
          isOk
            ? 'bg-emerald-900/95 text-white border-emerald-700/80'
            : 'bg-rose-900/95 text-white border-rose-700/80'
        }`}
      >
        <div className="shrink-0">
          {isOk ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400" />
          )}
        </div>

        <p className="text-xs font-semibold leading-relaxed flex-1">
          {message.text}
        </p>

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10 transition"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

