import { adminAuth, adminDb } from '../lib/firebase/admin';
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error('Set SEED_ADMIN_EMAIL in .env.local first.');
  const user = await adminAuth.getUserByEmail(email);
  const now = Date.now();
  
  // Give Staff role
  await adminDb.collection('userRoles').doc(`${user.uid}_staff`).set({
    userId: user.uid, roleId: 'staff', assignedAt: now, assignedBy: 'seed', status: 'active',
  });

  // Add dummy tasks
  await adminDb.collection('tasks').add({
    assignedTo: user.uid, title: 'Open Arena A gates', description: 'Turn on floodlights for 6 PM booking', status: 'pending', createdAt: now
  });
  await adminDb.collection('tasks').add({
    assignedTo: user.uid, title: 'Clean Court 2', description: 'Sweep and mop before 7 PM tournament', status: 'pending', createdAt: now
  });

  console.log(`✅ ${email} is now a Staff member with tasks.`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
