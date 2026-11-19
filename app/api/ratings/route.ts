import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['facility', 'product']),
  rating: z.number().min(1).max(5),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid rating payload', 400);

    const { targetId, targetType, rating } = parsed.data;
    const collectionName = targetType === 'facility' ? 'facilities' : 'products';
    const targetRef = adminDb.collection(collectionName).doc(targetId);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return fail('not_found', `${targetType === 'facility' ? 'Facility' : 'Product'} not found`, 404);
    }

    const data = targetSnap.data();
    const currentRating = typeof data.rating === 'number' ? data.rating : 0;
    const currentCount = typeof data.ratingCount === 'number' ? data.ratingCount : 0;

    const newCount = currentCount + 1;
    const newRating = Number(((currentRating * currentCount + rating) / newCount).toFixed(1));

    await targetRef.update({
      rating: newRating,
      ratingCount: newCount,
    });

    await adminDb.collection('ratings').add({
      userId: session.uid,
      targetId,
      targetType,
      rating,
      createdAt: Date.now(),
    });

    return ok({ success: true, rating: newRating, ratingCount: newCount });
  } catch (e: any) {
    console.error('Rating submission error:', e);
    return fail('server_error', e?.message || 'Failed to submit rating', 500);
  }
}

