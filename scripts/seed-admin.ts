import { adminAuth, adminDb } from '../lib/firebase/admin';
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error('Set SEED_ADMIN_EMAIL in .env.local first.');
  const user = await adminAuth.getUserByEmail(email);
  const now = Date.now();
  await adminDb.collection('userRoles').doc(`${user.uid}_admin`).set({
    userId: user.uid, roleId: 'admin', assignedAt: now, assignedBy: 'seed', status: 'active',
  });
  await adminAuth.setCustomUserClaims(user.uid, { roles: ['admin'] });
  console.log(`✅ ${email} (${user.uid}) promoted to admin.`);
}
main().then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
