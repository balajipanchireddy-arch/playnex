import 'server-only';

import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';

export async function isSuperAdmin(uid: string): Promise<boolean> {
  const trustedUid = process.env.PLAYNEX_SUPER_ADMIN_UID;
  return Boolean(trustedUid && uid === trustedUid);
}

export async function ensureSuperAdminAccount(
  uid: string,
  email: string,
  fullName?: string
) {
  const now = Date.now();
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();

  // Create a minimal user record only when one does not already exist.
  if (!userSnap.exists) {
    await userRef.set({
      uid,
      email,
      fullName: fullName || email.split('@')[0] || 'Super Admin',
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Keep Admin active and deactivate other role assignments.
  const rolesSnap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .get();

  const batch = adminDb.batch();

  batch.set(
    adminDb.collection('userRoles').doc(`${uid}_admin`),
    {
      userId: uid,
      roleId: 'admin',
      assignedAt: now,
      assignedBy: 'system_superadmin',
      status: 'active',
    },
    { merge: true }
  );

  for (const doc of rolesSnap.docs) {
    if (doc.data().roleId !== 'admin' && doc.data().status === 'active') {
      batch.update(doc.ref, {
        status: 'inactive',
        updatedAt: now,
      });
    }
  }

  await batch.commit();

  const updatedUser = await userRef.get();
  return updatedUser.data();
}

export async function isAdmin(uid: string): Promise<boolean> {
  if (await isSuperAdmin(uid)) return true;

  const userSnap = await adminDb.collection('users').doc(uid).get();

  if (!userSnap.exists || userSnap.data()?.accountStatus === 'suspended') {
    return false;
  }

  const rolesSnap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  return !rolesSnap.empty;
}

export async function requireAdmin() {
  const session = await verifySession();

  if (!session) {
    return { authorized: false as const, session: null };
  }

  const authorized = await isAdmin(session.uid);

  return {
    authorized,
    session: authorized ? session : null,
  };
}
