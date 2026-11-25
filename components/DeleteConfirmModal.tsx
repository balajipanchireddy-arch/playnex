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
  const iconBg = isWarning ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  const btnBg = isWarning
    ? 'bg-amber-600 hover:bg-amber-700 text-white'
    : 'bg-rose-600 hover:bg-rose-700 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="card w-full max-w-md bg-white border-[#E2E8F0] text-[#172033] p-6 shadow-xl relative animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between relative z-10 pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
              {isWarning ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-base font-bold text-[#172033]">
                {title}
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Confirm deletion of this {recordType.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#64748B] hover:text-[#172033] p-1 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 py-4 space-y-3.5">
          <div className="p-3.5 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                {recordType} Name
              </span>
            </div>
            <p className="text-sm font-bold text-[#172033] break-words">
              {recordName}
            </p>

            {details.length > 0 && (
              <div className="pt-2 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-xs">
                {details.map((d, i) => (
                  <div key={i} className="space-y-0.5">
                    <span className="text-[10px] text-[#64748B] block">{d.label}</span>
                    {d.badge ? (
                      <span className={`badge ${d.badgeColor || 'badge-brand'} text-[10px] font-bold`}>
                        {d.value}
                      </span>
                    ) : (
                      <span className="font-semibold text-[#172033]">{d.value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="leading-relaxed">
              {warningText}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="relative z-10 pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-sm btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-sm text-xs font-semibold ${btnBg} disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Deleting...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
