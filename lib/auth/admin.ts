import 'server-only';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';

/**
 * Permanent PlayNex platform administrators.
 * Both accounts are permanently protected from deletion, suspension, or role removal.
 * Admin 1: balajipanchireddy@gmail.com -> PLAYNEX_SUPER_ADMIN_UID
 * Admin 2: gowthamisindhu27@gmail.com  -> PLAYNEX_ADMIN_UID_2
 */
export const PERMANENT_ADMIN_EMAILS = [
  'balajipanchireddy@gmail.com',
  'gowthamisindhu27@gmail.com',
] as const;

export function getTrustedAdminUIDs(): string[] {
  const uids: string[] = [];
  const uid1 = process.env.PLAYNEX_SUPER_ADMIN_UID?.trim();
  const uid2 = process.env.PLAYNEX_ADMIN_UID_2?.trim();
  if (uid1) uids.push(uid1);
  if (uid2 && !uids.includes(uid2)) uids.push(uid2);
  return uids;
}

export function isPermanentAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return (PERMANENT_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

/**
 * Resolves all protected permanent admin UIDs using configured env vars plus
 * live Firebase Auth / Firestore lookup for the two permanent admin emails.
 */
export async function getProtectedAdminUIDs(): Promise<Set<string>> {
  const protectedUids = new Set<string>(getTrustedAdminUIDs());

  for (const email of PERMANENT_ADMIN_EMAILS) {
    try {
      const authUser = await adminAuth.getUserByEmail(email);
      if (authUser?.uid) protectedUids.add(authUser.uid);
    } catch {
      // Auth lookup optional if offline/mocked; also check Firestore users
    }
    try {
      const snap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
      if (!snap.empty) {
        protectedUids.add(snap.docs[0].id);
      }
    } catch {
      // Ignore query errors
    }
  }

  return protectedUids;
}

/**
 * Returns true if the uid belongs to one of the two permanent PlayNex administrators.
 * These accounts always have admin access regardless of Firestore role documents.
 */
export async function isSuperAdmin(uid: string, email?: string | null): Promise<boolean> {
  if (getTrustedAdminUIDs().includes(uid)) return true;
  if (isPermanentAdminEmail(email)) {
    try {
      const authUser = await adminAuth.getUser(uid);
      if (isPermanentAdminEmail(authUser.email)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Returns true if a target user ID or email corresponds to a protected permanent admin.
 */
export async function isProtectedPermanentAdmin(uid: string, email?: string | null): Promise<boolean> {
  if (getTrustedAdminUIDs().includes(uid)) return true;
  if (isPermanentAdminEmail(email)) return true;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && isPermanentAdminEmail(userDoc.data()?.email)) {
      return true;
    }
  } catch {
    // Ignore
  }

  try {
    const authUser = await adminAuth.getUser(uid);
    if (isPermanentAdminEmail(authUser.email)) return true;
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Ensures a trusted admin account exists in Firestore with an active admin role.
 * Safe to call on every login — uses merge writes and never overwrites existing user fields.
 */
export async function ensureSuperAdminAccount(
  uid: string,
  email: string,
  fullName?: string
) {
  const now = Date.now();
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    await userRef.set({
      uid,
      email,
      fullName: fullName || email.split('@')[0] || 'Admin',
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
  } else if (userSnap.data()?.accountStatus === 'suspended') {
    await userRef.set({ accountStatus: 'active', updatedAt: now }, { merge: true });
  }

  const adminRoleRef = adminDb.collection('userRoles').doc(`${uid}_admin`);
  const adminRoleSnap = await adminRoleRef.get();
  if (!adminRoleSnap.exists || adminRoleSnap.data()?.status !== 'active') {
    await adminRoleRef.set(
      {
        userId: uid,
        roleId: 'admin',
        assignedAt: adminRoleSnap.data()?.assignedAt || now,
        assignedBy: adminRoleSnap.data()?.assignedBy || 'system_superadmin',
        status: 'active',
        updatedAt: now,
      },
      { merge: true }
    );
  }

  const updatedUser = await userRef.get();
  return updatedUser.data();
}

/**
 * Returns true if the uid has admin access — either via permanent admin verification
 * or via an active 'admin' role document in Firestore.
 */
export async function isAdmin(uid: string): Promise<boolean> {
  if (await isSuperAdmin(uid)) return true;

  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return false;
  const userData = userSnap.data();

  if (isPermanentAdminEmail(userData?.email)) {
    return true;
  }

  if (userData?.accountStatus === 'suspended') {
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
