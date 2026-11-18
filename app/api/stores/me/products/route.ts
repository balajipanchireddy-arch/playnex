import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  name: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
  qty: z.number().min(0),
});

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb.collection('products').where('storeId', '==', session.uid).get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(products);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { name, sport, price, qty } = parsed.data;
    
    // Get the store to attach the storeName
    const storeDoc = await adminDb.collection('stores').doc(session.uid).get();
    const storeName = storeDoc.exists ? storeDoc.data()?.storeName : 'Unknown Store';

    await adminDb.collection('products').add({
      storeId: session.uid,
      storeName,
      name, sport, price, qty,
      createdAt: Date.now()
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
