import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb.collection('orders').where('storeId', '==', session.uid).get();
    const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return ok(orders);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const PatchBody = z.object({ orderId: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);

    const orderRef = adminDb.collection('orders').doc(parsed.data.orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return fail('not_found', 'Order not found', 404);
    if (orderSnap.data().storeId !== session.uid) return fail('forbidden', 'Unauthorized', 403);

    await orderRef.update({
      status: 'shipped',
      shippedAt: Date.now()
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
