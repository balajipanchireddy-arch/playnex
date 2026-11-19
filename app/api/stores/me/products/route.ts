import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  name: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
  qty: z.number().min(0)
});

async function isStoreOrAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  const roles = snap.docs.map((d: any) => d.data().roleId);
  return roles.includes('admin') || roles.includes('store');
}

export async function GET() {
  const session = await verifySession(); 
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const snap = await adminDb.collection('products').where('storeId', '==', session.uid).get();
    return ok(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(); 
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!(await isStoreOrAdmin(session.uid))) {
    return fail('forbidden', 'Sports store partner permissions required', 403);
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { name, sport, price, qty } = parsed.data;
    
    const storeDoc = await adminDb.collection('stores').doc(session.uid).get();
    const storeName = storeDoc.exists ? storeDoc.data()?.storeName : 'Verified Store';

    await adminDb.collection('products').add({ 
      storeId: session.uid, 
      storeName, 
      name, 
      sport, 
      price, 
      qty,
      rating: 0,
      ratingCount: 0,
      createdAt: Date.now() 
    });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const PatchBody = z.object({ 
  productId: z.string().min(1), 
  qty: z.number().optional(), 
  price: z.number().optional() 
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession(); 
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { productId, qty, price } = parsed.data;

    const prodRef = adminDb.collection('products').doc(productId);
    const prodSnap = await prodRef.get();
    if (!prodSnap.exists) return fail('not_found', 'Product not found', 404);
    if (prodSnap.data().storeId !== session.uid) return fail('forbidden', 'Unauthorized to modify this product', 403);

    const updates: any = {};
    if (qty !== undefined) updates.qty = Math.max(0, qty);
    if (price !== undefined) updates.price = price;
    
    await prodRef.update(updates);
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(); 
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    if (!productId) return fail('invalid', 'Missing productId', 400);

    const prodRef = adminDb.collection('products').doc(productId);
    const prodSnap = await prodRef.get();
    if (!prodSnap.exists) return fail('not_found', 'Product not found', 404);
    if (prodSnap.data().storeId !== session.uid) return fail('forbidden', 'Unauthorized to delete this product', 403);

    await prodRef.delete();
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
