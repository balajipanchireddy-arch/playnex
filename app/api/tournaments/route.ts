import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';

const CreateTournamentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sport: z.string().min(2, 'Sport category required'),
  category: z.string().default('Open Championship'),
  participationType: z.enum(['individual', 'team']).default('individual'),
  description: z.string().default(''),
  venue: z.string().min(2, 'Venue is required'),
  date: z.string().min(2, 'Tournament date is required'),
  registrationDeadline: z.string().min(2, 'Registration deadline is required'),
  maxParticipants: z.number().int().min(2, 'At least 2 participants required'),
  entryFee: z.number().min(0).default(0),
  rules: z.string().default(''),
  posterUrl: z.string().optional().default(''),
  status: z.enum([
    'Draft',
    'Upcoming',
    'Registration Open',
    'Registration Closed',
    'Ongoing',
    'Completed',
    'Cancelled'
  ]).default('Registration Open'),
});

async function getUserRoles(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d: any) => d.data().roleId as string);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');
    const status = searchParams.get('status');
    const academyId = searchParams.get('academyId');

    let query: any = adminDb.collection('events');

    if (sport && sport !== 'All') {
      query = query.where('sport', '==', sport);
    }
    if (status && status !== 'All') {
      query = query.where('status', '==', status);
    }
    if (academyId) {
      query = query.where('academyId', '==', academyId);
    }

    const snap = await query.get();
    const data = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return ok(data);
  } catch (e: any) {
    console.error('Error fetching tournaments:', e);
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const roles = await getUserRoles(session.uid);
  const isAdmin = roles.includes('admin');
  const isAcademy = roles.includes('academy');

  if (!isAdmin && !isAcademy) {
    return fail('forbidden', 'Only administrators and academies can create tournaments', 403);
  }

  try {
    const body = await req.json();
    const parsed = CreateTournamentSchema.safeParse(body);
    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid input';
      return fail('invalid', err, 400);
    }

    const data = parsed.data;

    let organizerName = 'PlayNex Official';
    let organizerVerification = 'approved';

    if (isAcademy && !isAdmin) {
      const academyDoc = await adminDb.collection('academies').doc(session.uid).get();
      if (academyDoc.exists) {
        organizerName = academyDoc.data()?.academyName || 'Sports Academy';
        organizerVerification = academyDoc.data()?.verificationStatus || 'pending';
      }
    } else if (isAdmin) {
      organizerName = 'PlayNex Tournament Authority';
      organizerVerification = 'approved';
    }

    const tournamentDoc = {
      ...data,
      academyId: session.uid,
      academyName: organizerName,
      academyVerification: organizerVerification,
      organizerType: isAdmin ? 'admin' : 'academy',
      loc: data.venue,
      price: data.entryFee,
      registeredCount: 0,
      createdAt: Date.now(),
      createdBy: session.uid,
      updatedAt: Date.now(),
    };

    const docRef = await adminDb.collection('events').add(tournamentDoc);

    // Audit log
    await logActivity({
      userId: session.uid,
      userName: organizerName,
      action: 'tournament_created',
      entityType: 'tournament',
      entityId: docRef.id,
      details: `Created tournament "${data.name}" (${data.sport}) with status ${data.status}`,
    });

    // AUTOMATIC CROSS-PORTAL NOTIFICATION:
    // Only notify players if tournament is published (Registration Open or Upcoming), NOT if it's an unpublished Draft
    if (data.status === 'Registration Open' || data.status === 'Upcoming') {
      await dispatchNotification({
        title: `New Tournament: ${data.name}`,
        message: `${organizerName} announced ${data.name} in ${data.sport}. Date: ${data.date}. Venue: ${data.venue}. Register before ${data.registrationDeadline}!`,
        category: 'tournament',
        targetRole: 'player',
        targetSport: data.sport,
        link: '/player',
        senderName: organizerName,
        idempotencyKey: `notif_tournament_published_${docRef.id}`,
      });
    }

    return ok({ id: docRef.id, ...tournamentDoc }, 201);
  } catch (e: any) {
    console.error('Failed to create tournament:', e);
    return fail('server_error', e.message, 500);
  }
}
