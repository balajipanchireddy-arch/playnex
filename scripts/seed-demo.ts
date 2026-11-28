import { adminDb } from '../lib/firebase/admin-core';

async function main() {
  const now = Date.now();
  const storeId = 'dummy_store_1';
  const academyId = 'dummy_academy_1';

  await adminDb.collection('stores').doc(storeId).set({
    storeId, ownerUserId: 'seed', storeName: 'Game On Sports',
    address: 'Beach Road', contact: '1234567890', verificationStatus: 'approved', createdAt: now
  });

  await adminDb.collection('academies').doc(academyId).set({
    academyId, ownerUserId: 'seed', academyName: 'Arena A',
    address: 'City Center', contact: '0987654321', verificationStatus: 'approved', createdAt: now
  });

  const facilities = [
    { name: 'Arena A', sport: 'Basketball', dist: 2, price: 500, amenities: 'Indoor · Floodlights' },
    { name: 'Beach Road Turf', sport: 'Football', dist: 6, price: 900, amenities: 'Outdoor · Parking' },
    { name: 'Shuttle Hub', sport: 'Badminton', dist: 1.5, price: 250, amenities: 'Indoor · Rackets' },
  ];
  
  for (const f of facilities) {
    await adminDb.collection('facilities').add({
      ...f, academyId, createdAt: now,
      slots: { '18': true, '19': true, '20': false }
    });
  }

  const products = [
    { name: 'Basketball (Size 7)', sport: 'Basketball', price: 1200, qty: 12 },
    { name: 'Tennis Racket', sport: 'Tennis', price: 2500, qty: 8 },
    { name: 'Football (Size 5)', sport: 'Football', price: 900, qty: 15 },
  ];

  for (const p of products) {
    await adminDb.collection('products').add({
      ...p, storeId, storeName: 'Game On Sports', createdAt: now
    });
  }

  console.log('✅ Demo data seeded!');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
