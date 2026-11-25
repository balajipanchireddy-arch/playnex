import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { findUserStoreDoc } from '@/lib/stores/resolve';

const Body = z.object({
  name: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
  qty: z.number().min(0),
  description: z.string().optional().default(''),
  category: z.string().optional().default('Equipment'),
  image: z.string().optional().default(''),
  storeId: z.string().optional(),
});

async function isStoreOrAdmin(uid: string) {
  if (await isAdmin(uid)) return true;
  const snap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  const roles = snap.docs.map((d: any) => d.data().roleId);
  return roles.includes('admin') || roles.includes('store');
}

async function isApprovedStore(uid: string): Promise<boolean> {
  const storeDoc = await findUserStoreDoc(uid);
  return Boolean(storeDoc && storeDoc.data()?.verificationStatus === 'approved');
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const requestedStoreId = searchParams.get('storeId');

  try {
    const adminUser = await isAdmin(session.uid);

    if (adminUser) {
      let snap;
      if (requestedStoreId && requestedStoreId !== 'all') {
        snap = await adminDb
          .collection('products')
          .where('storeId', '==', requestedStoreId)
          .get();
      } else {
        snap = await adminDb.collection('products').get();
      }
      const products = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      products.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      return ok(products);
    }

    const storeDoc = await findUserStoreDoc(session.uid);
    if (!storeDoc) {
      return ok([]);
    }

    const snap = await adminDb
      .collection('products')
      .where('storeId', '==', storeDoc.id)
      .get();

    const products = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    products.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(products);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const adminUser = await isAdmin(session.uid);
  if (!adminUser && !(await isApprovedStore(session.uid))) {
    return fail(
      'forbidden',
      'Your store must be approved by PlayNex Admin before adding products.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { name, sport, price, qty, description, category, image, storeId } = parsed.data;

    let targetStoreId = session.uid;
    let storeName = 'PlayNex Official Store';

    if (adminUser && storeId) {
      const targetDoc = await adminDb.collection('stores').doc(storeId).get();
      if (!targetDoc.exists) {
        return fail('not_found', 'Selected store not found', 404);
      }
      targetStoreId = targetDoc.id;
      storeName = targetDoc.data()?.storeName || 'Verified Store';
    } else if (!adminUser) {
      const callerStore = await findUserStoreDoc(session.uid);
      if (!callerStore) {
        return fail('not_found', 'Store profile not found', 404);
      }
      targetStoreId = callerStore.id;
      storeName = callerStore.data()?.storeName || 'Verified Store';
    } else {
      // Admin adding without selecting a specific store: attach to first existing store if any, or 'playnex_admin_store'
      const anyStore = await adminDb.collection('stores').limit(1).get();
      if (!anyStore.empty) {
        targetStoreId = anyStore.docs[0].id;
        storeName = anyStore.docs[0].data()?.storeName || 'PlayNex Store';
      }
    }

    const docRef = await adminDb.collection('products').add({
      storeId: targetStoreId,
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
      createdAt: Date.now(),
    });

    await logActivity({
      userId: session.uid,
      userName: storeName,
      action: 'product_created',
      entityType: 'order',
      entityId: docRef.id,
      details: `${storeName} added gear "${name}" (${sport}) at ₹${price}`,
    });

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
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const PatchBody = z.object({
  productId: z.string().min(1),
  qty: z.number().optional(),
  price: z.number().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const adminUser = await isAdmin(session.uid);
  if (!adminUser && !(await isApprovedStore(session.uid))) {
    return fail(
      'forbidden',
      'Your store must be approved by PlayNex Admin before editing products.',
      403
    );
  }

  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { productId, qty, price } = parsed.data;

    const prodRef = adminDb.collection('products').doc(productId);
    const prodSnap = await prodRef.get();
    if (!prodSnap.exists) return fail('not_found', 'Product not found', 404);

    const existing = prodSnap.data()!;
    if (!adminUser) {
      const callerStore = await findUserStoreDoc(session.uid);
      if (!callerStore || existing.storeId !== callerStore.id) {
        return fail('forbidden', 'Unauthorized to modify this product', 403);
      }
    }

    const updates: any = { updatedAt: Date.now() };
    if (qty !== undefined) updates.qty = Math.max(0, qty);
    if (price !== undefined) updates.price = price;

    await prodRef.update(updates);

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
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
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

    const prodData = prodSnap.data()!;
    const canDelete = await isStoreOrAdmin(session.uid);
    const adminUser = await isAdmin(session.uid);

    if (!adminUser) {
      const callerStore = await findUserStoreDoc(session.uid);
      if (!canDelete || !callerStore || prodData.storeId !== callerStore.id) {
        return fail('forbidden', 'Unauthorized to delete this product', 403);
      }
    }

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
