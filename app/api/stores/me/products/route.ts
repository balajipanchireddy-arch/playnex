import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

const Body = z.object({
  name: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
  qty: z.number().min(0),
  description: z.string().optional().default(''),
  category: z.string().optional().default('Equipment'),
  image: z.string().optional().default(''),
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
    const { name, sport, price, qty, description, category, image } = parsed.data;

    const storeDoc = await adminDb.collection('stores').doc(session.uid).get();
    const storeName = storeDoc.exists ? storeDoc.data()?.storeName : 'Verified Store';

    const docRef = await adminDb.collection('products').add({
      storeId: session.uid,
      storeName,
      name,
      sport,
      price,
      qty,
      description: description || '',
      category: category || 'Equipment',
      image: image || '',
      rating: 0,
      ratingCount: 0,
      createdAt: Date.now()
    });

    await logActivity({
      userId: session.uid,
      userName: storeName,
      action: 'product_created',
      entityType: 'order',
      entityId: docRef.id,
      details: `${storeName} added gear "${name}" (${sport}) at ₹${price}`,
    });

    // AUTOMATIC STORE-TO-PLAYER NOTIFICATION:
    // Only inform players interested in this sport if in stock
    if (qty > 0) {
      await dispatchNotification({
        title: `New Gear Available: ${name}`,
        message: `${storeName} added new ${sport} gear: ${name} (₹${price}). Check out the sports store!`,
        category: 'store',
        targetRole: 'player',
        targetSport: sport,
        link: '/player',
        senderName: storeName,
        idempotencyKey: `notif_product_added_${docRef.id}`,
      });
    }

    return ok({ success: true, id: docRef.id });
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

    const existing = prodSnap.data();
    const updates: any = {};
    if (qty !== undefined) updates.qty = Math.max(0, qty);
    if (price !== undefined) updates.price = price;

    await prodRef.update(updates);

    // If price dropped meaningfully, notify interested players
    if (price !== undefined && price < existing.price) {
      await dispatchNotification({
        title: `Price Drop: ${existing.name}`,
        message: `Special offer on ${existing.name}! Price dropped from ₹${existing.price} to ₹${price}.`,
        category: 'store',
        targetRole: 'player',
        targetSport: existing.sport,
        link: '/player',
        senderName: existing.storeName || 'Sports Store',
        idempotencyKey: `notif_price_drop_${productId}_${price}`,
      });
    }

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

    const prodData = prodSnap.data();
    const canDelete = await isStoreOrAdmin(session.uid);
    if (!canDelete || (prodData.storeId !== session.uid && !(await (async () => {
      const snap = await adminDb.collection('userRoles').where('userId', '==', session.uid).where('roleId', '==', 'admin').get();
      return !snap.empty;
    })()))) {
      return fail('forbidden', 'Unauthorized to delete this product', 403);
    }

    // Delete product document (orders retain snapshot copies for financial auditing)
    await prodRef.delete();

    await logActivity({
      userId: session.uid,
      userName: prodData.storeName || 'Sports Store',
      action: 'product_deleted',
      entityType: 'order',
      entityId: productId,
      details: `Removed product "${prodData.name}" (${prodData.sport}) from inventory`,
    });

    return ok({ success: true, productId, productName: prodData.name });
  } catch (e: any) {
    console.error('Failed to delete product:', e);
    return fail('server_error', e.message || 'Failed to delete product', 500);
  }
}
