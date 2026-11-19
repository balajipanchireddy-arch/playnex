import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const body = await req.json();
    const { notificationId, all } = body;

    const now = Date.now();

    if (all) {
      // Mark all visible notifications as read for this user
      const notifsSnap = await adminDb.collection('notifications').get();
      const batch = adminDb.batch();

      notifsSnap.docs.forEach((doc: any) => {
        const readRef = adminDb.collection('notificationReads').doc(`${doc.id}_${session.uid}`);
        batch.set(readRef, {
          notificationId: doc.id,
          userId: session.uid,
          readAt: now,
        }, { merge: true });
      });

      await batch.commit();
      return ok({ success: true, all: true });
    }

    if (!notificationId) {
      return fail('invalid', 'notificationId or all: true required', 400);
    }

    await adminDb.collection('notificationReads').doc(`${notificationId}_${session.uid}`).set({
      notificationId,
      userId: session.uid,
      readAt: now,
    }, { merge: true });

    return ok({ success: true, notificationId });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

