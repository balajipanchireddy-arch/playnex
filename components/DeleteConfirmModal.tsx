'use client';

import React, { ReactNode } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface DeleteModalDetail {
  label: string;
  value: ReactNode;
  badge?: boolean;
  badgeColor?: string;
}

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  recordName: string;
  recordType?: string;
  warningText?: string;
  details?: DeleteModalDetail[];
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning';
  loading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  recordName,
  recordType = 'Record',
  warningText = 'This action is permanent and cannot be undone.',
  details = [],
  confirmLabel = 'Confirm Delete',
  confirmVariant = 'danger',
  loading = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const isWarning = confirmVariant === 'warning';
  const glowColor = isWarning ? 'bg-amber-500/15' : 'bg-rose-500/15';
  const iconBg = isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400';
  const btnBg = isWarning 
    ? 'bg-amber-600 hover:bg-amber-500 text-white' 
    : 'bg-rose-600 hover:bg-rose-500 text-white';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="card w-full max-w-md bg-slate-900 border-slate-800 text-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Ambient glow accent */}
        <div 
          aria-hidden="true"
          className={`absolute -right-12 -top-12 w-44 h-44 rounded-full ${glowColor} blur-2xl pointer-events-none`}
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between relative z-10 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
              {isWarning ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-base font-black text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Confirm deletion of this {recordType.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 py-4 space-y-3.5">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {recordType} Name
              </span>
            </div>
            <p className="text-sm font-bold text-white break-words">
              {recordName}
            </p>

            {details.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                {details.map((d, i) => (
                  <div key={i} className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">{d.label}</span>
                    {d.badge ? (
                      <span className={`badge ${d.badgeColor || 'badge-brand'} text-[10px] font-bold`}>
                        {d.value}
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-200">{d.value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 text-xs text-rose-300/90 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <p className="leading-relaxed">
              {warningText}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-sm btn-ghost text-xs text-slate-300 hover:text-white border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-sm text-xs font-bold border-0 flex items-center gap-1.5 shadow-lg ${btnBg} disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isWarning ? <AlertTriangle className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

