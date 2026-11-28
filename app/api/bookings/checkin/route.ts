import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { verifySignedQrPayload } from '@/lib/bookings/qr';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

/**
 * Ground Staff QR & Manual Booking Attendance Check-In API
 *
 * GET  /api/bookings/checkin?query=...   — Search bookings by ID, bookingCode, or player email
 * POST /api/bookings/checkin             — Server-side QR validation & atomic one-time check-in
 */

async function getAuthorizedAcademyIds(uid: string, email?: string | null): Promise<{
  isAdminUser: boolean;
  academyIds: Set<string>;
}> {
  const adminUser = await isAdmin(uid);
  const academyIds = new Set<string>();

  const [ownedSnap, ownedByFieldSnap, staffSnap] = await Promise.all([
    adminDb.collection('academies').doc(uid).get(),
    adminDb.collection('academies').where('ownerUserId', '==', uid).get(),
    email
      ? adminDb
          .collection('staffProfiles')
          .where('email', '==', email)
          .where('status', '==', 'active')
          .get()
      : Promise.resolve(null),
  ]);

  if (ownedSnap.exists) academyIds.add(uid);
  ownedByFieldSnap.docs.forEach((d: any) => academyIds.add(d.id));
  staffSnap?.docs.forEach((d: any) => {
    if (d.data()?.academyId) academyIds.add(d.data().academyId);
  });

  return { isAdminUser: adminUser, academyIds };
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { isAdminUser, academyIds } = await getAuthorizedAcademyIds(session.uid, session.email);
  if (!isAdminUser && academyIds.size === 0) {
    return fail('forbidden', 'Academy or staff permissions required', 403);
  }

  const { searchParams } = new URL(req.url);
  const queryText = (searchParams.get('query') || '').trim().toLowerCase();

  try {
    let bookings: any[] = [];
    if (isAdminUser) {
      const snap = await adminDb
        .collection('bookings')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      bookings = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } else {
      const academyList = Array.from(academyIds);
      const bookingMap = new Map<string, any>();
      for (let i = 0; i < academyList.length; i += 30) {
        const chunk = academyList.slice(i, i + 30);
        const snap = await adminDb
          .collection('bookings')
          .where('academyId', 'in', chunk)
          .limit(200)
          .get();
        snap.docs.forEach((d: any) => {
          bookingMap.set(d.id, { id: d.id, ...d.data() });
        });
      }
      bookings = Array.from(bookingMap.values());
    }

    if (queryText) {
      bookings = bookings.filter(
        (b: any) =>
          b.id.toLowerCase().includes(queryText) ||
          (b.bookingCode || '').toLowerCase().includes(queryText) ||
          (b.userEmail || '').toLowerCase().includes(queryText) ||
          (b.userName || '').toLowerCase().includes(queryText) ||
          (b.facilityName || '').toLowerCase().includes(queryText)
      );
    }

    bookings.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(bookings.slice(0, 50));
  } catch (e: any) {
    return fail('server_error', e.message || 'Search failed', 500);
  }
}

const CheckInBody = z.object({
  qrData: z.string().optional(),
  bookingId: z.string().optional(),
  facilityId: z.string().optional(),
  action: z.enum(['check_in', 'complete', 'no_show']).default('check_in'),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { isAdminUser, academyIds } = await getAuthorizedAcademyIds(session.uid, session.email);
  if (!isAdminUser && academyIds.size === 0) {
    return fail('forbidden', 'Only authorized academy operators or active ground staff can check in bookings.', 403);
  }

  const parsed = CheckInBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', 'Invalid check-in payload', 400);
  }

  const { qrData, bookingId, facilityId, action } = parsed.data;
  if (!qrData && !bookingId) {
    return fail('invalid', 'Provide QR scan payload or Booking ID / Code', 400);
  }

  try {
    let targetBookingId = bookingId?.trim() || '';
    let expectedQrToken: string | null = null;

    if (qrData) {
      const qrResult = verifySignedQrPayload(qrData);
      if (qrResult.isSignedPayload) {
        if (!qrResult.validSignature || !qrResult.bookingId || !qrResult.qrToken) {
          return fail('invalid_qr', 'Invalid or tampered QR pass signature.', 400);
        }
        targetBookingId = qrResult.bookingId;
        expectedQrToken = qrResult.qrToken;
      } else if (qrResult.manualQuery) {
        targetBookingId = qrResult.manualQuery;
      }
    }

    // Support lookup by bookingCode (PNX-XXXXXX) if not a direct document ID
    let bookingRef = adminDb.collection('bookings').doc(targetBookingId);
    let directSnap = await bookingRef.get();
    if (!directSnap.exists) {
      const codeSnap = await adminDb
        .collection('bookings')
        .where('bookingCode', '==', targetBookingId.toUpperCase())
        .limit(1)
        .get();
      if (codeSnap.empty) {
        return fail('not_found', `No booking found matching "${targetBookingId}".`, 404);
      }
      bookingRef = codeSnap.docs[0].ref;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const result = await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new Error('NOT_FOUND');

      const b = snap.data();

      if (!isAdminUser && !academyIds.has(b.academyId)) {
        throw new Error('FORBIDDEN_ACADEMY');
      }
      if (facilityId && b.facilityId !== facilityId) {
        throw new Error('WRONG_GROUND');
      }
      if (expectedQrToken && b.qrToken !== expectedQrToken) {
        throw new Error('INVALID_QR_TOKEN');
      }

      if (b.status === 'cancelled') throw new Error('BOOKING_CANCELLED');
      if (b.status === 'no_show' && action === 'check_in') throw new Error('MARKED_NO_SHOW');

      if (action === 'check_in') {
        if (b.status === 'checked_in') throw new Error('ALREADY_CHECKED_IN');
        if (b.status === 'completed') throw new Error('ALREADY_COMPLETED');
        if (b.bookingDate && b.bookingDate < todayStr) {
          throw new Error('BOOKING_EXPIRED');
        }
      }

      const now = Date.now();
      const staffIdentity = {
        uid: session.uid,
        email: session.email || '',
      };

      if (action === 'check_in') {
        tx.update(bookingRef, {
          status: 'checked_in',
          checkedInAt: now,
          checkedInBy: staffIdentity,
          updatedAt: now,
        });
      } else if (action === 'complete') {
        tx.update(bookingRef, {
          status: 'completed',
          completedAt: now,
          completedBy: staffIdentity,
          updatedAt: now,
        });
      } else if (action === 'no_show') {
        if (b.status === 'checked_in' || b.status === 'completed') {
          throw new Error('ALREADY_ATTENDED');
        }
        tx.update(bookingRef, {
          status: 'no_show',
          noShowMarkedAt: now,
          noShowMarkedBy: staffIdentity,
          updatedAt: now,
        });
      }

      return { id: snap.id, ...b, nextStatus: action === 'check_in' ? 'checked_in' : action === 'complete' ? 'completed' : 'no_show' };
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Ground Staff',
      action: `booking_${result.nextStatus}`,
      entityType: 'booking',
      entityId: result.id,
      details: `Staff ${session.email || session.uid} marked booking ${result.bookingCode || result.id} at ${result.facilityName} as ${result.nextStatus}.`,
    });

    await dispatchNotification({
      title:
        result.nextStatus === 'checked_in'
          ? 'Ground Check-In Verified'
          : result.nextStatus === 'completed'
          ? 'Session Completed'
          : 'Booking Marked No-Show',
      message:
        result.nextStatus === 'checked_in'
          ? `Your attendance at ${result.facilityName} (${result.bookingDate} ${result.slot}:00) has been checked in.`
          : `Your booking ${result.bookingCode || result.id} at ${result.facilityName} is now ${result.nextStatus.replace('_', ' ')}.`,
      category: 'academy',
      targetRole: 'player',
      recipientId: result.userId,
      targetUserId: result.userId,
      link: '/player',
      idempotencyKey: `notif_checkin_${result.id}_${result.nextStatus}`,
    });

    return ok({
      success: true,
      bookingId: result.id,
      bookingCode: result.bookingCode,
      facilityName: result.facilityName,
      bookingDate: result.bookingDate,
      slot: result.slot,
      userName: result.userName || result.userEmail,
      status: result.nextStatus,
    });
  } catch (e: any) {
    const errMap: Record<string, [string, string, number]> = {
      NOT_FOUND: ['not_found', 'Booking not found', 404],
      FORBIDDEN_ACADEMY: ['forbidden', 'This booking belongs to a different academy.', 403],
      WRONG_GROUND: ['wrong_ground', 'This booking is for a different ground.', 400],
      INVALID_QR_TOKEN: ['invalid_qr', 'QR token mismatch or revoked.', 400],
      BOOKING_CANCELLED: ['cancelled', 'This booking was cancelled and cannot be checked in.', 409],
      BOOKING_EXPIRED: ['expired', 'This booking date has already passed.', 400],
      ALREADY_CHECKED_IN: ['duplicate_scan', 'Duplicate scan blocked: player is already checked in.', 409],
      ALREADY_COMPLETED: ['completed', 'This booking session is already completed.', 409],
      MARKED_NO_SHOW: ['no_show', 'This booking was marked No Show.', 409],
      ALREADY_ATTENDED: ['conflict', 'Attended bookings cannot be marked No Show.', 409],
    };
    const mapped = errMap[e?.message];
    if (mapped) return fail(mapped[0], mapped[1], mapped[2]);
    return fail('server_error', e?.message || 'Check-in validation failed', 500);
  }
}
