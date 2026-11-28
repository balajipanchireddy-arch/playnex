import { adminAuth, adminDb } from '../lib/firebase/admin-core';
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error('Set SEED_ADMIN_EMAIL in .env.local first.');
  const user = await adminAuth.getUserByEmail(email);
  const now = Date.now();
  
  // Give Store role
  await adminDb.collection('userRoles').doc(`${user.uid}_store`).set({
    userId: user.uid, roleId: 'store', assignedAt: now, assignedBy: 'seed', status: 'active',
  });
  
  // Create Store profile if it doesn't exist
  await adminDb.collection('stores').doc(user.uid).set({
    storeId: user.uid, ownerUserId: user.uid, storeName: user.email?.split('@')[0] + "'s Store",
    address: 'Demo Address', contact: '', verificationStatus: 'pending', createdAt: now
  }, { merge: true });

  console.log(`✅ ${email} is now a Store Owner too.`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
