import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

const CreateMatchSchema = z.object({
  sport: z.string().min(2),
  customSport: z.string().optional(),
  location: z.string().min(2),
  date: z.string().min(4),
  time: z.string().min(2),
  requiredPlayers: z.number().int().min(2).max(50),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'any']).default('any'),
  notes: z.string().max(500).optional().default(''),
  facilityId: z.string().optional(),
  bookingId: z.string().optional(),
  method: z.enum(['match_first', 'reserve_first']).default('match_first'),
});

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport');
  const status = searchParams.get('status');
  const mine = searchParams.get('mine') === 'true';

  try {
    const [snap, blocksSnap] = await Promise.all([
      adminDb.collection('matches').get(),
      adminDb.collection('userBlocks').where('blockerId', '==', session.uid).get(),
    ]);
    const blockedIds = new Set(blocksSnap.docs.map((d: any) => d.data()?.blockedId));
    const now = Date.now();

    let matches = snap.docs.map((d: any) => {
      const data = d.data();
      const effectiveStatus =
        (data.status === 'open' || data.status === 'full') &&
        data.expiresAt &&
        now > data.expiresAt
          ? 'expired'
          : data.status;

      return { id: d.id, ...data, status: effectiveStatus };
    });

    if (mine) {
      matches = matches.filter(
        (m: any) =>
          m.creatorId === session.uid ||
          (Array.isArray(m.participants) && m.participants.includes(session.uid)) ||
          (Array.isArray(m.pendingRequests) &&
            m.pendingRequests.some((r: any) => r.userId === session.uid))
      );
    } else if (status) {
      matches = matches.filter((m: any) => m.status === status && !blockedIds.has(m.creatorId));
    } else {
      matches = matches.filter(
        (m: any) =>
          (m.status === 'open' || m.status === 'full' || m.status === 'ready') &&
          !blockedIds.has(m.creatorId)
      );
    }

    if (sport && sport !== 'All') {
      matches = matches.filter(
        (m: any) => (m.sport || '').toLowerCase() === sport.toLowerCase()
      );
    }

    matches.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(matches);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load matches', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verification = await checkAndEnforcePlayerVerification(session.uid);
  if (!verification.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended because the 5-day player verification deadline expired. Submit verification proof to restore match creation.',
      403
    );
  }

  try {
    const parsed = CreateMatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', parsed.error.errors[0]?.message || 'Invalid match data', 400);
    }

    const { sport, customSport, ...rest } = parsed.data;
    const resolvedSport =
      sport === 'Other / Custom Sport' && customSport
        ? customSport.trim()
        : sport.trim();

    if (!resolvedSport) {
      return fail('invalid', 'Sport name is required', 400);
    }

    const now = Date.now();
    const parsedDate = new Date(`${rest.date}T${rest.time}`).getTime();
    const matchTimestamp = Number.isNaN(parsedDate) ? now + 86400000 : parsedDate;

    if (matchTimestamp < now - 3600000) {
      return fail('invalid', 'Match date and time must be in the future', 400);
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const creatorName = userDoc.exists
      ? userDoc.data()?.fullName || session.email || 'Player'
      : session.email || 'Player';

    const matchData = {
      sport: resolvedSport,
      location: rest.location,
      date: rest.date,
      time: rest.time,
      requiredPlayers: rest.requiredPlayers,
      skillLevel: rest.skillLevel,
      notes: rest.notes || '',
      facilityId: rest.facilityId || null,
      bookingId: rest.bookingId || null,
      method: rest.method,
      creatorId: session.uid,
      creatorName,
      creatorEmail: session.email || '',
      participants: [session.uid],
      participantDetails: [{ uid: session.uid, name: creatorName, joinedAt: now }],
      pendingRequests: [],
      waitlist: [],
      participantCount: 1,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      matchTimestamp,
      expiresAt: matchTimestamp + 86400000,
    };

    const docRef = await adminDb.collection('matches').add(matchData);

    await logActivity({
      userId: session.uid,
      userName: creatorName,
      action: 'match_created',
      entityType: 'match',
      entityId: docRef.id,
      details: `Created ${resolvedSport} match at ${rest.location} (${rest.date} ${rest.time})`,
    });

    await dispatchNotification({
      title: `New ${resolvedSport} Match Open`,
      message: `${creatorName} is looking for ${rest.requiredPlayers - 1} player(s) at ${rest.location} on ${rest.date} at ${rest.time}.`,
      category: 'match',
      targetRole: 'player',
      targetSport: resolvedSport,
      link: '/player',
      senderName: creatorName,
      idempotencyKey: `notif_match_created_${docRef.id}`,
    });

    return ok({ id: docRef.id, ...matchData });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to create match', 500);
  }
}
