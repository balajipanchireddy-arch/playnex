/**
 * Seed both permanent PlayNex platform administrators.
 *
 * Usage: npm run seed:admin
 *
 * This script:
 * 1. Verifies both admin accounts exist in Firebase Auth
 * 2. Creates/updates their Firestore user records
 * 3. Assigns active admin roles
 * 4. Sets custom claims
 *
 * It is safe to run multiple times — all writes use merge/set semantics.
 */

import { adminAuth, adminDb } from '../lib/firebase/admin-core';

const ADMINS = [
  {
    uid: 'lGRNmCBnf1TDHTPEE052uvHqC9D2',
    email: 'balajipanchireddy@gmail.com',
    name: 'Super Admin Balaji',
  },
  {
    uid: 'HZAcvx31iWQzEaO21goOXYkImhG3',
    email: 'gowthamisindhu27@gmail.com',
    name: 'Gowthami Sindhu',
  },
];

async function seedAdmin(uid: string, email: string, name: string) {
  console.log(`\n🔍 Processing admin: ${email} (${uid})`);

  // 1. Verify Firebase Auth account
  let authUser;
  try {
    authUser = await adminAuth.getUser(uid);
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') {
      console.error(`  ❌ Firebase Auth account NOT FOUND for uid: ${uid}`);
      console.error(`     This UID does not exist in the Firebase project.`);
      console.error(`     The account must be created first via Firebase Console or sign-up.`);
      return false;
    }
    throw e;
  }

  // 2. Verify email matches
  if (authUser.email !== email) {
    console.error(`  ❌ EMAIL MISMATCH for uid ${uid}`);
    console.error(`     Expected: ${email}`);
    console.error(`     Found:    ${authUser.email}`);
    console.error(`     NOT granting admin access to avoid privilege escalation.`);
    return false;
  }

  console.log(`  ✅ Firebase Auth account verified: ${authUser.email}`);

  const now = Date.now();

  // 3. Create/update Firestore user record
  await adminDb.collection('users').doc(uid).set(
    {
      uid,
      email,
      fullName: name,
      accountStatus: 'active',
      updatedAt: now,
    },
    { merge: true }
  );

  // Set createdAt only if missing
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.data()?.createdAt) {
    await adminDb.collection('users').doc(uid).update({ createdAt: now });
  }

  // 4. Assign active admin role
  await adminDb.collection('userRoles').doc(`${uid}_admin`).set(
    {
      userId: uid,
      roleId: 'admin',
      assignedAt: now,
      assignedBy: 'seed_script',
      status: 'active',
    },
    { merge: true }
  );

  // 5. Set custom claims
  try {
    await adminAuth.setCustomUserClaims(uid, { roles: ['admin'] });
    console.log(`  ✅ Custom claims set: { roles: ['admin'] }`);
  } catch (err) {
    console.warn(`  ⚠️  Could not set custom claims (non-fatal):`, err);
  }

  console.log(`  ✅ Admin role assigned in Firestore`);
  console.log(`  ✅ ${email} is now a confirmed PlayNex administrator`);
  return true;
}

async function main() {
  console.log('🚀 PlayNex — Seeding permanent platform administrators');
  console.log('='.repeat(55));

  let successCount = 0;

  for (const admin of ADMINS) {
    const success = await seedAdmin(admin.uid, admin.email, admin.name);
    if (success) successCount++;
  }

  console.log('\n' + '='.repeat(55));
  console.log(`✅ Done. ${successCount}/${ADMINS.length} admin accounts configured.`);

  if (successCount < ADMINS.length) {
    console.log('\n⚠️  Some accounts could not be configured. See errors above.');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  });
