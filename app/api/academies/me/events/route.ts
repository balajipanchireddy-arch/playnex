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
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    const { name, sport, date, loc, price } = parsed.data;
    
    await adminDb.collection('events').add({
      academyId: session.uid,
      name, sport, date, loc, price,
      createdAt: Date.now()
    });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
