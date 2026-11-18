import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  productId: z.string(),
  productName: z.string(),
  storeId: z.string(),
  price: z.number(),
  qty: z.number().min(1)
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { productId, productName, storeId, price, qty } = parsed.data;
    
    await adminDb.collection('orders').add({
      playerId: session.uid,
      storeId,
      productId,
      productName,
      price,
      qty,
      total: price * qty,
      status: 'pending',
      createdAt: Date.now()
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
