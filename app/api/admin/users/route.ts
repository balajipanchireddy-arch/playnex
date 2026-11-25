import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin, isSuperAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';


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

    // Only the trusted Super Admin may permanently delete accounts or manage other admins.
    const actorIsSuperAdmin = await isSuperAdmin(session.uid);
    const targetIsSuperAdmin = await isSuperAdmin(userId);

    if (targetIsSuperAdmin) {
      return fail('forbidden', 'The trusted Super Admin account cannot be deleted or suspended', 403);
    }

    if (permanent && !actorIsSuperAdmin) {
      return fail('forbidden', 'Only the Super Admin can permanently delete user accounts', 403);
    }

    const targetRolesSnap = await adminDb.collection('userRoles')
      .where('userId', '==', userId)
      .where('roleId', '==', 'admin')
      .where('status', '==', 'active')
      .get();

    if (!targetRolesSnap.empty && !actorIsSuperAdmin) {
      return fail('forbidden', 'Only the Super Admin can manage another active administrator', 403);
    }

    if (permanent) {
      // Delete Firebase Authentication account first.
      try {
        await adminAuth.deleteUser(userId);
      } catch (authError: any) {
        if (authError?.code !== 'auth/user-not-found') throw authError;
      }

      const rolesSnap = await adminDb.collection('userRoles')
        .where('userId', '==', userId)
        .get();

      // Keep Firestore batches below the 500-operation limit.
      const firstBatch = adminDb.batch();
      firstBatch.delete(userRef);
      firstBatch.delete(adminDb.collection('playerProfiles').doc(userId));
      firstBatch.delete(adminDb.collection('stores').doc(userId));
      firstBatch.delete(adminDb.collection('academies').doc(userId));
      firstBatch.delete(adminDb.collection('staffProfiles').doc(userId));
      await firstBatch.commit();

      for (let i = 0; i < rolesSnap.docs.length; i += 400) {
        const batch = adminDb.batch();
        rolesSnap.docs.slice(i, i + 400).forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }

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
      for (let i = 0; i < rolesSnap.docs.length; i += 400) {
        const batch = adminDb.batch();
        rolesSnap.docs.slice(i, i + 400).forEach((d: any) => {
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

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const { userId, action } = await req.json();
    if (!userId || action !== 'reactivate') {
      return fail('invalid', 'userId and action="reactivate" are required', 400);
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return fail('not_found', 'User record not found', 404);

    const now = Date.now();
    await userRef.update({
      accountStatus: 'active',
      reactivatedAt: now,
      reactivatedBy: session.uid,
      updatedAt: now,
    });

    const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', userId).get();
    for (let i = 0; i < rolesSnap.docs.length; i += 400) {
      const batch = adminDb.batch();
      rolesSnap.docs.slice(i, i + 400).forEach((d: any) => {
        if (d.data().status === 'suspended') {
          batch.update(d.ref, { status: 'active', updatedAt: now });
        }
      });
      await batch.commit();
    }

    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: 'user_reactivated',
      entityType: 'user',
      entityId: userId,
      details: `Reactivated user account "${userSnap.data()?.fullName || userSnap.data()?.email || userId}"`,
    });

    return ok({ success: true, userId, status: 'active' });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to reactivate user', 500);
  }
}

