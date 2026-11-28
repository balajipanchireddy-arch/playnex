import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isProtectedPermanentAdmin } from '@/lib/auth/admin';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { ok, fail } from '@/lib/api/response';

const RequestBody = z.object({
  reason: z.string().trim().min(5, 'Please provide a brief reason').max(500),
});

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb
      .collection('accountDeletionRequests')
      .where('userId', '==', session.uid)
      .get();
    const requests = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    requests.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(requests[0] || null);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (await isProtectedPermanentAdmin(session.uid, session.email)) {
    return fail('forbidden', 'Permanent administrator accounts cannot submit deletion requests.', 403);
  }

  const parsed = RequestBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid request', 400);
  }

  try {
    const existing = await adminDb
      .collection('accountDeletionRequests')
      .where('userId', '==', session.uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existing.empty) {
      return fail('conflict', 'An account deletion request is already pending administrator review.', 409);
    }

    const now = Date.now();
    const docRef = await adminDb.collection('accountDeletionRequests').add({
      userId: session.uid,
      userEmail: session.email || '',
      reason: parsed.data.reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await logActivity({
      userId: session.uid,
      userName: session.email || 'User',
      action: 'account_deletion_requested',
      entityType: 'user',
      entityId: docRef.id,
      details: `User requested account deletion: ${parsed.data.reason}`,
    });

    await dispatchNotification({
      title: 'Account Deletion Request Submitted',
      message: 'Your account deletion request has been logged for administrator processing while preserving required financial/attendance records.',
      category: 'system',
      targetRole: 'player',
      recipientId: session.uid,
      targetUserId: session.uid,
      link: '/player',
      idempotencyKey: `notif_del_req_${docRef.id}`,
    });

    await dispatchNotification({
      title: 'User Account Deletion Request',
      message: `${session.email || session.uid} requested account deletion.`,
      category: 'system',
      targetRole: 'admin',
      link: '/admin?tab=users',
      idempotencyKey: `notif_del_req_admin_${docRef.id}`,
    });

    return ok({ id: docRef.id, status: 'pending' });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
