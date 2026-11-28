import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';

const ReportBody = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(5, 'Please describe the issue').max(500),
  chatId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = ReportBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid report payload', 400);
  }

  const { targetUserId, reason, chatId } = parsed.data;
  if (targetUserId === session.uid) return fail('invalid', 'Cannot report yourself', 400);

  try {
    const now = Date.now();
    const docRef = await adminDb.collection('userReports').add({
      reporterId: session.uid,
      reportedUserId: targetUserId,
      chatId: chatId || null,
      reason,
      status: 'open',
      createdAt: now,
    });

    await logActivity({
      userId: session.uid,
      action: 'user_reported',
      entityType: 'chat',
      entityId: docRef.id,
      details: `Reported user ${targetUserId}: ${reason}`,
    });

    await dispatchNotification({
      title: 'Player Abuse / Safety Report',
      message: `A player reported user ${targetUserId} for: ${reason}`,
      category: 'system',
      targetRole: 'admin',
      link: '/admin?tab=users',
      idempotencyKey: `notif_report_${docRef.id}`,
    });

    return ok({ id: docRef.id, reported: true }, 201);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
