import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  facilityId: z.string().min(1),
  facilityName: z.string().min(1),
  slot: z.string().min(1),
  price: z.number().min(0),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    
    const { facilityId, facilityName, slot, price } = parsed.data;
    const facilityRef = adminDb.collection('facilities').doc(facilityId);

    // Execute atomic Firestore transaction to prevent race conditions during concurrent booking
    const transactionResult = await adminDb.runTransaction(async (transaction: any) => {
      const facilitySnap = await transaction.get(facilityRef);
      
      if (!facilitySnap.exists) {
        throw new Error('FACILITY_NOT_FOUND');
      }

      const facilityData = facilitySnap.data();

      // Verify venue is open
      if (facilityData.closed) {
        throw new Error('FACILITY_CLOSED');
      }

      // Verify slot availability in facility schedule
      const slots = facilityData.slots || {};
      if (slots[slot] === false) {
        throw new Error('SLOT_TAKEN');
      }

      // Check authoritative price from DB to avoid client price tampering
      const verifiedPrice = typeof facilityData.price === 'number' ? facilityData.price : price;

      // Create new booking document reference
      const bookingRef = adminDb.collection('bookings').doc();

      transaction.set(bookingRef, {
        userId: session.uid,
        facilityId,
        facilityName: facilityData.name || facilityName,
        slot,
        price: verifiedPrice,
        status: 'confirmed',
        createdAt: Date.now(),
      });

      // Atomically mark slot as unavailable
      transaction.update(facilityRef, {
        [`slots.${slot}`]: false,
      });

      return { bookingId: bookingRef.id, slot, price: verifiedPrice };
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
