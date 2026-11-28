import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin as checkAdminAccess } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity, sendNotification } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';
import { getUserOwnedAcademyIds } from '@/lib/academies/resolve';

async function getUserRoles(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d: any) => d.data().roleId as string);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const eventDoc = await adminDb.collection('events').doc(params.id).get();
    if (!eventDoc.exists) return fail('not_found', 'Tournament not found', 404);

    const [isAdmin, ownedAcademyIds] = await Promise.all([
      checkAdminAccess(session.uid),
      getUserOwnedAcademyIds(session.uid),
    ]);
    const isOwner = ownedAcademyIds.has(eventDoc.data()?.academyId);

    let query: any = adminDb.collection('registrations').where('eventId', '==', params.id);
    if (!isAdmin && !isOwner) {
      // Regular player can only see their own registration
      query = query.where('userId', '==', session.uid);
    }

    const snap = await query.get();
    const data = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired 5-day verification. Submit proof to register for tournaments.',
      403
    );
  }

  const eventRef = adminDb.collection('events').doc(params.id);

  try {
    // Read player info
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const playerName = userDoc.exists ? (userDoc.data()?.fullName || session.email) : session.email;

    let regResult: any = null;

    await adminDb.runTransaction(async (t: any) => {
      const eventSnap = await t.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('TOURNAMENT_NOT_FOUND');
      }

      const eventData = eventSnap.data();

      // Check status
      const validStatuses = ['Registration Open', 'Upcoming'];
      if (!validStatuses.includes(eventData.status)) {
        throw new Error('REGISTRATION_CLOSED');
      }

      // Check deadline
      if (eventData.registrationDeadline) {
        const deadlineDate = new Date(eventData.registrationDeadline).getTime();
        if (!isNaN(deadlineDate) && Date.now() > deadlineDate + 86400000) { // allow through end of deadline day
          throw new Error('DEADLINE_PASSED');
        }
      }

      // Check capacity
      const maxParticipants = eventData.maxParticipants || 100;
      const registeredCount = eventData.registeredCount || 0;
      if (registeredCount >= maxParticipants) {
        throw new Error('CAPACITY_FULL');
      }

      // Check duplicate registration
      const regQuery = adminDb.collection('registrations')
        .where('eventId', '==', params.id)
        .where('userId', '==', session.uid);
      const existingSnap = await t.get(regQuery);
      if (!existingSnap.empty) {
        throw new Error('ALREADY_REGISTERED');
      }

      // Update tournament registeredCount
      const newCount = registeredCount + 1;
      t.update(eventRef, {
        registeredCount: newCount,
        updatedAt: Date.now(),
      });

      // Create registration record
      const newRegRef = adminDb.collection('registrations').doc();
      const newRegData = {
        eventId: params.id,
        tournamentName: eventData.name,
        sport: eventData.sport,
        venue: eventData.venue || eventData.loc,
        date: eventData.date,
        userId: session.uid,
        userName: playerName,
        userEmail: session.email || '',
        status: 'confirmed',
        createdAt: Date.now(),
      };

      t.set(newRegRef, newRegData);
      regResult = { id: newRegRef.id, ...newRegData, newRegisteredCount: newCount };
    });

    // Send activity log & notification
    await logActivity({
      userId: session.uid,
      userName: playerName,
      action: 'tournament_registered',
      entityType: 'registration',
      entityId: regResult?.id,
      details: `Player ${playerName} registered for tournament "${regResult?.tournamentName}"`,
    });

    await sendNotification({
      title: '✅ Tournament Registration Confirmed',
      message: `You are registered for ${regResult?.tournamentName} (${regResult?.sport}) on ${regResult?.date}. Venue: ${regResult?.venue}.`,
      category: 'registration',
      targetRole: 'player',
      targetUserId: session.uid,
      link: '/player',
      senderName: 'PlayNex Registration Desk',
    });

    return ok(regResult);
  } catch (e: any) {
    if (e.message === 'TOURNAMENT_NOT_FOUND') return fail('not_found', 'Tournament not found', 404);
    if (e.message === 'REGISTRATION_CLOSED') return fail('closed', 'Registration is currently closed for this tournament', 400);
    if (e.message === 'DEADLINE_PASSED') return fail('deadline', 'Registration deadline has passed', 400);
    if (e.message === 'CAPACITY_FULL') return fail('full', 'Tournament has reached maximum capacity', 400);
    if (e.message === 'ALREADY_REGISTERED') return fail('already_registered', 'You are already registered for this tournament', 400);
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const eventRef = adminDb.collection('events').doc(params.id);

  try {
    const regQuery = adminDb.collection('registrations')
      .where('eventId', '==', params.id)
      .where('userId', '==', session.uid);
    const snap = await regQuery.get();
    if (snap.empty) return fail('not_found', 'Registration not found', 404);

    const regDoc = snap.docs[0];

    await adminDb.runTransaction(async (t: any) => {
      const eventSnap = await t.get(eventRef);
      if (eventSnap.exists) {
        const curCount = eventSnap.data()?.registeredCount || 1;
        t.update(eventRef, {
          registeredCount: Math.max(0, curCount - 1),
          updatedAt: Date.now(),
        });
      }
      t.delete(regDoc.ref);
    });

    await logActivity({
      userId: session.uid,
      action: 'tournament_registration_cancelled',
      entityType: 'registration',
      entityId: regDoc.id,
      details: `Player cancelled registration for tournament ${params.id}`,
    });

    return ok({ success: true, message: 'Registration cancelled' });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

// PATCH for Admin or Academy to approve/reject/modify registration status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const isAdmin = await checkAdminAccess(session.uid);

  try {
    const eventDoc = await adminDb.collection('events').doc(params.id).get();
    if (!eventDoc.exists) return fail('not_found', 'Tournament not found', 404);

    const ownedAcademyIds = await getUserOwnedAcademyIds(session.uid);
    const isOwner = ownedAcademyIds.has(eventDoc.data()?.academyId);
    if (!isAdmin && !isOwner) {
      return fail('forbidden', 'Only tournament organizers can manage registrations', 403);
    }

    const { registrationId, status } = await req.json();
    if (!registrationId || !status) {
      return fail('invalid', 'registrationId and status required', 400);
    }

    const regRef = adminDb.collection('registrations').doc(registrationId);
    const regSnap = await regRef.get();
    if (!regSnap.exists) return fail('not_found', 'Registration not found', 404);

    await regRef.update({
      status,
      updatedAt: Date.now(),
      reviewedBy: session.uid,
    });

    // Notify player of status change
    const regData = regSnap.data();
    await sendNotification({
      title: `Registration Status: ${status === 'confirmed' ? 'Approved ✅' : status === 'rejected' ? 'Rejected ❌' : status}`,
      message: `Your registration for ${eventDoc.data()?.name} has been marked as ${status}.`,
      category: 'registration',
      targetRole: 'player',
      targetUserId: regData?.userId,
      link: '/player',
      senderName: eventDoc.data()?.academyName || 'PlayNex Admin',
    });

    return ok({ success: true, registrationId, status });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
