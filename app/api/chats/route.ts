import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

/**
 * Matchmaking Conversations API
 *
 * GET  /api/chats — List chats where caller is an authorized participant (with unread counts)
 * POST /api/chats — Open or fetch a chat ONLY if participants have an accepted match or accepted match request
 */

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const [chatsSnap, blocksSnap] = await Promise.all([
      adminDb
        .collection('chats')
        .where('participants', 'array-contains', session.uid)
        .get(),
      adminDb.collection('userBlocks').where('blockerId', '==', session.uid).get(),
    ]);

    const blockedSet = new Set<string>(blocksSnap.docs.map((d: any) => d.data()?.blockedId));

    const chats = await Promise.all(
      chatsSnap.docs.map(async (d: any) => {
        const data = d.data();
        const lastReadAt = Number(data.lastReadAt?.[session.uid] || 0);
        let unreadCount = 0;

        try {
          const msgSnap = await d.ref
            .collection('messages')
            .where('createdAt', '>', lastReadAt)
            .get();
          unreadCount = msgSnap.docs.filter(
            (m: any) => m.data()?.senderId !== session.uid
          ).length;
        } catch {
          unreadCount = 0;
        }

        const otherParticipants = (data.participants || []).filter(
          (p: string) => p !== session.uid
        );
        const isBlocked = otherParticipants.some((p: string) => blockedSet.has(p));

        return {
          id: d.id,
          ...data,
          unreadCount,
          isBlocked,
        };
      })
    );

    chats.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return ok(chats);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load chats', 500);
  }
}

const OpenChatBody = z.object({
  matchId: z.string().optional(),
  otherUserId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired 5-day verification. Submit proof to open matchmaking chats.',
      403
    );
  }

  const parsed = OpenChatBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid chat request', 400);

  const { matchId, otherUserId } = parsed.data;
  const now = Date.now();

  try {
    if (matchId) {
      const matchDoc = await adminDb.collection('matches').doc(matchId).get();
      if (!matchDoc.exists) return fail('not_found', 'Match not found', 404);
      const m = matchDoc.data()!;
      if (!Array.isArray(m.participants) || !m.participants.includes(session.uid)) {
        return fail('forbidden', 'Only accepted match participants can access this chat.', 403);
      }

      const chatId = `match_${matchId}`;
      const chatRef = adminDb.collection('chats').doc(chatId);
      await chatRef.set(
        {
          type: 'match',
          matchId,
          title: `${m.sport} Match · ${m.location}`,
          participants: m.participants,
          participantNames: Object.fromEntries(
            (m.participantDetails || []).map((p: any) => [p.uid, p.name || 'Player'])
          ),
          updatedAt: now,
          createdAt: m.createdAt || now,
        },
        { merge: true }
      );
      const snap = await chatRef.get();
      return ok({ id: snap.id, ...snap.data() });
    }

    if (otherUserId) {
      if (otherUserId === session.uid) return fail('invalid', 'Cannot chat with yourself', 400);

      // Check accepted direct match request OR shared match participation
      const [req1, req2, sharedMatches] = await Promise.all([
        adminDb
          .collection('matchRequests')
          .where('fromUserId', '==', session.uid)
          .where('toUserId', '==', otherUserId)
          .where('status', '==', 'accepted')
          .limit(1)
          .get(),
        adminDb
          .collection('matchRequests')
          .where('fromUserId', '==', otherUserId)
          .where('toUserId', '==', session.uid)
          .where('status', '==', 'accepted')
          .limit(1)
          .get(),
        adminDb
          .collection('matches')
          .where('participants', 'array-contains', session.uid)
          .get(),
      ]);

      const sharesMatch = sharedMatches.docs.some((d: any) =>
        Array.isArray(d.data()?.participants) && d.data().participants.includes(otherUserId)
      );

      if (req1.empty && req2.empty && !sharesMatch) {
        return fail(
          'forbidden',
          'Chat is unlocked only after a matchmaking request or match join request is accepted.',
          403
        );
      }

      const pair = [session.uid, otherUserId].sort();
      const chatId = `dm_${pair[0]}_${pair[1]}`;
      const [u1, u2] = await Promise.all([
        adminDb.collection('users').doc(pair[0]).get(),
        adminDb.collection('users').doc(pair[1]).get(),
      ]);

      const chatRef = adminDb.collection('chats').doc(chatId);
      await chatRef.set(
        {
          type: 'direct',
          participants: pair,
          participantNames: {
            [pair[0]]: u1.data()?.fullName || 'Player',
            [pair[1]]: u2.data()?.fullName || 'Player',
          },
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );
      const snap = await chatRef.get();
      return ok({ id: snap.id, ...snap.data() });
    }

    return fail('invalid', 'Provide matchId or otherUserId', 400);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to open chat', 500);
  }
}
