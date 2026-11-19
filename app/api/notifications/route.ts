import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

async function getUserRoles(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d: any) => d.data().roleId as string);
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const roles = await getUserRoles(session.uid);
    const targetRoles = ['all', ...roles];

    // Fetch user profile to read preferences and sports
    const [profileDoc, userRegistrationsSnap] = await Promise.all([
      adminDb.collection('playerProfiles').doc(session.uid).get(),
      adminDb.collection('registrations').where('userId', '==', session.uid).get(),
    ]);

    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const preferences = profileData?.notificationPreferences || {
      tournaments: true,
      matches: true,
      academy: true,
      promotions: true,
      announcements: true,
    };
    const userSports: string[] = profileData?.sportsPreferences || ['Basketball', 'Football', 'Cricket', 'Tennis'];
    const userRegisteredEventIds = new Set(userRegistrationsSnap.docs.map((d: any) => d.data().eventId));

    // Read all notifications
    const notifsSnap = await adminDb.collection('notifications').get();
    
    // Read user's read states and dismissals
    const readsSnap = await adminDb.collection('notificationReads')
      .where('userId', '==', session.uid)
      .get();
    const readMap = new Map<string, { readAt: number; dismissed?: boolean }>();
    readsSnap.docs.forEach((d: any) => {
      const rData = d.data();
      readMap.set(rData.notificationId, {
        readAt: rData.readAt,
        dismissed: rData.dismissed === true,
      });
    });

    const notifications: any[] = [];
    notifsSnap.docs.forEach((d: any) => {
      const data = d.data();
      const cat = data.category || 'announcement';

      // Check if user previously dismissed this notification
      const userReadState = readMap.get(d.id);
      if (userReadState?.dismissed) return;

      // 1. Direct User targeting
      if (data.targetUserId) {
        if (data.targetUserId !== session.uid) return;
      } else {
        // Role check
        const roleMatch = targetRoles.includes(data.targetRole || 'all');
        if (!roleMatch) return;

        // Tournament registered audience check
        if (data.targetEventId && !userRegisteredEventIds.has(data.targetEventId)) {
          return;
        }

        // Sport targeting check
        if (data.targetSport && userSports.length > 0 && !userSports.includes(data.targetSport)) {
          return;
        }

        // User preferences filtering for optional alerts
        if (cat === 'tournament' && preferences.tournaments === false) return;
        if (cat === 'match' && preferences.matches === false) return;
        if (cat === 'academy' && preferences.academy === false) return;
        if (cat === 'store' && preferences.promotions === false) return;
        if (cat === 'announcement' && preferences.announcements === false) return;
      }

      notifications.push({
        id: d.id,
        ...data,
        read: !!userReadState?.readAt,
        readAt: userReadState?.readAt || null,
      });
    });

    // Sort by createdAt descending
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
  category: z.enum(['tournament', 'match', 'academy', 'store', 'announcement', 'order', 'registration']).default('announcement'),
  targetRole: z.enum(['all', 'player', 'academy', 'store']).default('all'),
  targetUserId: z.string().optional(),
  targetSport: z.string().optional(),
  link: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const roles = await getUserRoles(session.uid);
  if (!roles.includes('admin')) {
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

  if (!id && !clearAll) {
    return fail('invalid', 'Provide either "id" or "clearAll=true"', 400);
  }

  const roles = await getUserRoles(session.uid);
  const isAdmin = roles.includes('admin');

  try {
    if (isAdmin) {
      // ADMIN: Permanently delete announcement(s) from collection
      if (clearAll) {
        const notifsSnap = await adminDb.collection('notifications').get();
        const batchSize = 400;
        const docs = notifsSnap.docs;
        for (let i = 0; i < docs.length; i += batchSize) {
          const chunk = docs.slice(i, i + batchSize);
          const batch = adminDb.batch();
          chunk.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }

        await logActivity({
          userId: session.uid,
          userName: 'Administrator',
          action: 'announcements_cleared',
          entityType: 'announcement',
          details: `Admin cleared all ${docs.length} broadcast announcements`,
        });

        return ok({ success: true, count: docs.length, clearedAll: true });
      }

      if (id) {
        const docRef = adminDb.collection('notifications').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return fail('not_found', 'Announcement not found', 404);
        }
        const existingData = docSnap.data();
        await docRef.delete();

        // Also clean up any associated notificationReads
        const readsSnap = await adminDb.collection('notificationReads')
          .where('notificationId', '==', id)
          .get();
        if (!readsSnap.empty) {
          const batch = adminDb.batch();
          readsSnap.docs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }

        await logActivity({
          userId: session.uid,
          userName: 'Administrator',
          action: 'announcement_deleted',
          entityType: 'announcement',
          entityId: id,
          details: `Deleted announcement "${existingData?.title || id}"`,
        });

        return ok({ success: true, deletedId: id });
      }
    } else {
      // USER: Dismiss notification(s) for the current user
      if (clearAll) {
        const notifsSnap = await adminDb.collection('notifications').get();
        const batch = adminDb.batch();
        const now = Date.now();
        notifsSnap.docs.forEach((d: any) => {
          const readRef = adminDb.collection('notificationReads').doc(`${d.id}_${session.uid}`);
          batch.set(readRef, {
            notificationId: d.id,
            userId: session.uid,
            dismissed: true,
            dismissedAt: now,
          }, { merge: true });
        });
        await batch.commit();

        return ok({ success: true, clearedAll: true });
      }

      if (id) {
        const docRef = adminDb.collection('notifications').doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists && docSnap.data()?.targetUserId === session.uid) {
          // If targeted directly to this specific user, we can permanently delete
          await docRef.delete();
        } else {
          // If broadcast/role notification, mark dismissed for this user
          await adminDb.collection('notificationReads').doc(`${id}_${session.uid}`).set({
            notificationId: id,
            userId: session.uid,
            dismissed: true,
            dismissedAt: Date.now(),
          }, { merge: true });
        }

        return ok({ success: true, dismissedId: id });
      }
    }

    return fail('invalid', 'Request not handled', 400);
  } catch (e: any) {
    console.error('Failed to delete/dismiss notification:', e);
    return fail('server_error', e.message || 'Operation failed', 500);
  }
}
