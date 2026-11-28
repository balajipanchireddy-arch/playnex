import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin as checkAdminAccess } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { findUserAcademyDoc, getUserOwnedAcademyIds } from '@/lib/academies/resolve';

const PUBLIC_TOURNAMENT_STATUSES = new Set(['Registration Open', 'Upcoming', 'Ongoing']);

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
    const session = await verifySession();
    const [callerIsAdmin, ownedAcademyIds] = session
      ? await Promise.all([checkAdminAccess(session.uid), getUserOwnedAcademyIds(session.uid)])
      : [false, new Set<string>()];

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

    const [snap, academiesSnap] = await Promise.all([
      query.get(),
      adminDb.collection('academies').where('verificationStatus', '==', 'approved').get(),
    ]);
    const approvedAcademyIds = new Set<string>(academiesSnap.docs.map((d: any) => d.id));

    const data = snap.docs
      .filter((d: any) => {
        if (callerIsAdmin) return true;
        const ev = d.data() || {};
        if (session && ownedAcademyIds.has(ev.academyId)) return true;
        if (ev.status === 'Draft') return false;

        const isApprovedSource =
          ev.organizerType === 'admin' ||
          ev.academyVerification === 'approved' ||
          approvedAcademyIds.has(ev.academyId);
        if (!isApprovedSource) return false;

        if (!session) {
          return PUBLIC_TOURNAMENT_STATUSES.has(ev.status || 'Upcoming');
        }
        return true;
      })
      .map((d: any) => {
        const ev = d.data() || {};
        const base = {
          id: d.id,
          name: ev.name || 'Tournament',
          sport: ev.sport || 'Sport',
          category: ev.category || 'Open Championship',
          participationType: ev.participationType || 'individual',
          description: ev.description || '',
          venue: ev.venue || ev.loc || '',
          loc: ev.loc || ev.venue || '',
          date: ev.date || '',
          registrationDeadline: ev.registrationDeadline || '',
          maxParticipants: ev.maxParticipants ?? 0,
          registeredCount: ev.registeredCount ?? 0,
          entryFee: ev.entryFee ?? ev.price ?? 0,
          price: ev.price ?? ev.entryFee ?? 0,
          rules: ev.rules || '',
          posterUrl: ev.posterUrl || '',
          status: ev.status || 'Upcoming',
          academyName: ev.academyName || 'PlayNex',
          createdAt: ev.createdAt || 0,
        };
        if (!session) return base;
        return {
          ...base,
          academyId: ev.academyId || null,
          academyVerification: ev.academyVerification || null,
          organizerType: ev.organizerType || null,
        };
      });

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

  const [roles, isAdmin] = await Promise.all([
    getUserRoles(session.uid),
    checkAdminAccess(session.uid),
  ]);
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

    let resolvedAcademyId = session.uid;
    let organizerName = 'PlayNex Official';
    let organizerVerification = 'approved';

    if (isAcademy && !isAdmin) {
      const academyDoc = await findUserAcademyDoc(session.uid);
      if (!academyDoc || academyDoc.data()?.verificationStatus !== 'approved') {
        return fail(
          'forbidden',
          'Your academy must be approved by PlayNex Admin before creating tournaments.',
          403
        );
      }
      resolvedAcademyId = academyDoc.id;
      organizerName = academyDoc.data()?.academyName || 'Sports Academy';
      organizerVerification = academyDoc.data()?.verificationStatus || 'pending';
    } else if (isAdmin) {
      organizerName = 'PlayNex Tournament Authority';
      organizerVerification = 'approved';
    }

    const tournamentDoc = {
      ...data,
      academyId: resolvedAcademyId,
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
