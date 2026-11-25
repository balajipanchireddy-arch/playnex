import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { findUserStoreDoc } from '@/lib/stores/resolve';

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
          .collection('orders')
          .where('storeId', '==', requestedStoreId)
          .get();
      } else {
        snap = await adminDb.collection('orders').get();
      }
      const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      orders.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      return ok(orders);
    }

    const storeDoc = await findUserStoreDoc(session.uid);
    if (!storeDoc) {
      return ok([]);
    }

    const snap = await adminDb
      .collection('orders')
      .where('storeId', '==', storeDoc.id)
      .get();
    const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    orders.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(orders);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
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

    const orderData = orderSnap.data()!;
    const adminUser = await isAdmin(session.uid);

    if (!adminUser) {
      const storeDoc = await findUserStoreDoc(session.uid);
      if (!storeDoc || orderData.storeId !== storeDoc.id) {
        return fail('forbidden', 'Unauthorized', 403);
      }
    }

    await orderRef.update({
      status: 'shipped',
      shippedAt: Date.now(),
      shippedBy: session.uid,
    });

    const storeDoc = orderData.storeId
      ? await adminDb.collection('stores').doc(orderData.storeId).get()
      : null;
    const storeName = storeDoc?.exists
      ? storeDoc.data()?.storeName
      : 'PlayNex Sports Store';

    await logActivity({
      userId: session.uid,
      userName: adminUser ? `Admin (${storeName})` : storeName,
      action: 'order_shipped',
      entityType: 'order',
      entityId: parsed.data.orderId,
      details: `Dispatched order for "${orderData.productName}" to customer ${orderData.playerId}`,
    });

    await dispatchNotification({
      title: '📦 Order Dispatched!',
      message: `Great news! Your order for "${orderData.productName}" (Qty: ${orderData.qty || 1}) has been dispatched by ${storeName}.`,
      category: 'order',
      targetRole: 'player',
      targetUserId: orderData.playerId,
      link: '/player',
      senderName: storeName,
      idempotencyKey: `notif_order_shipped_${parsed.data.orderId}`,
    });

    return ok({ success: true });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
