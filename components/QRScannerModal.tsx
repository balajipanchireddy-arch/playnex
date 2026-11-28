'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  Search,
  QrCode,
  Loader2,
  X,
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckedIn: () => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onCheckedIn,
  onNotify,
}: QRScannerModalProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; booking?: any } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastResult(null);
    }
    return () => stopCamera();
  }, [isOpen]);

  async function validateAndCheckIn(payload: { qrData?: string; bookingId?: string; action?: 'check_in' | 'complete' | 'no_show' }) {
    if (processing) return;
    setProcessing(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/bookings/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        const msg = `Checked in ${json.data.bookingCode || json.data.bookingId} (${json.data.facilityName} · ${json.data.bookingDate} ${json.data.slot}:00)`;
        setLastResult({ ok: true, message: msg, booking: json.data });
        onNotify('ok', msg);
        onCheckedIn();
        if (manualQuery.trim()) {
          handleSearch(manualQuery);
        }
      } else {
        const errMsg = json.error?.message || 'Check-in rejected by server validation.';
        setLastResult({ ok: false, message: errMsg });
        onNotify('err', errMsg);
      }
    } catch {
      setLastResult({ ok: false, message: 'Network error validating booking QR.' });
    } finally {
      setProcessing(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    setLastResult(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API is unavailable on this browser. Use manual Booking ID search below.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          scanFrame();
        }
      }, 100);
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access or use manual Booking ID search.'
          : 'Could not start camera scanner. Use manual Booking ID search below.'
      );
      setCameraActive(false);
    }
  }

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          stopCamera();
          validateAndCheckIn({ qrData: code.data, action: 'check_in' });
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleSearch(qText = manualQuery) {
    setSearching(true);
    try {
      const res = await fetch(`/api/bookings/checkin?query=${encodeURIComponent(qText.trim())}`);
      const json = await res.json();
      if (json.ok) {
        setSearchResults(json.data || []);
      }
    } catch {
      // Ignore
    } finally {
      setSearching(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box max-w-xl">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#16A36A]" />
            <h3 className="modal-title">Ground QR &amp; Booking Check-In</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-[#667085] hover:text-[#172033]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-5 text-xs">
          {/* Camera Scanner */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#172033]">Camera QR Scanner</p>
                <p className="text-[11px] text-[#667085]">
                  Point camera at the player&apos;s PlayNex booking QR pass for server-side verification
                </p>
              </div>
              {cameraActive ? (
                <button type="button" onClick={stopCamera} className="btn-danger btn-sm text-xs">
                  <CameraOff className="h-3.5 w-3.5" /> Stop Camera
                </button>
              ) : (
                <button type="button" onClick={startCamera} className="btn btn-sm text-xs">
                  <Camera className="h-3.5 w-3.5" /> Start Camera
                </button>
              )}
            </div>

            {cameraError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {cameraActive && (
              <div className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-black">
                <video ref={videoRef} className="w-full max-h-60 object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none border-2 border-[#16A36A]/60 rounded-xl" />
              </div>
            )}
          </div>

          {lastResult && (
            <div
              className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${
                lastResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {lastResult.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{lastResult.ok ? 'Check-In Approved' : 'Check-In Rejected'}</p>
                <p className="mt-0.5">{lastResult.message}</p>
              </div>
            </div>
          )}

          {/* Manual Booking-ID / Code Search */}
          <div className="space-y-3">
            <label className="label mb-0">Manual Booking ID / Code Search</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#667085]" />
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="Enter PNX-XXXXXX, booking ID, or player email..."
                  className="input pl-9 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={searching}
                className="btn-secondary btn-sm text-xs"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
              </button>
              <button
                type="button"
                disabled={!manualQuery.trim() || processing}
                onClick={() => validateAndCheckIn({ bookingId: manualQuery.trim(), action: 'check_in' })}
                className="btn btn-sm text-xs"
              >
                Verify &amp; Check In
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="border border-[#E5E7EB] rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {searchResults.map((b) => (
                  <div key={b.id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#172033]">
                          {b.bookingCode || b.id.slice(0, 8)}
                        </span>
                        <span
                          className={`badge text-[10px] uppercase ${
                            b.status === 'checked_in' || b.status === 'completed'
                              ? 'badge-ok'
                              : b.status === 'cancelled' || b.status === 'no_show'
                              ? 'badge-bad'
                              : 'badge-warn'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667085] mt-0.5">
                        {b.userName || b.userEmail} · {b.facilityName} · {b.bookingDate} ({b.slot}:00)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {b.status === 'confirmed' && (
                        <>
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => validateAndCheckIn({ bookingId: b.id, action: 'check_in' })}
                            className="btn btn-sm text-[11px] py-1 px-2.5"
                          >
                            Check In
                          </button>
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => validateAndCheckIn({ bookingId: b.id, action: 'no_show' })}
                            className="btn-secondary btn-sm text-[11px] py-1 px-2"
                          >
                            No Show
                          </button>
                        </>
                      )}
                      {b.status === 'checked_in' && (
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => validateAndCheckIn({ bookingId: b.id, action: 'complete' })}
                          className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
