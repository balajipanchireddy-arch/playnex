import { NextRequest } from 'next/server';
import { z } from 'zod';
import QRCode from 'qrcode';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';
import {
  createSignedQrPayload,
  generateBookingCode,
  generateQrToken,
} from '@/lib/bookings/qr';

/**
 * Court Bookings API with Date+Slot Concurrency Lock & QR Attendance Token
 */

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');
  const facilityIdParam = searchParams.get('facilityId');
  const dateParam = searchParams.get('date');

  try {
    // Availability lookup for a specific facility + date (returns booked slot hours)
    if (facilityIdParam && dateParam) {
      const slotsSnap = await adminDb
        .collection('bookingSlots')
        .where('facilityId', '==', facilityIdParam)
        .where('bookingDate', '==', dateParam)
        .where('active', '==', true)
        .get();
      const bookedSlots = slotsSnap.docs.map((d: any) => String(d.data().slot));
      return ok({ facilityId: facilityIdParam, bookingDate: dateParam, bookedSlots });
    }

    const adminUser = await isAdmin(session.uid);
    let bookings: any[] = [];

    if (scope === 'all' && adminUser) {
      const snap = await adminDb
        .collection('bookings')
        .orderBy('createdAt', 'desc')
        .limit(300)
        .get();
      bookings = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } else if (scope === 'academy') {
      // Allow academy owner OR active staff linked to an academy
      const academyIds = new Set<string>([session.uid]);
      const [ownedAcadSnap, staffByEmail] = await Promise.all([
        adminDb.collection('academies').where('ownerUserId', '==', session.uid).get(),
        session.email
          ? adminDb
              .collection('staffProfiles')
              .where('email', '==', session.email)
              .where('status', '==', 'active')
              .get()
          : Promise.resolve(null),
      ]);
      ownedAcadSnap.docs.forEach((d: any) => academyIds.add(d.id));
      staffByEmail?.docs.forEach((d: any) => {
        if (d.data()?.academyId) academyIds.add(d.data().academyId);
      });

      const academyList = Array.from(academyIds).slice(0, 30);
      const bookingMap = new Map<string, any>();

      if (academyList.length > 0) {
        const [byAcademySnap, facSnap] = await Promise.all([
          adminDb
            .collection('bookings')
            .where('academyId', 'in', academyList)
            .limit(300)
            .get(),
          adminDb
            .collection('facilities')
            .where('academyId', 'in', academyList)
            .get(),
        ]);

        byAcademySnap.docs.forEach((d: any) => {
          bookingMap.set(d.id, { id: d.id, ...d.data() });
        });

        // Also cover any legacy bookings linked via facilityId without academyId
        const facIds = facSnap.docs.map((d: any) => d.id);
        for (let i = 0; i < facIds.length; i += 30) {
          const chunk = facIds.slice(i, i + 30);
          const byFacSnap = await adminDb
            .collection('bookings')
            .where('facilityId', 'in', chunk)
            .limit(200)
            .get();
          byFacSnap.docs.forEach((d: any) => {
            if (!bookingMap.has(d.id)) {
              bookingMap.set(d.id, { id: d.id, ...d.data() });
            }
          });
        }
      }

      bookings = Array.from(bookingMap.values());
    } else {
      const snap = await adminDb
        .collection('bookings')
        .where('userId', '==', session.uid)
        .limit(200)
        .get();
      bookings = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    }

    bookings.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(bookings);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to fetch bookings', 500);
  }
}

const Body = z.object({
  facilityId: z.string().min(1),
  facilityName: z.string().min(1),
  slot: z.string().min(1),
  price: z.number().min(0),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
  bookingType: z.enum(['full_court', 'match_invite']).default('full_court'),
  teamName: z.string().optional(),
  openSpots: z.number().int().min(0).max(30).optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended because the 5-day player verification deadline expired. Submit verification proof to book grounds.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', parsed.error.errors[0]?.message || 'Invalid booking payload', 400);
    }

    const { facilityId, facilityName, slot, price, bookingDate, bookingType, teamName, openSpots } =
      parsed.data;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = bookingDate || todayStr;
    if (targetDate < todayStr) {
      return fail('invalid', 'Cannot book a ground slot in the past.', 400);
    }

    const facilityRef = adminDb.collection('facilities').doc(facilityId);
    const slotLockId = `${facilityId}_${targetDate}_${slot}`;
    const slotLockRef = adminDb.collection('bookingSlots').doc(slotLockId);

    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userName = userDoc.data()?.fullName || session.email || 'Player';

    const transactionResult = await adminDb.runTransaction(async (transaction: any) => {
      const [facilitySnap, slotLockSnap] = await Promise.all([
        transaction.get(facilityRef),
        transaction.get(slotLockRef),
      ]);

      if (!facilitySnap.exists) throw new Error('FACILITY_NOT_FOUND');

      const facilityData = facilitySnap.data();
      if (facilityData.closed) throw new Error('FACILITY_CLOSED');

      const slots = facilityData.slots || {};
      if (slots[slot] === false && targetDate === todayStr) {
        throw new Error('SLOT_TAKEN');
      }
      if (slotLockSnap.exists && slotLockSnap.data()?.active === true) {
        throw new Error('SLOT_TAKEN');
      }

      const verifiedPrice = typeof facilityData.price === 'number' ? facilityData.price : price;
      const bookingRef = adminDb.collection('bookings').doc();
      const bookingCode = generateBookingCode();
      const qrToken = generateQrToken();
      const qrPayload = createSignedQrPayload(bookingRef.id, qrToken);
      const now = Date.now();

      transaction.set(bookingRef, {
        bookingCode,
        qrToken,
        qrPayload,
        userId: session.uid,
        userName,
        userEmail: session.email || '',
        facilityId,
        facilityName: facilityData.name || facilityName,
        academyId: facilityData.academyId || null,
        sport: facilityData.sport || 'Sport',
        slot,
        bookingDate: targetDate,
        bookingType,
        teamName: teamName || '',
        openSpots: openSpots || 0,
        price: verifiedPrice,
        paymentStatus: 'unpaid',
        paymentNote: 'Pay at venue — online payment gateway not configured',
        status: 'confirmed',
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(slotLockRef, {
        facilityId,
        bookingDate: targetDate,
        slot,
        bookingId: bookingRef.id,
        userId: session.uid,
        active: true,
        createdAt: now,
      });

      if (targetDate === todayStr) {
        transaction.update(facilityRef, {
          [`slots.${slot}`]: false,
        });
      }

      return {
        bookingId: bookingRef.id,
        bookingCode,
        qrPayload,
        slot,
        bookingDate: targetDate,
        price: verifiedPrice,
        facilityName: facilityData.name || facilityName,
        academyId: facilityData.academyId,
      };
    });

    const qrDataUrl = await QRCode.toDataURL(transactionResult.qrPayload, {
      width: 220,
      margin: 1,
    });
    await adminDb.collection('bookings').doc(transactionResult.bookingId).update({ qrDataUrl });

    await dispatchNotification({
      title: 'Court Booking Confirmed',
      message: `Booking ${transactionResult.bookingCode} at ${transactionResult.facilityName} on ${transactionResult.bookingDate} (${slot}:00) is confirmed. Present your QR pass at check-in.`,
      category: 'academy',
      targetRole: 'player',
      recipientId: session.uid,
      targetUserId: session.uid,
      link: '/player',
      idempotencyKey: `notif_booking_${transactionResult.bookingId}`,
    });

    if (transactionResult.academyId) {
      await dispatchNotification({
        title: `New Court Booking (${transactionResult.bookingCode})`,
        message: `${userName} booked ${transactionResult.facilityName} on ${transactionResult.bookingDate} at ${slot}:00.`,
        category: 'academy',
        targetRole: 'academy',
        recipientId: transactionResult.academyId,
        targetUserId: transactionResult.academyId,
        link: '/academy',
        idempotencyKey: `notif_booking_acad_${transactionResult.bookingId}`,
      });
    }

    await logActivity({
      userId: session.uid,
      userName,
      action: 'booking_created',
      entityType: 'booking',
      entityId: transactionResult.bookingId,
      details: `Booked ${transactionResult.facilityName} (${transactionResult.bookingCode}) on ${transactionResult.bookingDate} slot ${slot}:00 (₹${transactionResult.price}, unpaid/pay-at-venue)`,
    });

    return ok({ success: true, ...transactionResult, qrDataUrl });
  } catch (e: any) {
    if (e?.message === 'FACILITY_NOT_FOUND') {
      return fail('not_found', 'Facility ground not found', 404);
    }
    if (e?.message === 'FACILITY_CLOSED') {
      return fail('closed', 'This facility is temporarily closed for bookings', 400);
    }
    if (e?.message === 'SLOT_TAKEN') {
      return fail('slot_taken', 'This time slot was just booked by another player. Please select another slot.', 409);
    }
    console.error('Booking transaction error:', e);
    return fail('server_error', e?.message || 'Failed to complete booking transaction', 500);
  }
}

const CancelSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = CancelSchema.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid cancellation request', 400);

  const { bookingId, reason } = parsed.data;
  const adminUser = await isAdmin(session.uid);
  const bookingRef = adminDb.collection('bookings').doc(bookingId);
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const result = await adminDb.runTransaction(async (tx: any) => {
      const bSnap = await tx.get(bookingRef);
      if (!bSnap.exists) throw new Error('NOT_FOUND');

      const b = bSnap.data();
      if (b.userId !== session.uid && b.academyId !== session.uid && !adminUser) {
        throw new Error('FORBIDDEN');
      }
      if (b.status === 'cancelled') throw new Error('ALREADY_CANCELLED');
      if (b.status === 'checked_in' || b.status === 'completed') {
        throw new Error('CANNOT_CANCEL_ATTENDED');
      }

      const now = Date.now();
      tx.update(bookingRef, {
        status: 'cancelled',
        cancellationReason: reason || 'Cancelled by user',
        cancelledAt: now,
        cancelledBy: session.uid,
        updatedAt: now,
      });

      if (b.facilityId && b.slot && b.bookingDate) {
        const slotLockRef = adminDb
          .collection('bookingSlots')
          .doc(`${b.facilityId}_${b.bookingDate}_${b.slot}`);
        const lockSnap = await tx.get(slotLockRef);
        if (lockSnap.exists) {
          tx.update(slotLockRef, { active: false, releasedAt: now });
        }
      }

      if (b.facilityId && b.slot && (!b.bookingDate || b.bookingDate === todayStr)) {
        const facRef = adminDb.collection('facilities').doc(b.facilityId);
        const facSnap = await tx.get(facRef);
        if (facSnap.exists) {
          tx.update(facRef, { [`slots.${b.slot}`]: true });
        }
      }

      return b;
    });

    await dispatchNotification({
      title: 'Court Booking Cancelled',
      message: `Booking ${result.bookingCode || bookingId} for ${result.facilityName} (${result.bookingDate} at ${result.slot}:00) has been cancelled.`,
      category: 'academy',
      targetRole: 'player',
      recipientId: result.userId,
      targetUserId: result.userId,
      link: '/player',
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'User',
      action: 'booking_cancelled',
      entityType: 'booking',
      entityId: bookingId,
      details: `Cancelled booking at ${result.facilityName} (${result.bookingDate} slot ${result.slot}:00)`,
    });

    return ok({ success: true, bookingId, status: 'cancelled' });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return fail('not_found', 'Booking not found', 404);
    if (e?.message === 'FORBIDDEN') return fail('forbidden', 'Not authorized to cancel this booking', 403);
    if (e?.message === 'ALREADY_CANCELLED') return fail('conflict', 'Booking is already cancelled', 409);
    if (e?.message === 'CANNOT_CANCEL_ATTENDED') {
      return fail('conflict', 'Checked-in or completed bookings cannot be cancelled.', 409);
    }
    return fail('server_error', e?.message || 'Failed to cancel booking', 500);
  }
}
