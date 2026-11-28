import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

const Body = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['facility', 'product']),
  rating: z.number().int().min(1).max(5),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired 5-day verification. Submit proof to submit ratings.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid rating payload. Rating must be an integer between 1 and 5.', 400);

    const { targetId, targetType, rating } = parsed.data;
    const collectionName = targetType === 'facility' ? 'facilities' : 'products';
    const targetRef = adminDb.collection(collectionName).doc(targetId);
    
    // Deterministic rating document ID enforces exactly ONE review per user per target
    const ratingDocId = `${session.uid}_${targetId}`;
    const userRatingRef = adminDb.collection('ratings').doc(ratingDocId);

    const result = await adminDb.runTransaction(async (transaction: any) => {
      const targetSnap = await transaction.get(targetRef);
      if (!targetSnap.exists) {
        throw new Error('TARGET_NOT_FOUND');
      }

      const userRatingSnap = await transaction.get(userRatingRef);
      const targetData = targetSnap.data();
      const currentRating = typeof targetData.rating === 'number' ? targetData.rating : 0;
      const currentCount = typeof targetData.ratingCount === 'number' ? targetData.ratingCount : 0;

      let newRating: number;
      let newCount: number;

      if (userRatingSnap.exists) {
        // User is updating their previous rating - adjust average without increasing review count
        const prevRating = userRatingSnap.data().rating;
        const validCount = Math.max(1, currentCount);
        const oldSum = currentRating * validCount;
        const newSum = oldSum - prevRating + rating;
        newRating = Number((newSum / validCount).toFixed(1));
        newCount = validCount;

        transaction.update(userRatingRef, {
          rating,
          updatedAt: Date.now(),
        });
      } else {
        // First-time review from this user - increment count and compute new running average
        newCount = currentCount + 1;
        newRating = Number(((currentRating * currentCount + rating) / newCount).toFixed(1));

        transaction.set(userRatingRef, {
          userId: session.uid,
          targetId,
          targetType,
          rating,
          createdAt: Date.now(),
        });
      }

      transaction.update(targetRef, {
        rating: newRating,
        ratingCount: newCount,
      });

      return {
        rating: newRating,
        ratingCount: newCount,
        isUpdate: userRatingSnap.exists,
      };
    });

    return ok({ success: true, ...result });
  } catch (e: any) {
    if (e?.message === 'TARGET_NOT_FOUND') {
      return fail('not_found', 'Target venue or product not found', 404);
    }
    console.error('Rating submission error:', e);
    return fail('server_error', e?.message || 'Failed to submit rating', 500);
  }
}
