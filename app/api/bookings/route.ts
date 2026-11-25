import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

/**
 * Court Bookings API
 *
 * GET   /api/bookings — List caller's bookings (or academy/all bookings if academy/admin)
 * POST  /api/bookings — Atomically book a court slot (Method A / Method C)
 * PATCH /api/bookings — Cancel a booking and atomically release the slot
 */

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope'); // 'academy' | 'all' | undefined

  try {
    const adminUser = await isAdmin(session.uid);
    let snap;

    if (scope === 'all' && adminUser) {
      snap = await adminDb.collection('bookings').get();
    } else if (scope === 'academy') {
      const facSnap = await adminDb
        .collection('facilities')
        .where('academyId', '==', session.uid)
        .get();
      const facIds = new Set(facSnap.docs.map((d: any) => d.id));
      const allSnap = await adminDb.collection('bookings').get();
      const filtered = allSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((b: any) => facIds.has(b.facilityId));
      filtered.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      return ok(filtered);
    } else {
      snap = await adminDb
        .collection('bookings')
        .where('userId', '==', session.uid)
        .get();
    }

    const bookings = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
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
  bookingDate: z.string().optional(),
  bookingType: z.enum(['full_court', 'match_invite']).default('full_court'),
  teamName: z.string().optional(),
  openSpots: z.number().int().min(0).max(30).optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);

    const { facilityId, facilityName, slot, price, bookingDate, bookingType, teamName, openSpots } = parsed.data;
    const facilityRef = adminDb.collection('facilities').doc(facilityId);

    const transactionResult = await adminDb.runTransaction(async (transaction: any) => {
      const facilitySnap = await transaction.get(facilityRef);
      if (!facilitySnap.exists) throw new Error('FACILITY_NOT_FOUND');

      const facilityData = facilitySnap.data();
      if (facilityData.closed) throw new Error('FACILITY_CLOSED');

      const slots = facilityData.slots || {};
      if (slots[slot] === false) throw new Error('SLOT_TAKEN');

      const verifiedPrice = typeof facilityData.price === 'number' ? facilityData.price : price;
      const bookingRef = adminDb.collection('bookings').doc();
      const now = Date.now();

      transaction.set(bookingRef, {
        userId: session.uid,
        userEmail: session.email || '',
        facilityId,
        facilityName: facilityData.name || facilityName,
        academyId: facilityData.academyId || null,
        sport: facilityData.sport || 'Sport',
        slot,
        bookingDate: bookingDate || new Date().toISOString().split('T')[0],
        bookingType,
        teamName: teamName || '',
        openSpots: openSpots || 0,
        price: verifiedPrice,
        status: 'confirmed',
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(facilityRef, {
        [`slots.${slot}`]: false,
      });

      return {
        bookingId: bookingRef.id,
        slot,
        price: verifiedPrice,
        facilityName: facilityData.name || facilityName,
        academyId: facilityData.academyId,
      };
    });

    await dispatchNotification({
      title: 'Court Booking Confirmed',
      message: `Your slot (${slot}:00) at ${transactionResult.facilityName} is confirmed (₹${transactionResult.price}).`,
      category: 'academy',
      targetRole: 'player',
      targetUserId: session.uid,
      link: '/player',
      idempotencyKey: `notif_booking_${transactionResult.bookingId}`,
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Player',
      action: 'booking_created',
      entityType: 'booking',
      entityId: transactionResult.bookingId,
      details: `Booked ${transactionResult.facilityName} at slot ${slot}:00 for ₹${transactionResult.price}`,
    });

    return ok({ success: true, ...transactionResult });
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

  try {
    const result = await adminDb.runTransaction(async (tx: any) => {
      const bSnap = await tx.get(bookingRef);
      if (!bSnap.exists) throw new Error('NOT_FOUND');

      const b = bSnap.data();
      if (b.userId !== session.uid && b.academyId !== session.uid && !adminUser) {
        throw new Error('FORBIDDEN');
      }
      if (b.status === 'cancelled') throw new Error('ALREADY_CANCELLED');

      const now = Date.now();
      tx.update(bookingRef, {
        status: 'cancelled',
        cancellationReason: reason || 'Cancelled by user',
        cancelledAt: now,
        updatedAt: now,
      });

      if (b.facilityId && b.slot) {
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
      message: `Booking for ${result.facilityName} (slot ${result.slot}:00) has been cancelled.`,
      category: 'academy',
      targetRole: 'player',
      targetUserId: result.userId,
      link: '/player',
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'User',
      action: 'booking_cancelled',
      entityType: 'booking',
      entityId: bookingId,
      details: `Cancelled booking at ${result.facilityName} (slot ${result.slot}:00)`,
    });

    return ok({ success: true, bookingId, status: 'cancelled' });
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return fail('not_found', 'Booking not found', 404);
    if (e?.message === 'FORBIDDEN') return fail('forbidden', 'Not authorized to cancel this booking', 403);
    if (e?.message === 'ALREADY_CANCELLED') return fail('conflict', 'Booking is already cancelled', 409);
    return fail('server_error', e?.message || 'Failed to cancel booking', 500);
  }
}
