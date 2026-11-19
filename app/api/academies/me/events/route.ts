import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  name: z.string().min(2),
  sport: z.string().min(2),
  date: z.string().min(2),
  loc: z.string().min(2),
  price: z.number().min(0),
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
    return ok(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!(await isAcademyOrAdmin(session.uid))) {
    return fail('forbidden', 'Academy operator permissions required', 403);
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { name, sport, date, loc, price } = parsed.data;
    
    const academyDoc = await adminDb.collection('academies').doc(session.uid).get();
    const academyName = academyDoc.exists ? academyDoc.data()?.academyName : 'Sports Academy';
    const academyVerification = academyDoc.exists ? academyDoc.data()?.verificationStatus : 'pending';

    await adminDb.collection('events').add({
      academyId: session.uid,
      academyName,
      academyVerification,
      name,
      sport,
      date,
      loc,
      price,
      createdAt: Date.now()
    });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
