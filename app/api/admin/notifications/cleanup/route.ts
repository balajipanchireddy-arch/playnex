import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';


// 30 days in milliseconds
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    // Find expired notifications
    const expiredSnap = await adminDb.collection('notifications')
      .where('createdAt', '<', cutoff)
      .get();

    if (expiredSnap.empty) {
      return ok({ success: true, deleted: 0, readsDeleted: 0, message: 'No expired notifications found (threshold: 30 days)' });
    }

    const expiredIds = expiredSnap.docs.map((d: any) => d.id);
    let deletedCount = 0;
    let readsDeletedCount = 0;

    // Chunk notification deletions (400 per batch)
    const chunkSize = 400;
    for (let i = 0; i < expiredSnap.docs.length; i += chunkSize) {
      const batch = adminDb.batch();
      const chunk = expiredSnap.docs.slice(i, i + chunkSize);
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
      deletedCount += chunk.length;
    }

    // Clean up associated notificationReads
    for (let i = 0; i < expiredIds.length; i += 30) {
      const idChunk = expiredIds.slice(i, i + 30);
      const readsSnap = await adminDb.collection('notificationReads')
        .where('notificationId', 'in', idChunk)
        .get();

      if (!readsSnap.empty) {
        const batch = adminDb.batch();
        readsSnap.docs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
        readsDeletedCount += readsSnap.docs.length;
      }
    }

    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: 'notification_cleanup',
      entityType: 'announcement',
      entityId: 'cleanup',
      details: `Purged ${deletedCount} expired notifications (>30 days old) and ${readsDeletedCount} read records.`,
    });

    return ok({
      success: true,
      deleted: deletedCount,
      readsDeleted: readsDeletedCount,
      cutoffDate: new Date(cutoff).toISOString(),
    });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to cleanup notifications', 500);
  }
}

