import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const body = await req.json();
    const { notificationId, all } = body;
    const now = Date.now();

    const [rolesSnap, callerIsAdmin] = await Promise.all([
      adminDb
        .collection('userRoles')
        .where('userId', '==', session.uid)
        .where('status', '==', 'active')
        .get(),
      isAdmin(session.uid),
    ]);
    const targetRoles = [
      'all',
      ...rolesSnap.docs.map((d: any) => d.data().roleId as string),
      ...(callerIsAdmin ? ['admin'] : []),
    ];

    if (all) {
      const [directRecipientSnap, directTargetSnap, broadcastSnap] = await Promise.all([
        adminDb.collection('notifications').where('recipientId', '==', session.uid).limit(200).get(),
        adminDb.collection('notifications').where('targetUserId', '==', session.uid).limit(200).get(),
        adminDb.collection('notifications').where('recipientId', '==', null).limit(200).get(),
      ]);

      const docMap = new Map<string, any>();
      for (const snap of [directRecipientSnap, directTargetSnap, broadcastSnap]) {
        snap.docs.forEach((d: any) => {
          if (!docMap.has(d.id)) docMap.set(d.id, d);
        });
      }

      const visibleDocs = Array.from(docMap.values()).filter((doc: any) => {
        const d = doc.data();
        const recipient = d.recipientId || d.targetUserId || null;
        if (recipient) return recipient === session.uid;
        return targetRoles.includes(d.targetRole || 'all');
      });

      for (let i = 0; i < visibleDocs.length; i += 400) {
        const batch = adminDb.batch();
        visibleDocs.slice(i, i + 400).forEach((doc: any) => {
          const readRef = adminDb.collection('notificationReads').doc(`${doc.id}_${session.uid}`);
          batch.set(
            readRef,
            {
              notificationId: doc.id,
              userId: session.uid,
              readAt: now,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
      return ok({ success: true, all: true, markedCount: visibleDocs.length });
    }

    if (!notificationId || typeof notificationId !== 'string') {
      return fail('invalid', 'notificationId or all: true required', 400);
    }

    const notifDoc = await adminDb.collection('notifications').doc(notificationId).get();
    if (!notifDoc.exists) {
      return fail('not_found', 'Notification not found', 404);
    }
    const notifData = notifDoc.data()!;
    const recipient = notifData.recipientId || notifData.targetUserId || null;
    if (recipient && recipient !== session.uid) {
      return fail('forbidden', 'Cannot mark another user notification as read', 403);
    }
    if (!recipient && !targetRoles.includes(notifData.targetRole || 'all')) {
      return fail('forbidden', 'Notification not targeted to your role', 403);
    }

    await adminDb.collection('notificationReads').doc(`${notificationId}_${session.uid}`).set(
      {
        notificationId,
        userId: session.uid,
        readAt: now,
      },
      { merge: true }
    );

    return ok({ success: true, notificationId });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
