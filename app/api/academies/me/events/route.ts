import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';

const Body = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sport: z.string().min(2, 'Sport category required'),
  category: z.string().default('Open Championship'),
  participationType: z.enum(['individual', 'team']).default('individual'),
  description: z.string().default(''),
  venue: z.string().min(2, 'Venue is required').optional(),
  loc: z.string().min(2).optional(),
  date: z.string().min(2, 'Tournament date is required'),
  registrationDeadline: z.string().optional(),
  maxParticipants: z.number().int().min(2).default(32),
  entryFee: z.number().min(0).default(0).optional(),
  price: z.number().min(0).default(0).optional(),
  rules: z.string().default(''),
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

async function isAcademyOrAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  const roles = snap.docs.map((d: any) => d.data().roleId);
  return roles.includes('admin') || roles.includes('academy');
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const snap = await adminDb.collection('events').where('academyId', '==', session.uid).get();
    const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!(await isAcademyOrAdmin(session.uid))) {
    return fail('forbidden', 'Academy operator permissions required', 403);
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', parsed.error.issues[0]?.message || 'Invalid input payload', 400);
    }
    const d = parsed.data;
    
    const academyDoc = await adminDb.collection('academies').doc(session.uid).get();
    const academyName = academyDoc.exists ? academyDoc.data()?.academyName : 'Sports Academy';
    const academyVerification = academyDoc.exists ? academyDoc.data()?.verificationStatus : 'pending';

    const venue = d.venue || d.loc || 'Main Arena';
    const entryFee = d.entryFee !== undefined ? d.entryFee : (d.price || 0);
    const deadline = d.registrationDeadline || d.date;

    const eventData = {
      academyId: session.uid,
      academyName,
      academyVerification,
      name: d.name,
      sport: d.sport,
      category: d.category,
      participationType: d.participationType,
      description: d.description,
      venue,
      loc: venue,
      date: d.date,
      registrationDeadline: deadline,
      maxParticipants: d.maxParticipants,
      entryFee,
      price: entryFee,
      rules: d.rules,
      status: d.status,
      registeredCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await adminDb.collection('events').add(eventData);

    await logActivity({
      userId: session.uid,
      userName: academyName,
      action: 'tournament_created',
      entityType: 'tournament',
      entityId: docRef.id,
      details: `${academyName} published event "${d.name}" (${d.sport})`,
    });

    // AUTOMATIC ACADEMY-TO-PLAYER NOTIFICATION:
    // Only dispatch when published, targeted by sport
    if (d.status === 'Registration Open' || d.status === 'Upcoming') {
      await dispatchNotification({
        title: `🏆 New Academy Event: ${d.name}`,
        message: `${academyName} announced ${d.name} (${d.sport}) on ${d.date} at ${venue}. Entries open now!`,
        category: 'academy',
        targetRole: 'player',
        targetSport: d.sport,
        link: '/player',
        senderName: academyName,
        idempotencyKey: `notif_academy_event_${docRef.id}`,
      });
    }

    return ok({ id: docRef.id, ...eventData });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
