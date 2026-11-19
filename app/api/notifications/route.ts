import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';

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
    
    // Read user's read states
    const readsSnap = await adminDb.collection('notificationReads')
      .where('userId', '==', session.uid)
      .get();
    const readMap = new Map<string, number>();
    readsSnap.docs.forEach((d: any) => {
      readMap.set(d.data().notificationId, d.data().readAt);
    });

    const notifications: any[] = [];
    notifsSnap.docs.forEach((d: any) => {
      const data = d.data();
      const cat = data.category || 'announcement';

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
        read: readMap.has(d.id),
        readAt: readMap.get(d.id) || null,
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
