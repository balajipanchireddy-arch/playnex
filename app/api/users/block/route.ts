import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb
      .collection('userBlocks')
      .where('blockerId', '==', session.uid)
      .get();
    return ok(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const BlockBody = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().max(300).optional().default(''),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = BlockBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid block payload', 400);

  const { targetUserId, reason } = parsed.data;
  if (targetUserId === session.uid) return fail('invalid', 'Cannot block yourself', 400);

  try {
    const now = Date.now();
    await adminDb.collection('userBlocks').doc(`${session.uid}_${targetUserId}`).set({
      blockerId: session.uid,
      blockedId: targetUserId,
      reason,
      createdAt: now,
    });

    await logActivity({
      userId: session.uid,
      action: 'user_blocked',
      entityType: 'chat',
      entityId: targetUserId,
      details: `Blocked user ${targetUserId}`,
    });

    return ok({ blocked: true, targetUserId });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('targetUserId');
  if (!targetUserId) return fail('invalid', 'targetUserId is required', 400);

  try {
    await adminDb.collection('userBlocks').doc(`${session.uid}_${targetUserId}`).delete();
    return ok({ unblocked: true, targetUserId });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
