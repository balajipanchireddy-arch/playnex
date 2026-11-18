import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({ facilityId: z.string(), facilityName: z.string(), slot: z.string(), price: z.number() });

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { facilityId, facilityName, slot, price } = parsed.data;
    
    // 1. Create the booking
    await adminDb.collection('bookings').add({
      userId: session.uid,
      facilityId, facilityName, slot, price,
      status: 'confirmed', createdAt: Date.now()
    });

    // 2. Mark the slot as unavailable (false) on the facility
    await adminDb.collection('facilities').doc(facilityId).update({
      [`slots.${slot}`]: false
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
