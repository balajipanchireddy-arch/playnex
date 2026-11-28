import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { findUserStoreDoc } from '@/lib/stores/resolve';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

/**
 * Sports Gear Rentals API
 *
 * GET   /api/rentals  — Player's rentals or ?scope=store for store/admin management
 * POST  /api/rentals  — Create rental with transactional overlap prevention & optional private proof
 * PATCH /api/rentals  — Update rental status (active/returned/overdue/cancelled) & deposit status
 */

const ALLOWED_PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');
  const requestedStoreId = searchParams.get('storeId');

  try {
    const adminUser = await isAdmin(session.uid);
    let snap;

    if (scope === 'store') {
      if (adminUser) {
        snap =
          requestedStoreId && requestedStoreId !== 'all'
            ? await adminDb.collection('rentals').where('storeId', '==', requestedStoreId).get()
            : await adminDb.collection('rentals').get();
      } else {
        const storeDoc = await findUserStoreDoc(session.uid);
        if (!storeDoc) return ok([]);
        snap = await adminDb.collection('rentals').where('storeId', '==', storeDoc.id).get();
      }
    } else {
      snap = await adminDb.collection('rentals').where('playerId', '==', session.uid).get();
    }

    const rentals = snap.docs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        privateDocUrl: data.privateDocId ? `/api/documents/${data.privateDocId}` : null,
      };
    });
    rentals.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(rentals);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to fetch rentals', 500);
  }
}

const CreateRentalBody = z.object({
  productId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  qty: z.number().int().min(1).max(10).default(1),
  proofFileName: z.string().max(150).optional(),
  proofMimeType: z.string().max(80).optional(),
  proofDataBase64: z.string().max(1_050_000).optional(),
});

function datesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired verification. Submit verification proof to rent gear.',
      403
    );
  }

  const parsed = CreateRentalBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid rental payload', 400);
  }

  const { productId, startDate, returnDate, qty, proofFileName, proofMimeType, proofDataBase64 } =
    parsed.data;

  const todayStr = new Date().toISOString().split('T')[0];
  if (startDate < todayStr) {
    return fail('invalid', 'Rental start date cannot be in the past.', 400);
  }
  if (returnDate < startDate) {
    return fail('invalid', 'Return date must be on or after start date.', 400);
  }

  const startMs = new Date(startDate).getTime();
  const returnMs = new Date(returnDate).getTime();
  const durationDays = Math.max(1, Math.round((returnMs - startMs) / 86400000) + 1);
  if (durationDays > 60) {
    return fail('invalid', 'Maximum rental duration is 60 days.', 400);
  }

  let privateDocRef: FirebaseFirestore.DocumentReference | null = null;
  let transactionCommitted = false;

  try {
    const productRef = adminDb.collection('products').doc(productId);
    const preProdSnap = await productRef.get();
    if (!preProdSnap.exists) return fail('not_found', 'Product not found', 404);
    const preProd = preProdSnap.data()!;

    let privateDocId: string | null = null;
    if (preProd.requiresIdProof) {
      if (!proofDataBase64 || !proofMimeType) {
        return fail('invalid', 'ID proof is required to rent this equipment.', 400);
      }
      if (!ALLOWED_PROOF_MIME.includes(proofMimeType)) {
        return fail('invalid', 'Proof file must be JPEG, PNG, WebP, or PDF.', 400);
      }
      const cleanBase64 = proofDataBase64.includes(',')
        ? proofDataBase64.split(',')[1]
        : proofDataBase64;

      let resolvedStoreOwnerId: string | null = preProd.storeId || null;
      if (preProd.storeId) {
        const storeSnap = await adminDb.collection('stores').doc(preProd.storeId).get();
        if (storeSnap.exists && storeSnap.data()?.ownerUserId) {
          resolvedStoreOwnerId = storeSnap.data()!.ownerUserId;
        }
      }

      privateDocRef = adminDb.collection('privateVerificationDocs').doc();
      await privateDocRef.set({
        ownerId: session.uid,
        storeId: preProd.storeId || null,
        storeOwnerId: resolvedStoreOwnerId,
        purpose: 'rental_proof',
        entityId: productId,
        fileName: (proofFileName || 'rental_proof').replace(/[^a-zA-Z0-9._-]/g, '_'),
        mimeType: proofMimeType,
        base64Data: cleanBase64,
        createdAt: Date.now(),
      });
      privateDocId = privateDocRef.id;
    }

    const txResult = await adminDb.runTransaction(async (tx: any) => {
      const prodSnap = await tx.get(productRef);
      if (!prodSnap.exists) throw new Error('PRODUCT_NOT_FOUND');
      const prod = prodSnap.data()!;

      if (!prod.allowRental) throw new Error('RENTAL_DISABLED');

      const totalRentalQty =
        typeof prod.rentalQty === 'number' ? prod.rentalQty : typeof prod.qty === 'number' ? prod.qty : 0;
      if (totalRentalQty < qty) throw new Error('INSUFFICIENT_RENTAL_INVENTORY');

      const rentalsQuery = adminDb
        .collection('rentals')
        .where('productId', '==', productId);
      const existingRentalsSnap = await tx.get(rentalsQuery);

      let overlappingReserved = 0;
      existingRentalsSnap.docs.forEach((d: any) => {
        const r = d.data();
        if (['pending', 'active', 'overdue'].includes(r.status)) {
          if (datesOverlap(startDate, returnDate, r.startDate, r.returnDate)) {
            overlappingReserved += Number(r.qty || 1);
          }
        }
      });

      if (overlappingReserved + qty > totalRentalQty) {
        throw new Error(`OVERLAPPING_RENTAL:${Math.max(0, totalRentalQty - overlappingReserved)}`);
      }

      const dailyRate = Number(prod.rentalPricePerDay || 0);
      const securityDeposit = Number(prod.securityDeposit || 0) * qty;
      const rentalSubtotal = dailyRate * durationDays * qty;
      const now = Date.now();

      const rentalRef = adminDb.collection('rentals').doc();
      const rentalData = {
        productId,
        productName: prod.name,
        storeId: prod.storeId,
        storeName: prod.storeName || 'Verified Store',
        playerId: session.uid,
        playerEmail: session.email || '',
        qty,
        startDate,
        returnDate,
        durationDays,
        rentalPricePerDay: dailyRate,
        rentalSubtotal,
        securityDeposit,
        totalDue: rentalSubtotal + securityDeposit,
        depositStatus: securityDeposit > 0 ? 'held' : 'none',
        paymentStatus: 'unpaid',
        paymentNote: 'Pay at pickup — online payment gateway not configured',
        privateDocId,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      tx.set(rentalRef, rentalData);
      return { id: rentalRef.id, ...rentalData };
    });
    transactionCommitted = true;

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Player',
      action: 'rental_created',
      entityType: 'rental',
      entityId: txResult.id,
      details: `Requested rental of ${qty}x ${txResult.productName} (${startDate} to ${returnDate}, ₹${txResult.rentalSubtotal} + ₹${txResult.securityDeposit} deposit, unpaid)`,
    });

    await dispatchNotification({
      title: 'Gear Rental Request Placed',
      message: `Your rental for ${txResult.productName} (${startDate} to ${returnDate}) is pending pickup. Rental: ₹${txResult.rentalSubtotal}${txResult.securityDeposit ? ` + Deposit: ₹${txResult.securityDeposit}` : ''}. Payment: Unpaid.`,
      category: 'rental',
      targetRole: 'player',
      recipientId: session.uid,
      targetUserId: session.uid,
      link: '/player',
      senderName: txResult.storeName,
      idempotencyKey: `notif_rental_created_${txResult.id}`,
    });

    if (txResult.storeId) {
      await dispatchNotification({
        title: `New Gear Rental Request: ${txResult.productName}`,
        message: `${session.email || 'A player'} requested ${qty}x ${txResult.productName} from ${startDate} to ${returnDate}.`,
        category: 'rental',
        targetRole: 'store',
        recipientId: txResult.storeId,
        targetUserId: txResult.storeId,
        link: '/store',
        idempotencyKey: `notif_rental_store_${txResult.id}`,
      });
    }

    return ok(txResult, 201);
  } catch (e: any) {
    if (privateDocRef && !transactionCommitted) {
      await privateDocRef.delete().catch(() => {});
    }
    if (e?.message === 'PRODUCT_NOT_FOUND') return fail('not_found', 'Product not found', 404);
    if (e?.message === 'RENTAL_DISABLED') return fail('invalid', 'Rental is not enabled for this product.', 400);
    if (e?.message === 'INSUFFICIENT_RENTAL_INVENTORY') {
      return fail('out_of_stock', 'Not enough rental units configured for this item.', 409);
    }
    if (e?.message?.startsWith('OVERLAPPING_RENTAL:')) {
      const avail = e.message.split(':')[1];
      return fail('overlap', `Selected dates overlap with existing rentals. Only ${avail} unit(s) available for those dates.`, 409);
    }
    return fail('server_error', e?.message || 'Failed to create rental', 500);
  }
}

const PatchRentalBody = z.object({
  rentalId: z.string().min(1),
  status: z.enum(['pending', 'active', 'returned', 'overdue', 'cancelled']),
  depositStatus: z.enum(['none', 'held', 'released', 'deducted']).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = PatchRentalBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid rental update payload', 400);

  const { rentalId, status, depositStatus } = parsed.data;

  try {
    const rentalRef = adminDb.collection('rentals').doc(rentalId);
    const snap = await rentalRef.get();
    if (!snap.exists) return fail('not_found', 'Rental record not found', 404);

    const rental = snap.data()!;
    const adminUser = await isAdmin(session.uid);
    const storeDoc = adminUser ? null : await findUserStoreDoc(session.uid);
    const isStoreOwner = Boolean(storeDoc && storeDoc.id === rental.storeId);
    const isPlayerCancellingPending =
      rental.playerId === session.uid && status === 'cancelled' && rental.status === 'pending';

    if (!adminUser && !isStoreOwner && !isPlayerCancellingPending) {
      return fail('forbidden', 'Not authorized to update this rental', 403);
    }

    const now = Date.now();
    await rentalRef.update({
      status,
      ...(depositStatus ? { depositStatus } : status === 'returned' && rental.securityDeposit > 0 ? { depositStatus: 'released' } : {}),
      ...(status === 'returned' ? { returnedAt: now } : {}),
      updatedAt: now,
    });

    await dispatchNotification({
      title: `Rental Status: ${status.toUpperCase()}`,
      message: `Your rental for "${rental.productName}" (${rental.startDate} to ${rental.returnDate}) is now ${status}.`,
      category: 'rental',
      targetRole: 'player',
      recipientId: rental.playerId,
      targetUserId: rental.playerId,
      link: '/player',
      senderName: rental.storeName || 'PlayNex Store',
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Store',
      action: `rental_${status}`,
      entityType: 'rental',
      entityId: rentalId,
      details: `Updated rental ${rentalId} (${rental.productName}) to ${status}`,
    });

    return ok({ success: true, rentalId, status });
  } catch (e: any) {
    return fail('server_error', e?.message || 'Failed to update rental', 500);
  }
}
