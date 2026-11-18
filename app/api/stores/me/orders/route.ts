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
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(orders);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const PatchBody = z.object({ orderId: z.string() });

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);

    await adminDb.collection('orders').doc(parsed.data.orderId).update({
      status: 'shipped'
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
