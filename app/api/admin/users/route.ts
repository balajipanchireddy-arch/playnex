import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

async function isAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .get();
  return !snap.empty;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const [usersSnap, rolesSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('userRoles').get(),
    ]);

    // Map roles by userId
    const userRolesMap = new Map<string, string[]>();
    rolesSnap.docs.forEach((d: any) => {
      const data = d.data();
      const existing = userRolesMap.get(data.userId) || [];
      existing.push(data.roleId);
      userRolesMap.set(data.userId, existing);
    });

    const users = usersSnap.docs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        fullName: data.fullName || 'User',
        email: data.email || '',
        accountStatus: data.accountStatus || 'active',
        address: data.address || '',
        roles: userRolesMap.get(d.id) || ['player'],
        createdAt: data.createdAt || 0,
      };
    });

    return ok(users);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const permanent = searchParams.get('permanent') === 'true';

  if (!userId) {
    return fail('invalid', 'userId is required', 400);
  }

  if (userId === session.uid) {
    return fail('invalid', 'Administrators cannot deactivate or delete their own account', 400);
  }

  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return fail('not_found', 'User record not found', 404);
    }
    const userData = userSnap.data();

    // Prevent deleting another active admin account unless explicitly intended
    const targetRolesSnap = await adminDb.collection('userRoles')
      .where('userId', '==', userId)
      .where('roleId', '==', 'admin')
      .where('status', '==', 'active')
      .get();
    if (!targetRolesSnap.empty && !permanent) {
      return fail('forbidden', 'Cannot suspend an active administrator account', 403);
    }

    if (permanent) {
      // PERMANENT PURGE: Delete user document, profile, and roles
      const batch = adminDb.batch();
      batch.delete(userRef);
      batch.delete(adminDb.collection('playerProfiles').doc(userId));

      const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', userId).get();
      rolesSnap.docs.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();

      await logActivity({
        userId: session.uid,
        userName: 'Administrator',
        action: 'user_purged',
        entityType: 'user',
        entityId: userId,
        details: `Permanently deleted user account "${userData?.fullName || userData?.email || userId}"`,
      });

      return ok({ success: true, userId, status: 'purged' });
    } else {
      // SAFE SUSPENSION / SOFT DELETE
      await userRef.update({
        accountStatus: 'suspended',
        suspendedAt: Date.now(),
        suspendedBy: session.uid,
      });

      // Deactivate all role bindings
      const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', userId).get();
      if (!rolesSnap.empty) {
        const batch = adminDb.batch();
        rolesSnap.docs.forEach((d: any) => {
          batch.update(d.ref, { status: 'suspended' });
        });
        await batch.commit();
      }

      await logActivity({
        userId: session.uid,
        userName: 'Administrator',
        action: 'user_suspended',
        entityType: 'user',
        entityId: userId,
        details: `Suspended user account "${userData?.fullName || userData?.email || userId}"`,
      });

      return ok({ success: true, userId, status: 'suspended' });
    }
  } catch (e: any) {
    console.error('Failed to delete/suspend user:', e);
    return fail('server_error', e.message || 'Operation failed', 500);
  }
}

