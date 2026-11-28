import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await verifySession();
    const callerIsAdmin = session ? await isAdmin(session.uid) : false;

    const [snap, storesSnap] = await Promise.all([
      adminDb.collection('products').get(),
      adminDb.collection('stores').where('verificationStatus', '==', 'approved').get(),
    ]);

    const approvedStoreIds = new Set<string>(storesSnap.docs.map((d: any) => d.id));

    const data = snap.docs
      .filter((d: any) => {
        if (callerIsAdmin) return true;
        const p = d.data() || {};
        return p.storeVerification === 'approved' || approvedStoreIds.has(p.storeId);
      })
      .map((d: any) => {
        const p = d.data() || {};
        if (!session) {
          // Public catalog projection: safe approved fields only
          return {
            id: d.id,
            storeName: p.storeName || 'Verified Store',
            name: p.name || 'Sports Gear',
            sport: p.sport || 'Sport',
            price: typeof p.price === 'number' ? p.price : 0,
            allowPurchase: p.allowPurchase !== false,
            allowRental: Boolean(p.allowRental),
            rentalPricePerDay: typeof p.rentalPricePerDay === 'number' ? p.rentalPricePerDay : 0,
            securityDeposit: typeof p.securityDeposit === 'number' ? p.securityDeposit : 0,
            requiresIdProof: Boolean(p.requiresIdProof),
            inStock: (p.qty ?? 0) > 0 || (Boolean(p.allowRental) && (p.rentalQty ?? p.qty ?? 0) > 0),
            description: p.description || '',
            category: p.category || 'Equipment',
            image: p.image || '',
            rating: typeof p.rating === 'number' ? p.rating : 0,
            ratingCount: typeof p.ratingCount === 'number' ? p.ratingCount : 0,
          };
        }

        return {
          id: d.id,
          storeId: p.storeId || null,
          storeName: p.storeName || 'Verified Store',
          storeVerification:
            p.storeVerification ||
            (approvedStoreIds.has(p.storeId) ? 'approved' : 'pending'),
          name: p.name || 'Sports Gear',
          sport: p.sport || 'Sport',
          price: typeof p.price === 'number' ? p.price : 0,
          qty: typeof p.qty === 'number' ? p.qty : 0,
          allowPurchase: p.allowPurchase !== false,
          allowRental: Boolean(p.allowRental),
          rentalPricePerDay: typeof p.rentalPricePerDay === 'number' ? p.rentalPricePerDay : 0,
          securityDeposit: typeof p.securityDeposit === 'number' ? p.securityDeposit : 0,
          rentalQty: typeof p.rentalQty === 'number' ? p.rentalQty : typeof p.qty === 'number' ? p.qty : 0,
          requiresIdProof: Boolean(p.requiresIdProof),
          description: p.description || '',
          category: p.category || 'Equipment',
          image: p.image || '',
          rating: typeof p.rating === 'number' ? p.rating : 0,
          ratingCount: typeof p.ratingCount === 'number' ? p.ratingCount : 0,
          createdAt: p.createdAt || 0,
        };
      });

    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
