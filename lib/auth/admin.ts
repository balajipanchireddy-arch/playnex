import 'server-only';

import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';

/**
 * Permanent PlayNex platform administrator UIDs.
 * These are configured via environment variables and checked server-side only.
 * Admin 1: balajipanchireddy@gmail.com  → PLAYNEX_SUPER_ADMIN_UID
 * Admin 2: gowthamisindhu27@gmail.com   → PLAYNEX_ADMIN_UID_2
 */
function getTrustedAdminUIDs(): string[] {
  const uids: string[] = [];
  const uid1 = process.env.PLAYNEX_SUPER_ADMIN_UID;
  const uid2 = process.env.PLAYNEX_ADMIN_UID_2;
  if (uid1) uids.push(uid1);
  if (uid2) uids.push(uid2);
  return uids;
}

/**
 * Returns true if the uid belongs to one of the two permanent PlayNex administrators.
 * These accounts always have admin access regardless of Firestore role documents.
 */
export async function isSuperAdmin(uid: string): Promise<boolean> {
  return getTrustedAdminUIDs().includes(uid);
}

/**
 * Ensures a trusted admin account exists in Firestore with an active admin role.
 * Safe to call on every login — uses merge writes so it never overwrites existing data.
 */
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
      fullName: fullName || email.split('@')[0] || 'Admin',
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Ensure the admin role document exists and is active.
  await adminDb.collection('userRoles').doc(`${uid}_admin`).set(
    {
      userId: uid,
      roleId: 'admin',
      assignedAt: now,
      assignedBy: 'system_superadmin',
      status: 'active',
    },
    { merge: true }
  );

  const updatedUser = await userRef.get();
  return updatedUser.data();
}

/**
 * Returns true if the uid has admin access — either via trusted UID list
 * or via an active 'admin' role document in Firestore.
 */
export async function isAdmin(uid: string): Promise<boolean> {
  if (await isSuperAdmin(uid)) return true;

  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists || userSnap.data()?.accountStatus === 'suspended') {
    return false;
  }

  const rolesSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  return !rolesSnap.empty;
}

/**
 * Verifies the current session and checks if the user is an admin.
 * Returns { authorized, session }.
 */
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
