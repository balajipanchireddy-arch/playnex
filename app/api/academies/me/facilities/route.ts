import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
});

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const snap = await adminDb.collection('facilities').where('academyId', '==', session.uid).get();
    const facilities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(facilities);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    const { name, address, sport, price } = parsed.data;
    
    // Generate default time slots (6 AM to 10 PM)
    const defaultSlots: Record<string, boolean> = {};
    for (let i = 6; i <= 22; i++) defaultSlots[i.toString()] = true;

    await adminDb.collection('facilities').add({
      academyId: session.uid, name, address, sport, price,
      slots: defaultSlots, closed: false, createdAt: Date.now()
    });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const PatchBody = z.object({
  facilityId: z.string(),
  slot: z.string().optional(),
  available: z.boolean().optional(),
  price: z.number().optional(),
  closed: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    const { facilityId, slot, available, price, closed } = parsed.data;

    const updates: any = {};
    if (slot !== undefined && available !== undefined) updates[`slots.${slot}`] = available;
    if (price !== undefined) updates.price = price;
    if (closed !== undefined) updates.closed = closed;

    await adminDb.collection('facilities').doc(facilityId).update(updates);
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get('facilityId');
    if (!facilityId) return fail('invalid', 'Missing facilityId', 400);
    await adminDb.collection('facilities').doc(facilityId).delete();
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
