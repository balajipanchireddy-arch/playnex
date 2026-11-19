import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  storeId: z.string().min(1),
  price: z.number().min(0),
  qty: z.number().min(1),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    
    const { productId, productName, storeId, qty } = parsed.data;
    const productRef = adminDb.collection('products').doc(productId);

    // Atomic transaction ensuring zero race conditions during concurrent checkouts
    const transactionResult = await adminDb.runTransaction(async (transaction: any) => {
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const productData = productSnap.data();
      const currentQty = typeof productData.qty === 'number' ? productData.qty : 0;
      
      // Authoritative pricing from database to prevent client-side price manipulation
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

      // Atomically decrement stock
      transaction.update(productRef, { qty: remainingQty });

      // Create confirmed order
      const orderRef = adminDb.collection('orders').doc();
      transaction.set(orderRef, {
        playerId: session.uid,
        storeId: verifiedStoreId,
        productId,
        productName: productData.name || productName,
        price: authoritativePrice,
        qty,
        total: authoritativePrice * qty,
        status: 'pending',
        createdAt: Date.now(),
      });

      return {
        orderId: orderRef.id,
        remainingQty,
        total: authoritativePrice * qty,
      };
    });

    return ok({ success: true, ...transactionResult });
  } catch (e: any) { 
    if (e?.message === 'PRODUCT_NOT_FOUND') {
      return fail('not_found', 'Product not found in store catalog', 404);
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
