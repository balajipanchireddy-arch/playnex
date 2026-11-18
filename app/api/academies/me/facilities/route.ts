import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
});

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb.collection('facilities').where('academyId', '==', session.uid).get();
    const facilities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(facilities);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { name, address, sport, price } = parsed.data;
    
    await adminDb.collection('facilities').add({
      academyId: session.uid,
      name, address, sport, price,
      // Default time slots: 6 PM, 7 PM, 8 PM, 9 PM are available
      slots: { '18': true, '19': true, '20': true, '21': true },
      createdAt: Date.now()
    });

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
