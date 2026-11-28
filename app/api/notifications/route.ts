import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin as hasAdminAccess } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

async function getUserRoles(uid: string) {
  const snap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d: any) => d.data().roleId as string);
}

function getEffectiveRecipient(data: Record<string, any>): string | null {
  return data.recipientId || data.targetUserId || null;
}

function isNotificationVisibleToUser(
  data: Record<string, any>,
  uid: string,
  targetRoles: string[],
  preferences: Record<string, boolean>,
  userSports: string[],
  userRegisteredEventIds: Set<string>,
  callerIsAdmin: boolean
): boolean {
  const recipient = getEffectiveRecipient(data);
  const cat = data.category || 'announcement';

  // Direct individual notifications are strictly visible ONLY to that recipient.
  if (recipient) {
    return recipient === uid;
  }

  // Role-targeted notifications (admin notices stay separate for admins)
  const targetRole = data.targetRole || 'all';
  if (targetRole === 'admin') {
    return callerIsAdmin;
  }
  if (!targetRoles.includes(targetRole)) return false;

  if (data.targetEventId && !userRegisteredEventIds.has(data.targetEventId)) {
    return false;
  }

  if (data.targetSport && userSports.length > 0 && !userSports.includes(data.targetSport)) {
    return false;
  }

  if (cat === 'tournament' && preferences.tournaments === false) return false;
  if (cat === 'match' && preferences.matches === false) return false;
  if (cat === 'academy' && preferences.academy === false) return false;
  if (cat === 'store' && preferences.promotions === false) return false;
  if (cat === 'announcement' && preferences.announcements === false) return false;

  return true;
}

async function fetchCandidateNotifications(uid: string, limitPerQuery = 150) {
  const [directRecipientSnap, directTargetSnap, broadcastSnap] = await Promise.all([
    adminDb
      .collection('notifications')
      .where('recipientId', '==', uid)
      .limit(limitPerQuery)
      .get(),
    adminDb
      .collection('notifications')
      .where('targetUserId', '==', uid)
      .limit(limitPerQuery)
      .get(),
    adminDb
      .collection('notifications')
      .where('recipientId', '==', null)
      .limit(limitPerQuery)
      .get(),
  ]);

  const docMap = new Map<string, any>();
  for (const snap of [directRecipientSnap, directTargetSnap, broadcastSnap]) {
    snap.docs.forEach((d: any) => {
      if (!docMap.has(d.id)) docMap.set(d.id, d);
    });
  }
  return Array.from(docMap.values());
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const adminScope = searchParams.get('scope') === 'admin_broadcasts';

  try {
    const callerIsAdmin = await hasAdminAccess(session.uid);

    if (adminScope && callerIsAdmin) {
      const [broadcastSnap, readsSnap] = await Promise.all([
        adminDb
          .collection('notifications')
          .where('recipientId', '==', null)
          .limit(200)
          .get(),
        adminDb.collection('notificationReads').where('userId', '==', session.uid).get(),
      ]);

      const readMap = new Map<string, { readAt?: number; dismissed?: boolean }>();
      readsSnap.docs.forEach((d: any) => {
        const rData = d.data();
        readMap.set(rData.notificationId, {
          readAt: rData.readAt,
          dismissed: rData.dismissed === true,
        });
      });

      const notifications = broadcastSnap.docs
        .filter((d: any) => !getEffectiveRecipient(d.data()))
        .map((d: any) => ({
          id: d.id,
          ...d.data(),
          read: Boolean(readMap.get(d.id)?.readAt),
          readAt: readMap.get(d.id)?.readAt || null,
        }))
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

      return ok(notifications);
    }

    const [roles, profileDoc, userRegistrationsSnap, candidateDocs, readsSnap] =
      await Promise.all([
        getUserRoles(session.uid),
        adminDb.collection('playerProfiles').doc(session.uid).get(),
        adminDb.collection('registrations').where('userId', '==', session.uid).get(),
        fetchCandidateNotifications(session.uid, 150),
        adminDb.collection('notificationReads').where('userId', '==', session.uid).get(),
      ]);

    const targetRoles = ['all', ...roles];
    if (callerIsAdmin && !targetRoles.includes('admin')) {
      targetRoles.push('admin');
    }

    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const preferences = profileData?.notificationPreferences || {
      tournaments: true,
      matches: true,
      academy: true,
      promotions: true,
      announcements: true,
    };
    const userSports: string[] = profileData?.sportsPreferences || [];
    const userRegisteredEventIds = new Set<string>(
      userRegistrationsSnap.docs.map((d: any) => d.data().eventId)
    );

    const readMap = new Map<string, { readAt?: number; dismissed?: boolean }>();
    readsSnap.docs.forEach((d: any) => {
      const rData = d.data();
      readMap.set(rData.notificationId, {
        readAt: rData.readAt,
        dismissed: rData.dismissed === true,
      });
    });

    const notifications: any[] = [];
    candidateDocs.forEach((d: any) => {
      const data = d.data();

      const userReadState = readMap.get(d.id);
      if (userReadState?.dismissed) return;

      if (
        !isNotificationVisibleToUser(
          data,
          session.uid,
          targetRoles,
          preferences,
          userSports,
          userRegisteredEventIds,
          callerIsAdmin
        )
      ) {
        return;
      }

      notifications.push({
        id: d.id,
        ...data,
        recipientId: getEffectiveRecipient(data),
        read: Boolean(userReadState?.readAt),
        readAt: userReadState?.readAt || null,
      });
    });

    notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(notifications);
  } catch (e: any) {
    console.error('Error fetching notifications:', e);
    return fail('server_error', e.message, 500);
  }
}

const SendNotificationSchema = z.object({
  title: z.string().min(2, 'Title required'),
  message: z.string().min(2, 'Message required'),
  category: z
    .enum(['tournament', 'match', 'academy', 'store', 'announcement', 'order', 'registration', 'verification', 'system'])
    .default('announcement'),
  targetRole: z.enum(['all', 'player', 'academy', 'store', 'admin']).default('all'),
  targetUserId: z.string().optional(),
  targetSport: z.string().optional(),
  link: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!(await hasAdminAccess(session.uid))) {
    return fail('forbidden', 'Only administrators can broadcast announcements', 403);
  }

  try {
    const body = await req.json();
    const parsed = SendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return fail('invalid', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const data = parsed.data;
    const docId = await dispatchNotification({
      title: data.title,
      message: data.message,
      category: data.category,
      targetRole: data.targetRole,
      recipientId: data.targetUserId,
      targetUserId: data.targetUserId,
      targetSport: data.targetSport,
      link: data.link,
      senderName: 'PlayNex Platform Admin',
    });

    return ok({ success: true, id: docId }, 201);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clearAll = searchParams.get('clearAll') === 'true';
  const adminGlobalClear = searchParams.get('admin') === 'true';

  if (!id && !clearAll) {
    return fail('invalid', 'Provide either "id" or "clearAll=true"', 400);
  }

  const callerIsAdmin = await hasAdminAccess(session.uid);
  const roles = await getUserRoles(session.uid);
  const targetRoles = ['all', ...roles, ...(callerIsAdmin ? ['admin'] : [])];

  try {
    if (callerIsAdmin && adminGlobalClear && clearAll) {
      // Admin clearing broadcast announcements ONLY (never reads/deletes other users' private direct notifications)
      let clearedCount = 0;
      while (true) {
        const snap = await adminDb
          .collection('notifications')
          .where('recipientId', '==', null)
          .limit(400)
          .get();
        if (snap.empty) break;

        const broadcastDocs = snap.docs.filter((d: any) => !getEffectiveRecipient(d.data()));
        if (broadcastDocs.length === 0) break;

        const batch = adminDb.batch();
        broadcastDocs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
        clearedCount += broadcastDocs.length;

        if (snap.docs.length < 400) break;
      }

      await logActivity({
        userId: session.uid,
        userName: 'Administrator',
        action: 'announcements_cleared',
        entityType: 'announcement',
        details: `Admin cleared ${clearedCount} broadcast announcement(s)`,
      });

      return ok({ success: true, count: clearedCount, clearedAll: true });
    }

    if (clearAll) {
      // Individual user clearing only notifications targeted to THEM
      const candidateDocs = await fetchCandidateNotifications(session.uid, 200);
      const ownDirectDocs: any[] = [];
      const broadcastDocsToDismiss: any[] = [];

      candidateDocs.forEach((d: any) => {
        const data = d.data();
        const recipient = getEffectiveRecipient(data);
        if (recipient === session.uid) {
          ownDirectDocs.push(d);
        } else if (!recipient && targetRoles.includes(data.targetRole || 'all')) {
          broadcastDocsToDismiss.push(d);
        }
      });

      for (let i = 0; i < ownDirectDocs.length; i += 400) {
        const batch = adminDb.batch();
        ownDirectDocs.slice(i, i + 400).forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }

      const now = Date.now();
      for (let i = 0; i < broadcastDocsToDismiss.length; i += 400) {
        const batch = adminDb.batch();
        broadcastDocsToDismiss.slice(i, i + 400).forEach((d: any) => {
          const readRef = adminDb.collection('notificationReads').doc(`${d.id}_${session.uid}`);
          batch.set(
            readRef,
            {
              notificationId: d.id,
              userId: session.uid,
              dismissed: true,
              dismissedAt: now,
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      return ok({
        success: true,
        clearedAll: true,
        deletedDirect: ownDirectDocs.length,
        dismissedBroadcasts: broadcastDocsToDismiss.length,
      });
    }

    if (id) {
      const docRef = adminDb.collection('notifications').doc(id);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return fail('not_found', 'Notification not found', 404);
      }

      const data = docSnap.data()!;
      const recipient = getEffectiveRecipient(data);

      // Direct notification belongs strictly to its recipient
      if (recipient) {
        if (recipient !== session.uid && !callerIsAdmin) {
          return fail('forbidden', 'Cannot delete another user notification', 403);
        }
        await docRef.delete();
        const readsSnap = await adminDb
          .collection('notificationReads')
          .where('notificationId', '==', id)
          .get();
        if (!readsSnap.empty) {
          const batch = adminDb.batch();
          readsSnap.docs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
        return ok({ success: true, deletedId: id });
      }

      // Broadcast notification: regular user dismisses only for themselves
      await adminDb.collection('notificationReads').doc(`${id}_${session.uid}`).set(
        {
          notificationId: id,
          userId: session.uid,
          dismissed: true,
          dismissedAt: Date.now(),
        },
        { merge: true }
      );
      return ok({ success: true, dismissedId: id });
    }

    return fail('invalid', 'Request not handled', 400);
  } catch (e: any) {
    console.error('Failed to delete/dismiss notification:', e);
    return fail('server_error', e.message || 'Operation failed', 500);
  }
}
