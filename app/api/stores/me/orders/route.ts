import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

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
    
    const orderData = orderSnap.data();
    if (orderData.storeId !== session.uid) return fail('forbidden', 'Unauthorized', 403);

    await orderRef.update({
      status: 'shipped',
      shippedAt: Date.now()
    });

    // Read store name
    const storeDoc = await adminDb.collection('stores').doc(session.uid).get();
    const storeName = storeDoc.exists ? storeDoc.data()?.storeName : 'PlayNex Sports Store';

    await logActivity({
      userId: session.uid,
      userName: storeName,
      action: 'order_shipped',
      entityType: 'order',
      entityId: parsed.data.orderId,
      details: `Dispatched order for "${orderData.productName}" to customer ${orderData.playerId}`,
    });

    // AUTOMATIC STORE-TO-PLAYER NOTIFICATION:
    // Only notify the customer who placed this specific order
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
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
