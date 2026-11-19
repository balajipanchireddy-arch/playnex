import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({ eventId: z.string() });

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const existing = await adminDb.collection('registrations')
      .where('eventId', '==', parsed.data.eventId)
      .where('userId', '==', session.uid)
      .get();
      
    if (!existing.empty) return fail('already_registered', 'You are already registered!', 400);

    await adminDb.collection('registrations').add({
      eventId: parsed.data.eventId,
      userId: session.uid,
      createdAt: Date.now()
    });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
