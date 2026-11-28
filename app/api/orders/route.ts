import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb
      .collection('orders')
      .where('playerId', '==', session.uid)
      .get();
    const orders = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    orders.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(orders);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load orders', 500);
  }
}

const Body = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  storeId: z.string().min(1),
  price: z.number().min(0),
  qty: z.number().int().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired 5-day verification. Submit proof to place store orders.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);

    const { productId, productName, storeId, qty } = parsed.data;
    const productRef = adminDb.collection('products').doc(productId);

    const transactionResult = await adminDb.runTransaction(async (transaction: any) => {
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const productData = productSnap.data();
      if (productData.allowPurchase === false) {
        throw new Error('RENTAL_ONLY');
      }

      const currentQty = typeof productData.qty === 'number' ? productData.qty : 0;
      const authoritativePrice = typeof productData.price === 'number' ? productData.price : 0;
      const verifiedStoreId = productData.storeId || storeId;

      if (currentQty < qty) {
        if (currentQty === 0) {
          throw new Error('OUT_OF_STOCK');
        } else {
          throw new Error(`INSUFFICIENT_STOCK:${currentQty}`);
        }
      }

      const remainingQty = currentQty - qty;
      transaction.update(productRef, { qty: remainingQty, updatedAt: Date.now() });

      const orderRef = adminDb.collection('orders').doc();
      const now = Date.now();
      const orderData = {
        playerId: session.uid,
        playerEmail: session.email || '',
        storeId: verifiedStoreId,
        storeName: productData.storeName || 'Verified Store',
        productId,
        productName: productData.name || productName,
        price: authoritativePrice,
        qty,
        total: authoritativePrice * qty,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentNote: 'Pay on delivery / at store — online payment gateway not configured',
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(orderRef, orderData);

      return {
        orderId: orderRef.id,
        remainingQty,
        total: authoritativePrice * qty,
        productName: productData.name || productName,
        storeId: verifiedStoreId,
        storeName: productData.storeName || 'Verified Store',
      };
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Customer',
      action: 'order_created',
      entityType: 'order',
      entityId: transactionResult.orderId,
      details: `Placed purchase order for ${qty}x ${transactionResult.productName} (Total: ₹${transactionResult.total}, payment: unpaid)`,
    });

    await dispatchNotification({
      title: 'Order Placed (Payment Pending)',
      message: `Your order for "${transactionResult.productName}" (Qty: ${qty}, ₹${transactionResult.total}) was placed with ${transactionResult.storeName}. Payment status: Unpaid (pay on delivery/pickup).`,
      category: 'order',
      targetRole: 'player',
      recipientId: session.uid,
      targetUserId: session.uid,
      link: '/player',
      senderName: transactionResult.storeName,
      idempotencyKey: `notif_order_placed_${transactionResult.orderId}`,
    });

    if (transactionResult.storeId) {
      await dispatchNotification({
        title: `New Store Order: ${transactionResult.productName}`,
        message: `New order for ${qty}x ${transactionResult.productName} (₹${transactionResult.total}).`,
        category: 'order',
        targetRole: 'store',
        recipientId: transactionResult.storeId,
        targetUserId: transactionResult.storeId,
        link: '/store',
        idempotencyKey: `notif_order_store_${transactionResult.orderId}`,
      });
    }

    return ok({ success: true, ...transactionResult, paymentStatus: 'unpaid' });
  } catch (e: any) {
    if (e?.message === 'PRODUCT_NOT_FOUND') {
      return fail('not_found', 'Product not found in store catalog', 404);
    }
    if (e?.message === 'RENTAL_ONLY') {
      return fail('invalid', 'This product is available for rental only.', 400);
    }
    if (e?.message === 'OUT_OF_STOCK') {
      return fail('out_of_stock', 'This product is currently out of stock', 400);
    }
    if (e?.message?.startsWith('INSUFFICIENT_STOCK:')) {
      const available = e.message.split(':')[1];
      return fail('out_of_stock', `Insufficient stock. Only ${available} item(s) left.`, 400);
    }
    console.error('Order transaction error:', e);
    return fail('server_error', e?.message || 'Failed to process order', 500);
  }
}
