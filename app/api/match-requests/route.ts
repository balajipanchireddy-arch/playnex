import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

/**
 * Direct Player-to-Player Matchmaking Requests API
 *
 * GET   /api/match-requests  — List incoming and outgoing matchmaking requests
 * POST  /api/match-requests  — Send a matchmaking request to a discovered player
 * PATCH /api/match-requests  — Accept, reject, or withdraw a request (accept unlocks DM chat)
 */

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const [incomingSnap, outgoingSnap] = await Promise.all([
      adminDb.collection('matchRequests').where('toUserId', '==', session.uid).get(),
      adminDb.collection('matchRequests').where('fromUserId', '==', session.uid).get(),
    ]);

    const incoming = incomingSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const outgoing = outgoingSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    incoming.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    outgoing.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return ok({ incoming, outgoing });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load matchmaking requests', 500);
  }
}

const CreateRequestBody = z.object({
  toUserId: z.string().min(1),
  sport: z.string().min(2).max(60),
  message: z.string().max(300).optional().default(''),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired verification. Submit proof to send matchmaking requests.',
      403
    );
  }

  const parsed = CreateRequestBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid request', 400);
  }

  const { toUserId, sport, message } = parsed.data;
  if (toUserId === session.uid) {
    return fail('invalid', 'You cannot send a matchmaking request to yourself.', 400);
  }

  try {
    // Enforce block check in both directions
    const [b1, b2] = await Promise.all([
      adminDb.collection('userBlocks').doc(`${session.uid}_${toUserId}`).get(),
      adminDb.collection('userBlocks').doc(`${toUserId}_${session.uid}`).get(),
    ]);
    if (b1.exists || b2.exists) {
      return fail('forbidden', 'Cannot send matchmaking request due to user block settings.', 403);
    }

    const [fromUserDoc, toUserDoc, existingSnap] = await Promise.all([
      adminDb.collection('users').doc(session.uid).get(),
      adminDb.collection('users').doc(toUserId).get(),
      adminDb
        .collection('matchRequests')
        .where('fromUserId', '==', session.uid)
        .where('toUserId', '==', toUserId)
        .where('status', '==', 'pending')
        .limit(1)
        .get(),
    ]);

    if (!toUserDoc.exists) {
      return fail('not_found', 'Target player not found', 404);
    }
    if (!existingSnap.empty) {
      return fail('conflict', 'You already have a pending matchmaking request with this player.', 409);
    }

    const fromName = fromUserDoc.data()?.fullName || session.email || 'Player';
    const toName = toUserDoc.data()?.fullName || 'Player';
    const now = Date.now();

    const docRef = await adminDb.collection('matchRequests').add({
      fromUserId: session.uid,
      fromName,
      toUserId,
      toName,
      sport,
      message,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await dispatchNotification({
      title: `New ${sport} Match Invite`,
      message: `${fromName} sent you a ${sport} matchmaking request.${message ? ` "${message}"` : ''}`,
      category: 'match',
      targetRole: 'player',
      recipientId: toUserId,
      targetUserId: toUserId,
      link: '/player',
      senderName: fromName,
      idempotencyKey: `notif_match_req_${docRef.id}`,
    });

    await logActivity({
      userId: session.uid,
      userName: fromName,
      action: 'match_request_sent',
      entityType: 'match',
      entityId: docRef.id,
      details: `Sent ${sport} matchmaking request to ${toName}`,
    });

    return ok({ id: docRef.id, status: 'pending' }, 201);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to send request', 500);
  }
}

const PatchRequestBody = z.object({
  requestId: z.string().min(1),
  action: z.enum(['accept', 'reject', 'withdraw']),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = PatchRequestBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid request action', 400);

  const { requestId, action } = parsed.data;

  try {
    const reqRef = adminDb.collection('matchRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return fail('not_found', 'Match request not found', 404);

    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') {
      return fail('conflict', `Request is already ${reqData.status}`, 409);
    }

    if (action === 'withdraw') {
      if (reqData.fromUserId !== session.uid) {
        return fail('forbidden', 'Only the sender can withdraw this request', 403);
      }
      await reqRef.update({ status: 'withdrawn', updatedAt: Date.now() });
      return ok({ id: requestId, status: 'withdrawn' });
    }

    if (reqData.toUserId !== session.uid) {
      return fail('forbidden', 'Only the recipient can accept or reject this request', 403);
    }

    const now = Date.now();
    if (action === 'reject') {
      await reqRef.update({ status: 'rejected', updatedAt: now });
      await dispatchNotification({
        title: 'Match Request Declined',
        message: `${reqData.toName || 'Player'} declined your ${reqData.sport} match request.`,
        category: 'match',
        targetRole: 'player',
        recipientId: reqData.fromUserId,
        targetUserId: reqData.fromUserId,
        link: '/player',
      });
      return ok({ id: requestId, status: 'rejected' });
    }

    // Accept request -> unlock 1-on-1 chat thread deterministically
    const verif = await checkAndEnforcePlayerVerification(session.uid);
    if (!verif.canAccessRestrictedFeatures) {
      return fail('account_suspended', 'Verify your account to accept match requests.', 403);
    }

    const pair = [reqData.fromUserId, reqData.toUserId].sort();
    const chatId = `dm_${pair[0]}_${pair[1]}`;

    await reqRef.update({ status: 'accepted', chatId, updatedAt: now });

    await adminDb.collection('chats').doc(chatId).set(
      {
        type: 'direct',
        participants: pair,
        participantNames: {
          [reqData.fromUserId]: reqData.fromName || 'Player',
          [reqData.toUserId]: reqData.toName || 'Player',
        },
        sport: reqData.sport,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await dispatchNotification({
      title: 'Match Request Accepted — Chat Unlocked!',
      message: `${reqData.toName || 'Player'} accepted your ${reqData.sport} match request. You can now message each other in Matchmaking Chat.`,
      category: 'match',
      targetRole: 'player',
      recipientId: reqData.fromUserId,
      targetUserId: reqData.fromUserId,
      link: '/player',
      senderName: reqData.toName || 'PlayNex',
      idempotencyKey: `notif_match_req_acc_${requestId}`,
    });

    return ok({ id: requestId, status: 'accepted', chatId });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to update match request', 500);
  }
}
