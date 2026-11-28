import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

function getQrSigningSecret(): string {
  const configured = process.env.PLAYNEX_QR_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PLAYNEX_QR_SECRET environment variable is required in production for QR signing.'
    );
  }
  // Development/local-only deterministic key (prohibited in production)
  const devSeed = `${process.env.FIREBASE_PROJECT_ID || 'playnex'}|dev-local-qr`;
  return createHmac('sha256', 'playnex-dev-qr-key').update(devSeed).digest('hex');
}

export function generateBookingCode(): string {
  const bytes = randomBytes(4).toString('hex').toUpperCase();
  return `PNX-${bytes.slice(0, 6)}`;
}

export function generateQrToken(): string {
  return randomBytes(16).toString('hex');
}

function signBookingToken(bookingId: string, qrToken: string): string {
  const secret = getQrSigningSecret();
  return createHmac('sha256', secret)
    .update(`${bookingId}.${qrToken}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Creates a signed, compact QR string verified strictly on the server.
 * Format: PNX1:<bookingId>:<qrToken>:<hmacSignature>
 */
export function createSignedQrPayload(bookingId: string, qrToken: string): string {
  const sig = signBookingToken(bookingId, qrToken);
  return `PNX1:${bookingId}:${qrToken}:${sig}`;
}

export interface ParsedQrResult {
  isSignedPayload: boolean;
  validSignature: boolean;
  bookingId?: string;
  qrToken?: string;
  manualQuery?: string;
}

export function verifySignedQrPayload(rawInput: string): ParsedQrResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { isSignedPayload: false, validSignature: false };
  }

  if (!trimmed.startsWith('PNX1:')) {
    // Manual booking ID or PNX-XXXXXX code lookup
    return {
      isSignedPayload: false,
      validSignature: false,
      manualQuery: trimmed,
    };
  }

  const parts = trimmed.split(':');
  if (parts.length !== 4) {
    return { isSignedPayload: true, validSignature: false };
  }

  const [, bookingId, qrToken, sig] = parts;
  if (!bookingId || !qrToken || !sig) {
    return { isSignedPayload: true, validSignature: false };
  }

  const expectedSig = signBookingToken(bookingId, qrToken);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);

  const valid =
    sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

  return {
    isSignedPayload: true,
    validSignature: valid,
    bookingId: valid ? bookingId : undefined,
    qrToken: valid ? qrToken : undefined,
  };
}
