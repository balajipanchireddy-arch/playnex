import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

const ActionSchema = z.object({
  action: z.enum([
    'join_request',
    'withdraw',
    'accept',
    'reject',
    'leave',
    'remove',
    'confirm',
    'cancel',
  ]),
  targetUserId: z.string().optional(),
  bookingId: z.string().optional(),
  facilityId: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const matchId = params.id;
  if (!matchId) return fail('invalid', 'Match ID required', 400);

  const parsed = ActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid action', 400);
  }

  const { action, targetUserId, bookingId, facilityId } = parsed.data;
  const adminUser = await isAdmin(session.uid);

  if (!adminUser && ['join_request', 'accept', 'confirm'].includes(action)) {
    const verif = await checkAndEnforcePlayerVerification(session.uid);
    if (!verif.canAccessRestrictedFeatures) {
      return fail(
        'account_suspended',
        'Your account is suspended due to expired 5-day verification. Submit proof to participate in matches.',
        403
      );
    }
  }

  const matchRef = adminDb.collection('matches').doc(matchId);

  try {
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const actorName = userDoc.exists
      ? userDoc.data()?.fullName || session.email || 'Player'
      : session.email || 'Player';

    const result = await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(matchRef);
      if (!snap.exists) throw new Error('NOT_FOUND');

      const m = snap.data();
      const now = Date.now();

      if (m.status === 'cancelled') throw new Error('MATCH_CANCELLED');
      if (m.expiresAt && now > m.expiresAt && action !== 'cancel' && action !== 'withdraw') {
        throw new Error('MATCH_EXPIRED');
      }

      const participants: string[] = Array.isArray(m.participants) ? [...m.participants] : [];
      const participantDetails: any[] = Array.isArray(m.participantDetails) ? [...m.participantDetails] : [];
      const pendingRequests: any[] = Array.isArray(m.pendingRequests) ? [...m.pendingRequests] : [];
      const waitlist: any[] = Array.isArray(m.waitlist) ? [...m.waitlist] : [];
      const requiredPlayers = Number(m.requiredPlayers) || 2;

      if (action === 'join_request') {
        if (participants.includes(session.uid)) throw new Error('ALREADY_JOINED');
        if (pendingRequests.some((r) => r.userId === session.uid)) {
          throw new Error('ALREADY_REQUESTED');
        }

        if (participants.length >= requiredPlayers) {
          if (waitlist.some((w) => w.userId === session.uid)) {
            throw new Error('ALREADY_WAITLISTED');
          }
          waitlist.push({ userId: session.uid, name: actorName, requestedAt: now });
          tx.update(matchRef, { waitlist, updatedAt: now });
          return { status: m.status, waitlisted: true, match: m };
        }

        pendingRequests.push({ userId: session.uid, name: actorName, requestedAt: now });
        tx.update(matchRef, { pendingRequests, updatedAt: now });
        return { status: m.status, requested: true, match: m };
      }

      if (action === 'withdraw') {
        const hadPending = pendingRequests.some((r) => r.userId === session.uid);
        const hadWaitlist = waitlist.some((w) => w.userId === session.uid);
        if (!hadPending && !hadWaitlist) {
          throw new Error('NO_PENDING_REQUEST');
        }
        const nextPending = pendingRequests.filter((r) => r.userId !== session.uid);
        const nextWaitlist = waitlist.filter((w) => w.userId !== session.uid);
        tx.update(matchRef, {
          pendingRequests: nextPending,
          waitlist: nextWaitlist,
          updatedAt: now,
        });
        return { status: m.status, withdrawn: true, match: m };
      }

      if (action === 'accept') {
        if (m.creatorId !== session.uid && !adminUser) throw new Error('FORBIDDEN');
        if (!targetUserId) throw new Error('TARGET_REQUIRED');
        if (participants.includes(targetUserId)) throw new Error('ALREADY_JOINED');
        if (participants.length >= requiredPlayers) throw new Error('MATCH_FULL');

        const reqIdx = pendingRequests.findIndex((r) => r.userId === targetUserId);
        const reqInfo = reqIdx >= 0 ? pendingRequests[reqIdx] : { userId: targetUserId, name: 'Player' };
        if (reqIdx >= 0) pendingRequests.splice(reqIdx, 1);

        participants.push(targetUserId);
        participantDetails.push({ uid: targetUserId, name: reqInfo.name || 'Player', joinedAt: now });

        const nextStatus = participants.length >= requiredPlayers ? 'full' : 'open';
        tx.update(matchRef, {
          participants,
          participantDetails,
          pendingRequests,
          participantCount: participants.length,
          status: nextStatus,
          updatedAt: now,
        });

        return {
          status: nextStatus,
          acceptedUserId: targetUserId,
          becameFull: nextStatus === 'full',
          updatedParticipants: participants,
          updatedParticipantDetails: participantDetails,
          match: m,
        };
      }

      if (action === 'reject') {
        if (m.creatorId !== session.uid && !adminUser) throw new Error('FORBIDDEN');
        if (!targetUserId) throw new Error('TARGET_REQUIRED');

        const filtered = pendingRequests.filter((r) => r.userId !== targetUserId);
        tx.update(matchRef, { pendingRequests: filtered, updatedAt: now });
        return { status: m.status, rejectedUserId: targetUserId, match: m };
      }

      if (action === 'leave') {
        if (m.creatorId === session.uid) throw new Error('CREATOR_CANNOT_LEAVE');
        if (!participants.includes(session.uid)) throw new Error('NOT_A_PARTICIPANT');

        const nextParticipants = participants.filter((uid) => uid !== session.uid);
        const nextDetails = participantDetails.filter((p) => p.uid !== session.uid);
        const nextStatus = nextParticipants.length < requiredPlayers && m.status === 'full' ? 'open' : m.status;

        tx.update(matchRef, {
          participants: nextParticipants,
          participantDetails: nextDetails,
          participantCount: nextParticipants.length,
          status: nextStatus,
          updatedAt: now,
        });
        return { status: nextStatus, left: true, updatedParticipants: nextParticipants, match: m };
      }

      if (action === 'remove') {
        if (m.creatorId !== session.uid && !adminUser) throw new Error('FORBIDDEN');
        if (!targetUserId || targetUserId === m.creatorId) throw new Error('CANNOT_REMOVE_CREATOR');

        const nextParticipants = participants.filter((uid) => uid !== targetUserId);
        const nextDetails = participantDetails.filter((p) => p.uid !== targetUserId);
        const nextStatus = nextParticipants.length < requiredPlayers && m.status === 'full' ? 'open' : m.status;

        tx.update(matchRef, {
          participants: nextParticipants,
          participantDetails: nextDetails,
          participantCount: nextParticipants.length,
          status: nextStatus,
          updatedAt: now,
        });
        return { status: nextStatus, removedUserId: targetUserId, updatedParticipants: nextParticipants, match: m };
      }

      if (action === 'confirm') {
        if (m.creatorId !== session.uid && !adminUser) throw new Error('FORBIDDEN');
        tx.update(matchRef, {
          status: 'ready',
          ...(bookingId ? { bookingId } : {}),
          ...(facilityId ? { facilityId } : {}),
          updatedAt: now,
        });
        return { status: 'ready', match: m };
      }

      if (action === 'cancel') {
        if (m.creatorId !== session.uid && !adminUser) throw new Error('FORBIDDEN');
        tx.update(matchRef, { status: 'cancelled', cancelledAt: now, updatedAt: now });
        return { status: 'cancelled', participants, match: m };
      }

      throw new Error('INVALID_ACTION');
    });

    const m = result.match;

    // Keep match group chat synced with accepted participants
    if (action === 'accept' && Array.isArray(result.updatedParticipants)) {
      const chatRef = adminDb.collection('chats').doc(`match_${matchId}`);
      await chatRef.set(
        {
          type: 'match',
          matchId,
          title: `${m.sport} Match · ${m.location}`,
          participants: result.updatedParticipants,
          participantNames: Object.fromEntries(
            (result.updatedParticipantDetails || []).map((p: any) => [p.uid, p.name || 'Player'])
          ),
          updatedAt: Date.now(),
          createdAt: m.createdAt || Date.now(),
        },
        { merge: true }
      );
    } else if ((action === 'leave' || action === 'remove') && Array.isArray(result.updatedParticipants)) {
      const chatRef = adminDb.collection('chats').doc(`match_${matchId}`);
      const chatSnap = await chatRef.get();
      if (chatSnap.exists) {
        await chatRef.update({ participants: result.updatedParticipants, updatedAt: Date.now() });
      }
    }

    if (action === 'join_request' && m?.creatorId) {
      await dispatchNotification({
        title: result.waitlisted ? 'Match Waitlist Request' : 'New Match Join Request',
        message: `${actorName} wants to join your ${m.sport} match at ${m.location}.`,
        category: 'match',
        targetRole: 'player',
        recipientId: m.creatorId,
        targetUserId: m.creatorId,
        link: '/player',
        senderName: actorName,
      });
    } else if (action === 'accept' && targetUserId) {
      await dispatchNotification({
        title: 'Match Request Accepted!',
        message: `You have been accepted into ${m.creatorName}'s ${m.sport} match at ${m.location}. Match chat is now unlocked!`,
        category: 'match',
        targetRole: 'player',
        recipientId: targetUserId,
        targetUserId,
        link: '/player',
        senderName: m.creatorName || 'PlayNex',
      });
      if (result.becameFull) {
        for (const uid of result.updatedParticipants || m.participants || []) {
          await dispatchNotification({
            title: 'Match is Now Full!',
            message: `Your ${m.sport} match at ${m.location} has reached full capacity and is ready for booking.`,
            category: 'match',
            targetRole: 'player',
            recipientId: uid,
            targetUserId: uid,
            link: '/player',
          });
        }
      }
    } else if (action === 'reject' && targetUserId) {
      await dispatchNotification({
        title: 'Match Request Declined',
        message: `Your request to join the ${m.sport} match at ${m.location} was declined.`,
        category: 'match',
        targetRole: 'player',
        recipientId: targetUserId,
        targetUserId,
        link: '/player',
      });
    } else if (action === 'cancel' && Array.isArray(result.participants)) {
      for (const uid of result.participants) {
        if (uid !== session.uid) {
          await dispatchNotification({
            title: 'Match Cancelled',
            message: `The ${m.sport} match at ${m.location} on ${m.date} was cancelled by the organizer.`,
            category: 'match',
            targetRole: 'player',
            recipientId: uid,
            targetUserId: uid,
            link: '/player',
          });
        }
      }
    }

    await logActivity({
      userId: session.uid,
      userName: actorName,
      action: `match_${action}`,
      entityType: 'match',
      entityId: matchId,
      details: `Match action "${action}" on ${m?.sport || matchId}`,
    });

    return ok({ id: matchId, ...result, match: undefined });
  } catch (e: any) {
    const codeMap: Record<string, [string, number]> = {
      NOT_FOUND: ['Match not found', 404],
      FORBIDDEN: ['You are not authorized for this action', 403],
      MATCH_CANCELLED: ['This match has been cancelled', 400],
      MATCH_EXPIRED: ['This match has expired', 400],
      ALREADY_JOINED: ['You are already a participant in this match', 409],
      ALREADY_REQUESTED: ['You have already requested to join this match', 409],
      ALREADY_WAITLISTED: ['You are already on the waitlist', 409],
      NO_PENDING_REQUEST: ['No pending request found to withdraw', 404],
      MATCH_FULL: ['This match has reached its player capacity', 409],
      NOT_A_PARTICIPANT: ['You are not a participant in this match', 400],
      CREATOR_CANNOT_LEAVE: ['Match creator cannot leave; cancel the match instead', 400],
    };
    const mapped = codeMap[e?.message];
    if (mapped) return fail(e.message.toLowerCase(), mapped[0], mapped[1]);
    return fail('server_error', e?.message || 'Match action failed', 500);
  }
}
