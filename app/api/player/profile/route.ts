import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const profileDoc = await adminDb.collection('playerProfiles').doc(session.uid).get();
    
    const user = userDoc.data();
    const profile = profileDoc.exists ? profileDoc.data() : {};

    return ok({
      name: user?.fullName || 'Guest Player',
      skill: profile?.skillLevel || 'Intermediate',
      location: user?.address || 'Visakhapatnam',
      available: profile?.available || false,
    });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const Body = z.object({
  available: z.boolean().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  skill: z.string().trim().min(1).max(50).optional(),
  location: z.string().trim().min(1).max(100).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    
    const updates = parsed.data;

    if (updates.available !== undefined || updates.skill !== undefined) {
      await adminDb.collection('playerProfiles').doc(session.uid).set({
        ...(updates.available !== undefined && { available: updates.available }),
        ...(updates.skill !== undefined && { skillLevel: updates.skill }),
        updatedAt: Date.now(),
      }, { merge: true });
    }

    if (updates.name !== undefined || updates.location !== undefined) {
      await adminDb.collection('users').doc(session.uid).set({
        ...(updates.name !== undefined && { fullName: updates.name }),
        ...(updates.location !== undefined && { address: updates.location }),
        updatedAt: Date.now(),
      }, { merge: true });
    }

    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
