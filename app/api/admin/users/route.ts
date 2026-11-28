import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin, isProtectedPermanentAdmin, isSuperAdmin } from '@/lib/auth/admin';
import { purgeUserAccountCascade } from '@/lib/services/deletion';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const [usersSnap, rolesSnap, profilesSnap, delReqSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('userRoles').get(),
      adminDb.collection('playerProfiles').get(),
      adminDb.collection('accountDeletionRequests').get(),
    ]);

    const userRolesMap = new Map<string, string[]>();
    rolesSnap.docs.forEach((d: any) => {
      const data = d.data();
      if (data.status === 'active' || data.status === 'suspended') {
        const existing = userRolesMap.get(data.userId) || [];
        if (!existing.includes(data.roleId)) existing.push(data.roleId);
        userRolesMap.set(data.userId, existing);
      }
    });

    const profileMap = new Map<string, any>();
    profilesSnap.docs.forEach((d: any) => profileMap.set(d.id, d.data()));

    const delReqMap = new Map<string, any>();
    delReqSnap.docs.forEach((d: any) => {
      const data = d.data();
      if (data.status === 'pending') delReqMap.set(data.userId, { id: d.id, ...data });
    });

    const users = await Promise.all(
      usersSnap.docs.map(async (d: any) => {
        const data = d.data();
        const prof = profileMap.get(d.id) || {};
        const protectedAdmin = await isProtectedPermanentAdmin(d.id, data.email);
        return {
          id: d.id,
          fullName: data.fullName || 'User',
          email: data.email || '',
          accountStatus: data.accountStatus || 'active',
          suspensionReason: data.suspensionReason || null,
          address: data.address || '',
          roles: userRolesMap.get(d.id) || ['player'],
          verificationStatus: prof.verificationStatus || null,
          verificationDeadline: prof.verificationDeadline || null,
          isProtectedAdmin: protectedAdmin,
          deletionRequest: delReqMap.get(d.id) || null,
          createdAt: data.createdAt || 0,
        };
      })
    );

    users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
    const userData = userSnap.data()!;

    const actorIsSuperAdmin = await isSuperAdmin(session.uid, session.email);
    const targetIsProtected = await isProtectedPermanentAdmin(userId, userData.email);

    if (targetIsProtected) {
      return fail('forbidden', 'Permanent administrator accounts cannot be deleted or suspended', 403);
    }

    if (permanent && !actorIsSuperAdmin) {
      return fail('forbidden', 'Only permanent administrators can permanently delete user accounts', 403);
    }

    const targetRolesSnap = await adminDb
      .collection('userRoles')
      .where('userId', '==', userId)
      .where('roleId', '==', 'admin')
      .where('status', '==', 'active')
      .get();

    if (!targetRolesSnap.empty && !actorIsSuperAdmin) {
      return fail('forbidden', 'Only permanent administrators can manage another active administrator', 403);
    }

    if (permanent) {
      const res = await purgeUserAccountCascade(userId, session.uid);
      if (res.status !== 200) {
        return fail('forbidden', res.error || 'Could not purge user', res.status);
      }

      // Close any pending account deletion requests for this user
      const reqSnap = await adminDb
        .collection('accountDeletionRequests')
        .where('userId', '==', userId)
        .get();
      for (const r of reqSnap.docs) {
        await r.ref.update({ status: 'completed', processedAt: Date.now(), processedBy: session.uid });
      }

      return ok(res.data);
    } else {
      const now = Date.now();
      await userRef.update({
        accountStatus: 'suspended',
        suspensionReason: 'admin_suspended',
        suspendedAt: now,
        suspendedBy: session.uid,
        updatedAt: now,
      });

      const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', userId).get();
      for (let i = 0; i < rolesSnap.docs.length; i += 400) {
        const batch = adminDb.batch();
        rolesSnap.docs.slice(i, i + 400).forEach((d: any) => {
          batch.update(d.ref, { status: 'suspended', suspensionReason: 'admin_suspended', updatedAt: now });
        });
        await batch.commit();
      }

      await dispatchNotification({
        title: 'Account Suspended',
        message: 'Your PlayNex account has been suspended by an administrator. Contact support for assistance.',
        category: 'system',
        targetRole: 'player',
        recipientId: userId,
        targetUserId: userId,
        link: '/player',
      });

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
      suspensionReason: null,
      reactivatedAt: now,
      reactivatedBy: session.uid,
      updatedAt: now,
    });

    const rolesSnap = await adminDb.collection('userRoles').where('userId', '==', userId).get();
    for (let i = 0; i < rolesSnap.docs.length; i += 400) {
      const batch = adminDb.batch();
      rolesSnap.docs.slice(i, i + 400).forEach((d: any) => {
        if (d.data().status === 'suspended') {
          batch.update(d.ref, { status: 'active', suspensionReason: null, updatedAt: now });
        }
      });
      await batch.commit();
    }

    await dispatchNotification({
      title: 'Account Reactivated',
      message: 'Your PlayNex account access has been restored by an administrator.',
      category: 'system',
      targetRole: 'player',
      recipientId: userId,
      targetUserId: userId,
      link: '/player',
    });

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
