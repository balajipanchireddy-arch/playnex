import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity, sendNotification } from '@/lib/firebase/activity';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

const Body = z.object({ eventId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired 5-day verification. Submit proof to register for events.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);

    const { eventId } = parsed.data;
    const eventRef = adminDb.collection('events').doc(eventId);

    // Read user details
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const playerName = userDoc.exists ? (userDoc.data()?.fullName || session.email) : session.email;

    let regResult: any = null;

    await adminDb.runTransaction(async (t: any) => {
      const eventSnap = await t.get(eventRef);
      if (!eventSnap.exists) throw new Error('TOURNAMENT_NOT_FOUND');

      const eventData = eventSnap.data();

      // Check duplicate
      const regQuery = adminDb.collection('registrations')
        .where('eventId', '==', eventId)
        .where('userId', '==', session.uid);
      const existingSnap = await t.get(regQuery);
      if (!existingSnap.empty) throw new Error('ALREADY_REGISTERED');

      // Check capacity
      const maxParticipants = eventData.maxParticipants || 100;
      const registeredCount = eventData.registeredCount || 0;
      if (registeredCount >= maxParticipants) throw new Error('CAPACITY_FULL');

      // Increment count
      const newCount = registeredCount + 1;
      t.update(eventRef, {
        registeredCount: newCount,
        updatedAt: Date.now(),
      });

      const newRegRef = adminDb.collection('registrations').doc();
      const newRegData = {
        eventId,
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
      regResult = { id: newRegRef.id, ...newRegData };
    });

    // Log & notify
    await logActivity({
      userId: session.uid,
      userName: playerName,
      action: 'tournament_registered',
      entityType: 'registration',
      entityId: regResult?.id,
      details: `Player ${playerName} registered for "${regResult?.tournamentName}"`,
    });

    await sendNotification({
      title: '✅ Tournament Registration Confirmed',
      message: `You are confirmed for ${regResult?.tournamentName} (${regResult?.sport}) on ${regResult?.date}.`,
      category: 'registration',
      targetRole: 'player',
      targetUserId: session.uid,
      link: '/player',
      senderName: 'PlayNex Tournament Desk',
    });

    return ok(regResult);
  } catch (e: any) {
    if (e.message === 'TOURNAMENT_NOT_FOUND') return fail('not_found', 'Tournament not found', 404);
    if (e.message === 'ALREADY_REGISTERED') return fail('already_registered', 'You are already registered!', 400);
    if (e.message === 'CAPACITY_FULL') return fail('full', 'Tournament capacity is full', 400);
    return fail('server_error', e.message, 500);
  }
}
