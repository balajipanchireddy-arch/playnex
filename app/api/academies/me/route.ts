import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { isValidCoordinates } from '@/lib/location/geo';
import { deleteAcademyCascade } from '@/lib/services/deletion';
import { findUserAcademyDoc } from '@/lib/academies/resolve';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    let academyDoc = await findUserAcademyDoc(session.uid);

    if (!academyDoc) {
      const academyRef = adminDb.collection('academies').doc(session.uid);
      const userDoc = await adminDb.collection('users').doc(session.uid).get();
      const userData = userDoc.exists ? userDoc.data() : undefined;
      const userName = userData?.fullName || 'Sports Arena';
      const initialData = {
        academyId: session.uid,
        ownerUserId: session.uid,
        academyName: `${userName}'s Academy`,
        address: userData?.address || 'Address pending update',
        contact: userData?.email || '',
        verificationStatus: 'pending',
        createdAt: Date.now(),
      };
      await academyRef.set(initialData);
      academyDoc = await academyRef.get();
    }

    return ok({ id: academyDoc.id, ...academyDoc.data() });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const UpdateAcademyBody = z.object({
  academyName: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  contact: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = UpdateAcademyBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', parsed.error.errors[0]?.message || 'Invalid academy update', 400);

  const { lat, lng, ...rest } = parsed.data;
  const updates: Record<string, any> = { ...rest, updatedAt: Date.now() };

  if (lat !== undefined && lng !== undefined) {
    if (lat === null || lng === null) {
      updates.location = null;
    } else if (!isValidCoordinates(lat, lng)) {
      return fail('invalid', 'Invalid latitude/longitude coordinates', 400);
    } else {
      updates.location = { lat, lng, updatedAt: Date.now() };
    }
  }

  try {
    const existingDoc = await findUserAcademyDoc(session.uid);
    if (!existingDoc) return fail('not_found', 'Academy profile not found', 404);

    await existingDoc.ref.set(updates, { merge: true });
    const updated = await existingDoc.ref.get();
    return ok({ id: updated.id, ...updated.data() });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const requestedAcademyId = searchParams.get('academyId');

  try {
    const adminUser = await isAdmin(session.uid);
    const callerAcademy = adminUser ? null : await findUserAcademyDoc(session.uid);
    const targetAcademyId =
      adminUser && requestedAcademyId
        ? requestedAcademyId
        : callerAcademy?.id || session.uid;
    const result = await deleteAcademyCascade(targetAcademyId, session.uid, adminUser);
    if (result.status !== 200) {
      return fail(
        result.status === 404 ? 'not_found' : 'forbidden',
        result.error || 'Failed to delete academy',
        result.status
      );
    }
    return ok(result.data);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to delete academy', 500);
  }
}
