import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

/** Resolve the target academy ID (admins may pass ?academyId=...) */
async function resolveAcademyId(uid: string, requestedAcademyId?: string | null): Promise<{ academyId: string | null; isAdminUser: boolean }> {
  const adminUser = await isAdmin(uid);
  if (adminUser && requestedAcademyId) {
    return { academyId: requestedAcademyId, isAdminUser: true };
  }
  const snap = await adminDb.collection('academies').where('ownerUserId', '==', uid).limit(1).get();
  if (!snap.empty) {
    return { academyId: snap.docs[0].id, isAdminUser: adminUser };
  }
  // Fallback: academy doc keyed by uid
  const directDoc = await adminDb.collection('academies').doc(uid).get();
  if (directDoc.exists) {
    return { academyId: uid, isAdminUser: adminUser };
  }
  return { academyId: adminUser ? (requestedAcademyId || uid) : null, isAdminUser: adminUser };
}

// GET — list staff for this academy (or requested academyId if admin)
export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const requestedAcademyId = searchParams.get('academyId');
  const { academyId, isAdminUser } = await resolveAcademyId(session.uid, requestedAcademyId);

  if (!academyId && !isAdminUser) {
    return ok([]);
  }

  try {
    const snap = await adminDb
      .collection('staffProfiles')
      .where('academyId', '==', academyId || session.uid)
      .get();

    const staff = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return ok(staff);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const AddBody = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  academyId: z.string().optional(),
});

// POST — add a staff member
export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = AddBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid staff data', 400);

  const { email, fullName, role, phone, permissions, academyId: bodyAcademyId } = parsed.data;
  const { academyId, isAdminUser } = await resolveAcademyId(session.uid, bodyAcademyId);

  if (!academyId && !isAdminUser) {
    return fail('forbidden', 'You must own an academy to manage staff', 403);
  }

  const now = Date.now();
  const targetAcademyId = academyId || 'admin_managed';

  try {
    const docRef = adminDb.collection('staffProfiles').doc();
    const record = {
      academyId: targetAcademyId,
      email,
      fullName,
      role,
      phone: phone || '',
      permissions: permissions || ['view_grounds', 'check_in_players'],
      status: 'active',
      addedBy: session.uid,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(record);

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Academy Admin',
      action: 'staff_added',
      entityType: 'staff',
      entityId: docRef.id,
      details: `Added staff "${fullName}" (${role}) to academy ${targetAcademyId}`,
    });

    return ok({ id: docRef.id, ...record });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const PatchBody = z.object({
  staffId: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional(),
  role: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

// PATCH — update status, role, details, or permissions (scoped to owning academy or admin)
export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid patch payload', 400);

  const { staffId, ...updates } = parsed.data;

  try {
    const ref = adminDb.collection('staffProfiles').doc(staffId);
    const snap = await ref.get();
    if (!snap.exists) return fail('not_found', 'Staff record not found', 404);

    const { academyId, isAdminUser } = await resolveAcademyId(session.uid);
    if (!isAdminUser && snap.data()?.academyId !== academyId) {
      return fail('forbidden', 'Cannot modify staff from another academy', 403);
    }

    await ref.update({
      ...updates,
      updatedAt: Date.now(),
    });
    return ok({ id: staffId, ...updates });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

// DELETE — remove a staff member (scoped to owning academy or admin)
export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return fail('invalid', 'staffId required', 400);

  try {
    const ref = adminDb.collection('staffProfiles').doc(staffId);
    const snap = await ref.get();
    if (!snap.exists) return fail('not_found', 'Staff record not found', 404);

    const { academyId, isAdminUser } = await resolveAcademyId(session.uid);
    if (!isAdminUser && snap.data()?.academyId !== academyId) {
      return fail('forbidden', 'Cannot delete staff from another academy', 403);
    }

    await ref.delete();
    return ok({ deleted: true, staffId });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
