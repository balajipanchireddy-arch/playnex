import 'server-only';

import { createHash } from 'crypto';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { getProtectedAdminUIDs } from '@/lib/auth/admin';
import { logActivity } from '@/lib/firebase/activity';
import { deleteDocumentWithSubcollections, deleteQueryInBatches, deleteStorageFileIfManaged } from '@/lib/services/deletion';
import type { CleanupReport } from '@/types';

export const CLEANUP_CATEGORIES = [
  'activity_logs_old',
  'notifications_old',
  'notifications',
  'test_demo_records',
  'orphaned_records',
  'unused_products',
  'unused_facilities',
  'player_profiles',
  'player_verifications',
  'academies',
  'stores',
  'facilities',
  'products',
  'tournaments',
  'registrations',
  'bookings',
  'orders',
  'rentals',
  'matches',
  'chats',
  'reports_blocks',
] as const;

export type CleanupCategory = (typeof CLEANUP_CATEGORIES)[number];

const PROTECTED_COLLECTIONS = new Set(['users', 'userRoles', 'games', 'systemConfig']);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const COLLECTION_RELATIONSHIPS = [
  { from: 'users', to: 'userRoles', key: 'userId', note: 'Protected identity & role bindings' },
  { from: 'users', to: 'playerProfiles', key: 'userId', note: 'Athlete profile & 5-day verification window' },
  { from: 'users', to: 'playerVerifications', key: 'userId', note: 'Verification review submissions' },
  { from: 'academies', to: 'facilities', key: 'academyId', note: 'Grounds/turfs owned by an academy' },
  { from: 'academies', to: 'staffProfiles', key: 'academyId', note: 'Ground staff assigned to academy' },
  { from: 'academies', to: 'events', key: 'academyId', note: 'Tournaments & events hosted by academy' },
  { from: 'facilities', to: 'bookings', key: 'facilityId', note: 'Court slot bookings & QR check-ins' },
  { from: 'facilities', to: 'bookingSlots', key: 'facilityId', note: 'Date+hour concurrency locks' },
  { from: 'events', to: 'registrations', key: 'eventId', note: 'Player tournament registrations' },
  { from: 'stores', to: 'products', key: 'storeId', note: 'Sports gear available for purchase or rental' },
  { from: 'products', to: 'orders', key: 'productId', note: 'Purchase order history' },
  { from: 'products', to: 'rentals', key: 'productId', note: 'Gear rental & deposit tracking' },
  { from: 'matches', to: 'chats', key: 'matchId', note: 'Matchmaking group/pair chats + messages subcollection' },
  { from: 'notifications', to: 'notificationReads', key: 'notificationId', note: 'Per-user read/dismissal receipts' },
];

const SENSITIVE_FIELDS = new Set(['idNumber', 'documentUrl', 'base64Data', 'dataUrl', 'password', 'token']);

export function sanitizeRecordForExport(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (SENSITIVE_FIELDS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sanitizeRecordForExport(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function inspectDatabase() {
  const protectedUids = await getProtectedAdminUIDs();
  const rootCols = await adminDb.listCollections();

  const collectionDetails: Array<{
    name: string;
    count: number;
    protected: boolean;
    subcollections: string[];
    sampleOwnership: string;
  }> = [];

  for (const col of rootCols) {
    const countSnap = await col.count().get();
    const count = countSnap.data().count;
    const sampleSnap = await col.limit(5).get();
    const subcolSet = new Set<string>();
    for (const doc of sampleSnap.docs) {
      const subs = await doc.ref.listCollections();
      subs.forEach((s) => subcolSet.add(s.id));
    }

    let sampleOwnership = 'Platform';
    if (col.id === 'users' || col.id === 'userRoles') sampleOwnership = 'Users & Auth Bindings (Protected)';
    else if (col.id === 'playerProfiles' || col.id === 'playerVerifications') sampleOwnership = 'Players';
    else if (col.id === 'academies' || col.id === 'facilities' || col.id === 'staffProfiles' || col.id === 'events') sampleOwnership = 'Academies';
    else if (col.id === 'stores' || col.id === 'products' || col.id === 'orders' || col.id === 'rentals') sampleOwnership = 'Stores & Customers';
    else if (col.id === 'bookings' || col.id === 'bookingSlots') sampleOwnership = 'Players & Academies';
    else if (col.id === 'matches' || col.id === 'chats' || col.id === 'matchRequests') sampleOwnership = 'Matchmaking Players';
    else if (col.id === 'privateVerificationDocs') sampleOwnership = 'Restricted Verification Vault';

    collectionDetails.push({
      name: col.id,
      count,
      protected: PROTECTED_COLLECTIONS.has(col.id) || col.id === 'privateVerificationDocs',
      subcollections: Array.from(subcolSet),
      sampleOwnership,
    });
  }

  collectionDetails.sort((a, b) => a.name.localeCompare(b.name));

  // Identify orphaned records & test/demo records safely (read-only)
  const [
    usersSnap,
    rolesSnap,
    academiesSnap,
    storesSnap,
    facilitiesSnap,
    productsSnap,
    bookingsSnap,
    notifsSnap,
    notifReadsSnap,
  ] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('userRoles').get(),
    adminDb.collection('academies').get(),
    adminDb.collection('stores').get(),
    adminDb.collection('facilities').get(),
    adminDb.collection('products').get(),
    adminDb.collection('bookings').get(),
    adminDb.collection('notifications').get(),
    adminDb.collection('notificationReads').get(),
  ]);

  const userIds = new Set(usersSnap.docs.map((d) => d.id));
  const academyIds = new Set(academiesSnap.docs.map((d) => d.id));
  const storeIds = new Set(storesSnap.docs.map((d) => d.id));
  const facilityIds = new Set(facilitiesSnap.docs.map((d) => d.id));
  const notifIds = new Set(notifsSnap.docs.map((d) => d.id));

  const orphanedFacilities = facilitiesSnap.docs.filter((d) => !academyIds.has(d.data()?.academyId)).length;
  const orphanedProducts = productsSnap.docs.filter((d) => !storeIds.has(d.data()?.storeId)).length;
  const orphanedBookings = bookingsSnap.docs.filter((d) => !facilityIds.has(d.data()?.facilityId)).length;
  const orphanedNotifReads = notifReadsSnap.docs.filter((d) => !notifIds.has(d.data()?.notificationId)).length;
  const orphanedRoles = rolesSnap.docs.filter((d) => !userIds.has(d.data()?.userId)).length;

  const demoStores = storesSnap.docs.filter((d) => d.id.startsWith('dummy_') || d.data()?.ownerUserId === 'seed').length;
  const demoAcademies = academiesSnap.docs.filter((d) => d.id.startsWith('dummy_') || d.data()?.ownerUserId === 'seed').length;
  const demoFacilities = facilitiesSnap.docs.filter((d) => String(d.data()?.academyId || '').startsWith('dummy_')).length;
  const demoProducts = productsSnap.docs.filter((d) => String(d.data()?.storeId || '').startsWith('dummy_')).length;

  // Inspect storage files safely (Spark plan may not have Storage initialized)
  let storageStatus: {
    available: boolean;
    bucket: string | null;
    fileCount: number;
    sampleFiles: string[];
    note: string;
  } = {
    available: false,
    bucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
    fileCount: 0,
    sampleFiles: [],
    note: 'Storage listing not verified',
  };

  if (storageStatus.bucket) {
    try {
      const bucket = adminStorage.bucket(storageStatus.bucket);
      const [files] = await bucket.getFiles({ maxResults: 50 });
      storageStatus = {
        available: true,
        bucket: storageStatus.bucket,
        fileCount: files.length,
        sampleFiles: files
          .map((f) => f.name)
          .filter((name) => !name.includes('private') && !name.includes('verification'))
          .slice(0, 15),
        note: 'Storage bucket accessible; private verification paths are hidden.',
      };
    } catch (err: any) {
      storageStatus = {
        available: false,
        bucket: storageStatus.bucket,
        fileCount: 0,
        sampleFiles: [],
        note: `Storage bucket inaccessible on current Firebase plan/setup (${err?.message || 'not provisioned'}). Verification documents use the private Firestore vault.`,
      };
    }
  }

  return {
    inspectedAt: Date.now(),
    collections: collectionDetails,
    relationships: COLLECTION_RELATIONSHIPS,
    orphanedSummary: {
      facilitiesWithoutAcademy: orphanedFacilities,
      productsWithoutStore: orphanedProducts,
      bookingsWithoutFacility: orphanedBookings,
      notificationReadsWithoutNotification: orphanedNotifReads,
      rolesWithoutUser: orphanedRoles,
      totalOrphaned: orphanedFacilities + orphanedProducts + orphanedBookings + orphanedNotifReads + orphanedRoles,
    },
    demoDataSummary: {
      demoStores,
      demoAcademies,
      demoFacilities,
      demoProducts,
      totalDemo: demoStores + demoAcademies + demoFacilities + demoProducts,
    },
    protectedRecords: {
      permanentAdminUids: Array.from(protectedUids),
      protectedUsersCount: usersSnap.docs.filter((d) => protectedUids.has(d.id)).length,
      protectedAdminRolesCount: rolesSnap.docs.filter((d) => protectedUids.has(d.data()?.userId) && d.data()?.roleId === 'admin').length,
      totalUsersPreserved: usersSnap.size,
      totalUserRolesPreserved: rolesSnap.size,
      protectedCollections: Array.from(PROTECTED_COLLECTIONS),
    },
    storage: storageStatus,
  };
}

function computePreviewSignature(mode: string, categories: string[], totalEstimated: number): string {
  const payload = JSON.stringify({ mode, categories: [...categories].sort(), totalEstimated });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export async function generateCleanupPreview(
  requestedCategories: CleanupCategory[],
  mode: 'selective' | 'complete_reset'
) {
  const protectedUids = await getProtectedAdminUIDs();
  const categories: CleanupCategory[] =
    mode === 'complete_reset'
      ? [
          'player_profiles',
          'player_verifications',
          'academies',
          'stores',
          'facilities',
          'products',
          'tournaments',
          'registrations',
          'bookings',
          'orders',
          'rentals',
          'matches',
          'chats',
          'reports_blocks',
          'notifications',
        ]
      : Array.from(new Set(requestedCategories));

  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;

  const breakdown: Array<{
    category: CleanupCategory;
    collections: string[];
    estimatedDocuments: number;
    subcollectionsAffected: string[];
    relatedRecordsAffected: string;
    filesAffected: number;
  }> = [];

  const allFiles = new Set<string>();
  let totalEstimated = 0;

  for (const cat of categories) {
    let est = 0;
    let cols: string[] = [];
    let subs: string[] = [];
    let related = 'None';
    let files = 0;

    switch (cat) {
      case 'activity_logs_old': {
        cols = ['activityLogs'];
        const snap = await adminDb.collection('activityLogs').where('timestamp', '<', cutoff).get();
        est = snap.size;
        related = 'Removes audit entries older than 30 days (recent logs preserved)';
        break;
      }
      case 'notifications_old': {
        cols = ['notifications', 'notificationReads'];
        const snap = await adminDb.collection('notifications').where('createdAt', '<', cutoff).get();
        est = snap.size;
        related = 'Also removes matching notificationReads entries';
        break;
      }
      case 'notifications': {
        cols = ['notifications', 'notificationReads'];
        const [n, nr] = await Promise.all([
          adminDb.collection('notifications').count().get(),
          adminDb.collection('notificationReads').count().get(),
        ]);
        est = n.data().count + nr.data().count;
        related = 'Clears all notifications and per-user read states';
        break;
      }
      case 'test_demo_records': {
        cols = ['stores', 'academies', 'facilities', 'products'];
        const [s, a, f, p] = await Promise.all([
          adminDb.collection('stores').get(),
          adminDb.collection('academies').get(),
          adminDb.collection('facilities').get(),
          adminDb.collection('products').get(),
        ]);
        est =
          s.docs.filter((d) => d.id.startsWith('dummy_') || d.data()?.ownerUserId === 'seed').length +
          a.docs.filter((d) => d.id.startsWith('dummy_') || d.data()?.ownerUserId === 'seed').length +
          f.docs.filter((d) => String(d.data()?.academyId || '').startsWith('dummy_')).length +
          p.docs.filter((d) => String(d.data()?.storeId || '').startsWith('dummy_')).length;
        related = 'Targets only dummy_/seed-owned demo records';
        break;
      }
      case 'orphaned_records': {
        cols = ['facilities', 'products', 'notificationReads'];
        const insp = await inspectDatabase();
        est =
          insp.orphanedSummary.facilitiesWithoutAcademy +
          insp.orphanedSummary.productsWithoutStore +
          insp.orphanedSummary.notificationReadsWithoutNotification;
        related = 'Removes facilities/products/read receipts missing parent records (preserves historical bookings & orders)';
        break;
      }
      case 'unused_products': {
        cols = ['products'];
        const [prods, orders, rentals] = await Promise.all([
          adminDb.collection('products').get(),
          adminDb.collection('orders').get(),
          adminDb.collection('rentals').get(),
        ]);
        const usedIds = new Set([
          ...orders.docs.map((d) => d.data()?.productId),
          ...rentals.docs.map((d) => d.data()?.productId),
        ]);
        const unused = prods.docs.filter((d) => !usedIds.has(d.id) && (d.data()?.qty ?? 0) === 0);
        est = unused.length;
        unused.forEach((d) => {
          if (d.data()?.image) {
            files++;
            allFiles.add(d.data().image);
          }
        });
        related = 'Zero-stock products with zero orders/rentals';
        break;
      }
      case 'unused_facilities': {
        cols = ['facilities'];
        const [facs, bks] = await Promise.all([
          adminDb.collection('facilities').get(),
          adminDb.collection('bookings').get(),
        ]);
        const usedIds = new Set(bks.docs.map((d) => d.data()?.facilityId));
        const unused = facs.docs.filter((d) => !usedIds.has(d.id));
        est = unused.length;
        unused.forEach((d) => {
          if (d.data()?.image) {
            files++;
            allFiles.add(d.data().image);
          }
        });
        related = 'Facilities with zero historical or active bookings';
        break;
      }
      case 'player_profiles': {
        cols = ['playerProfiles'];
        const snap = await adminDb.collection('playerProfiles').get();
        est = snap.docs.filter((d) => !protectedUids.has(d.id)).length;
        related = 'Preserves permanent admin profiles, users, and userRoles';
        break;
      }
      case 'player_verifications': {
        cols = ['playerVerifications', 'privateVerificationDocs'];
        const [v, pv] = await Promise.all([
          adminDb.collection('playerVerifications').get(),
          adminDb.collection('privateVerificationDocs').get(),
        ]);
        est =
          v.docs.filter((d) => !protectedUids.has(d.data()?.userId)).length +
          pv.docs.filter((d) => !protectedUids.has(d.data()?.ownerId)).length;
        related = 'Removes verification submissions and private vault document blobs';
        break;
      }
      case 'academies': {
        cols = ['academies', 'staffProfiles'];
        const [a, st] = await Promise.all([
          adminDb.collection('academies').get(),
          adminDb.collection('staffProfiles').get(),
        ]);
        est =
          a.docs.filter((d) => !protectedUids.has(d.id) && !protectedUids.has(d.data()?.ownerUserId)).length +
          st.size;
        related = 'Also clears staffProfiles (preserve users & userRoles)';
        break;
      }
      case 'stores': {
        cols = ['stores'];
        const s = await adminDb.collection('stores').get();
        est = s.docs.filter((d) => !protectedUids.has(d.id) && !protectedUids.has(d.data()?.ownerUserId)).length;
        related = 'Deletes store profiles (preserve users & userRoles)';
        break;
      }
      case 'facilities': {
        cols = ['facilities'];
        const f = await adminDb.collection('facilities').get();
        est = f.size;
        f.docs.forEach((d) => {
          if (d.data()?.image) {
            files++;
            allFiles.add(d.data().image);
          }
        });
        related = 'Ground listings and image references';
        break;
      }
      case 'products': {
        cols = ['products'];
        const p = await adminDb.collection('products').get();
        est = p.size;
        p.docs.forEach((d) => {
          if (d.data()?.image) {
            files++;
            allFiles.add(d.data().image);
          }
        });
        related = 'Product listings and image references';
        break;
      }
      case 'tournaments': {
        cols = ['events', 'tournaments'];
        const [e, t] = await Promise.all([
          adminDb.collection('events').count().get(),
          adminDb.collection('tournaments').count().get(),
        ]);
        est = e.data().count + t.data().count;
        related = 'Tournament/event records';
        break;
      }
      case 'registrations': {
        cols = ['registrations'];
        est = (await adminDb.collection('registrations').count().get()).data().count;
        break;
      }
      case 'bookings': {
        cols = ['bookings', 'bookingSlots'];
        const [b, bs] = await Promise.all([
          adminDb.collection('bookings').count().get(),
          adminDb.collection('bookingSlots').count().get(),
        ]);
        est = b.data().count + bs.data().count;
        related = 'Court bookings, QR check-ins, and slot locks';
        break;
      }
      case 'orders': {
        cols = ['orders'];
        est = (await adminDb.collection('orders').count().get()).data().count;
        related = 'Purchase order records (financial history)';
        break;
      }
      case 'rentals': {
        cols = ['rentals'];
        est = (await adminDb.collection('rentals').count().get()).data().count;
        related = 'Gear rental & security deposit records';
        break;
      }
      case 'matches': {
        cols = ['matches', 'matchRequests'];
        const [m, mr] = await Promise.all([
          adminDb.collection('matches').count().get(),
          adminDb.collection('matchRequests').count().get(),
        ]);
        est = m.data().count + mr.data().count;
        break;
      }
      case 'chats': {
        cols = ['chats'];
        subs = ['messages'];
        const cSnap = await adminDb.collection('chats').get();
        let msgCount = 0;
        for (const doc of cSnap.docs.slice(0, 50)) {
          const mCount = await doc.ref.collection('messages').count().get();
          msgCount += mCount.data().count;
        }
        est = cSnap.size + msgCount;
        related = 'Includes nested messages subcollections';
        break;
      }
      case 'reports_blocks': {
        cols = ['userBlocks', 'userReports'];
        const [ub, ur] = await Promise.all([
          adminDb.collection('userBlocks').count().get(),
          adminDb.collection('userReports').count().get(),
        ]);
        est = ub.data().count + ur.data().count;
        break;
      }
    }

    totalEstimated += est;
    breakdown.push({
      category: cat,
      collections: cols,
      estimatedDocuments: est,
      subcollectionsAffected: subs,
      relatedRecordsAffected: related,
      filesAffected: files,
    });
  }

  const [usersCountSnap, rolesCountSnap, gamesCountSnap] = await Promise.all([
    adminDb.collection('users').count().get(),
    adminDb.collection('userRoles').count().get(),
    adminDb.collection('games').count().get(),
  ]);

  const risks: string[] = [];
  if (mode === 'complete_reset') {
    risks.push('Full operational reset deletes all bookings, orders, rentals, tournaments, and partner listings.');
  }
  if (categories.includes('orders') || categories.includes('bookings') || categories.includes('rentals')) {
    risks.push('Financial/attendance records (orders, bookings, or rentals) are selected. Download a JSON backup before proceeding.');
  }
  if (categories.includes('player_verifications')) {
    risks.push('Verification proof records will be purged; unverified players may need to resubmit proof.');
  }

  const previewHash = computePreviewSignature(mode, categories, totalEstimated);

  return {
    previewHash,
    generatedAt: now,
    mode,
    categories,
    estimatedTotalDocuments: totalEstimated,
    estimatedFilesAffected: allFiles.size,
    breakdown,
    preservedRecords: {
      permanentAdminAccounts: Array.from(protectedUids),
      usersDocuments: usersCountSnap.data().count,
      userRolesDocuments: rolesCountSnap.data().count,
      gamesCatalogDocuments: gamesCountSnap.data().count,
      notes: [
        'Both permanent admin Firebase Auth accounts (balajipanchireddy@gmail.com, gowthamisindhu27@gmail.com) are strictly preserved.',
        'users and userRoles collections are never deleted by the cleanup tool.',
        'Master games catalog and audit logs (except old logs if explicitly selected) are preserved.',
      ],
    },
    risks,
    backupRecommended: true,
  };
}

export async function exportCleanupBackup(categories: CleanupCategory[]) {
  const collectionMap: Record<CleanupCategory, string[]> = {
    activity_logs_old: ['activityLogs'],
    notifications_old: ['notifications', 'notificationReads'],
    notifications: ['notifications', 'notificationReads'],
    test_demo_records: ['stores', 'academies', 'facilities', 'products'],
    orphaned_records: ['facilities', 'products', 'notificationReads'],
    unused_products: ['products'],
    unused_facilities: ['facilities'],
    player_profiles: ['playerProfiles'],
    player_verifications: ['playerVerifications'],
    academies: ['academies', 'staffProfiles'],
    stores: ['stores'],
    facilities: ['facilities'],
    products: ['products'],
    tournaments: ['events', 'tournaments'],
    registrations: ['registrations'],
    bookings: ['bookings', 'bookingSlots'],
    orders: ['orders'],
    rentals: ['rentals'],
    matches: ['matches', 'matchRequests'],
    chats: ['chats'],
    reports_blocks: ['userBlocks', 'userReports'],
  };

  const colsToExport = new Set<string>();
  categories.forEach((c) => (collectionMap[c] || []).forEach((col) => colsToExport.add(col)));

  const collections: Record<string, any[]> = {};
  for (const colName of Array.from(colsToExport)) {
    const snap = await adminDb.collection(colName).limit(2000).get();
    collections[colName] = snap.docs.map((d) => ({
      id: d.id,
      ...sanitizeRecordForExport(d.data() || {}),
    }));
  }

  return {
    exportedAt: new Date().toISOString(),
    redactedSensitiveFields: Array.from(SENSITIVE_FIELDS),
    collections,
  };
}

export async function executeCleanup(params: {
  categories: CleanupCategory[];
  mode: 'selective' | 'complete_reset';
  previewHash: string;
  actorUid: string;
  actorEmail?: string;
}): Promise<CleanupReport> {
  const { categories: rawCategories, mode, previewHash, actorUid, actorEmail } = params;
  const preview = await generateCleanupPreview(rawCategories, mode);

  if (preview.previewHash !== previewHash) {
    throw new Error('PREVIEW_MISMATCH: Database state or selection changed since preview. Please regenerate preview before deleting.');
  }

  const protectedUids = await getProtectedAdminUIDs();
  const now = Date.now();
  const cutoff = now - THIRTY_DAYS_MS;

  const details: CleanupReport['details'] = {};
  const globalErrors: string[] = [];
  let totalDeleted = 0;
  let totalPreserved = 0;
  let totalFilesDeleted = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const cat of preview.categories) {
    const stat = {
      deleted: 0,
      preserved: 0,
      skipped: 0,
      failed: 0,
      filesDeleted: 0,
      errors: [] as string[],
    };

    try {
      switch (cat) {
        case 'activity_logs_old': {
          const r = await deleteQueryInBatches(
            adminDb.collection('activityLogs').where('timestamp', '<', cutoff),
            { shouldPreserve: (_id, d) => d.action === 'database_cleanup_executed' }
          );
          stat.deleted += r.deleted;
          stat.preserved += r.preserved;
          stat.failed += r.failed;
          stat.errors.push(...r.errors);
          break;
        }
        case 'notifications_old': {
          const oldSnap = await adminDb.collection('notifications').where('createdAt', '<', cutoff).get();
          const oldIds = oldSnap.docs.map((d) => d.id);
          const r = await deleteQueryInBatches(
            adminDb.collection('notifications').where('createdAt', '<', cutoff)
          );
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          for (let i = 0; i < oldIds.length; i += 30) {
            const chunk = oldIds.slice(i, i + 30);
            const rr = await deleteQueryInBatches(
              adminDb.collection('notificationReads').where('notificationId', 'in', chunk)
            );
            stat.deleted += rr.deleted;
            stat.failed += rr.failed;
          }
          break;
        }
        case 'notifications': {
          const r1 = await deleteQueryInBatches(adminDb.collection('notifications'));
          const r2 = await deleteQueryInBatches(adminDb.collection('notificationReads'));
          stat.deleted += r1.deleted + r2.deleted;
          stat.failed += r1.failed + r2.failed;
          stat.errors.push(...r1.errors, ...r2.errors);
          break;
        }
        case 'test_demo_records': {
          const isDemo = (id: string, d: Record<string, any>) =>
            id.startsWith('dummy_') ||
            d.ownerUserId === 'seed' ||
            String(d.academyId || '').startsWith('dummy_') ||
            String(d.storeId || '').startsWith('dummy_');
          for (const col of ['stores', 'academies', 'facilities', 'products']) {
            const r = await deleteQueryInBatches(adminDb.collection(col), {
              shouldPreserve: (id, d) => !isDemo(id, d) || protectedUids.has(id),
            });
            stat.deleted += r.deleted;
            stat.preserved += r.preserved;
            stat.failed += r.failed;
            stat.errors.push(...r.errors);
          }
          break;
        }
        case 'orphaned_records': {
          const [acadSnap, storeSnap, notifSnap] = await Promise.all([
            adminDb.collection('academies').get(),
            adminDb.collection('stores').get(),
            adminDb.collection('notifications').get(),
          ]);
          const acadIds = new Set(acadSnap.docs.map((d) => d.id));
          const storeIds = new Set(storeSnap.docs.map((d) => d.id));
          const notifIds = new Set(notifSnap.docs.map((d) => d.id));

          const rFac = await deleteQueryInBatches(adminDb.collection('facilities'), {
            shouldPreserve: (_id, d) => acadIds.has(d.academyId),
          });
          const rProd = await deleteQueryInBatches(adminDb.collection('products'), {
            shouldPreserve: (_id, d) => storeIds.has(d.storeId),
          });
          const rReads = await deleteQueryInBatches(adminDb.collection('notificationReads'), {
            shouldPreserve: (_id, d) => notifIds.has(d.notificationId),
          });
          stat.deleted += rFac.deleted + rProd.deleted + rReads.deleted;
          stat.preserved += rFac.preserved + rProd.preserved + rReads.preserved;
          stat.failed += rFac.failed + rProd.failed + rReads.failed;
          break;
        }
        case 'unused_products': {
          const [orders, rentals] = await Promise.all([
            adminDb.collection('orders').get(),
            adminDb.collection('rentals').get(),
          ]);
          const usedIds = new Set([
            ...orders.docs.map((d) => d.data()?.productId),
            ...rentals.docs.map((d) => d.data()?.productId),
          ]);
          const prods = await adminDb.collection('products').get();
          for (const d of prods.docs) {
            if (!usedIds.has(d.id) && (d.data()?.qty ?? 0) === 0) {
              const fs = await deleteStorageFileIfManaged(d.data()?.image);
              if (fs.deleted) stat.filesDeleted++;
              stat.deleted += await deleteDocumentWithSubcollections(d.ref);
            } else {
              stat.preserved++;
            }
          }
          break;
        }
        case 'unused_facilities': {
          const bks = await adminDb.collection('bookings').get();
          const usedIds = new Set(bks.docs.map((d) => d.data()?.facilityId));
          const facs = await adminDb.collection('facilities').get();
          for (const d of facs.docs) {
            if (!usedIds.has(d.id)) {
              const fs = await deleteStorageFileIfManaged(d.data()?.image);
              if (fs.deleted) stat.filesDeleted++;
              stat.deleted += await deleteDocumentWithSubcollections(d.ref);
            } else {
              stat.preserved++;
            }
          }
          break;
        }
        case 'player_profiles': {
          const r = await deleteQueryInBatches(adminDb.collection('playerProfiles'), {
            shouldPreserve: (id) => protectedUids.has(id),
          });
          stat.deleted += r.deleted;
          stat.preserved += r.preserved;
          stat.failed += r.failed;
          stat.errors.push(...r.errors);
          break;
        }
        case 'player_verifications': {
          const r1 = await deleteQueryInBatches(adminDb.collection('playerVerifications'), {
            shouldPreserve: (_id, d) => protectedUids.has(d.userId),
          });
          const r2 = await deleteQueryInBatches(adminDb.collection('privateVerificationDocs'), {
            shouldPreserve: (_id, d) => protectedUids.has(d.ownerId),
          });
          stat.deleted += r1.deleted + r2.deleted;
          stat.preserved += r1.preserved + r2.preserved;
          stat.failed += r1.failed + r2.failed;
          stat.errors.push(...r1.errors, ...r2.errors);
          break;
        }
        case 'academies': {
          const r1 = await deleteQueryInBatches(adminDb.collection('academies'), {
            shouldPreserve: (id, d) => protectedUids.has(id) || protectedUids.has(d.ownerUserId),
          });
          const r2 = await deleteQueryInBatches(adminDb.collection('staffProfiles'), {
            shouldPreserve: (_id, d) => protectedUids.has(d.academyId),
          });
          stat.deleted += r1.deleted + r2.deleted;
          stat.preserved += r1.preserved + r2.preserved;
          stat.failed += r1.failed + r2.failed;
          break;
        }
        case 'stores': {
          const r = await deleteQueryInBatches(adminDb.collection('stores'), {
            shouldPreserve: (id, d) => protectedUids.has(id) || protectedUids.has(d.ownerUserId),
          });
          stat.deleted += r.deleted;
          stat.preserved += r.preserved;
          stat.failed += r.failed;
          break;
        }
        case 'facilities': {
          const facSnap = await adminDb.collection('facilities').get();
          for (const d of facSnap.docs) {
            const fs = await deleteStorageFileIfManaged(d.data()?.image);
            if (fs.deleted) stat.filesDeleted++;
          }
          const r = await deleteQueryInBatches(adminDb.collection('facilities'));
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'products': {
          const prodSnap = await adminDb.collection('products').get();
          for (const d of prodSnap.docs) {
            const fs = await deleteStorageFileIfManaged(d.data()?.image);
            if (fs.deleted) stat.filesDeleted++;
          }
          const r = await deleteQueryInBatches(adminDb.collection('products'));
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'tournaments': {
          const r1 = await deleteQueryInBatches(adminDb.collection('events'));
          const r2 = await deleteQueryInBatches(adminDb.collection('tournaments'));
          stat.deleted += r1.deleted + r2.deleted;
          stat.failed += r1.failed + r2.failed;
          break;
        }
        case 'registrations': {
          const r = await deleteQueryInBatches(adminDb.collection('registrations'));
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'bookings': {
          const r1 = await deleteQueryInBatches(adminDb.collection('bookings'));
          const r2 = await deleteQueryInBatches(adminDb.collection('bookingSlots'));
          stat.deleted += r1.deleted + r2.deleted;
          stat.failed += r1.failed + r2.failed;
          break;
        }
        case 'orders': {
          const r = await deleteQueryInBatches(adminDb.collection('orders'));
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'rentals': {
          const r = await deleteQueryInBatches(adminDb.collection('rentals'));
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'matches': {
          const r1 = await deleteQueryInBatches(adminDb.collection('matches'));
          const r2 = await deleteQueryInBatches(adminDb.collection('matchRequests'));
          stat.deleted += r1.deleted + r2.deleted;
          stat.failed += r1.failed + r2.failed;
          break;
        }
        case 'chats': {
          const r = await deleteQueryInBatches(adminDb.collection('chats'), { includeSubcollections: true });
          stat.deleted += r.deleted;
          stat.failed += r.failed;
          break;
        }
        case 'reports_blocks': {
          const r1 = await deleteQueryInBatches(adminDb.collection('userBlocks'));
          const r2 = await deleteQueryInBatches(adminDb.collection('userReports'));
          stat.deleted += r1.deleted + r2.deleted;
          stat.failed += r1.failed + r2.failed;
          break;
        }
      }
    } catch (err: any) {
      stat.failed++;
      stat.errors.push(err?.message || 'Unknown cleanup error');
      globalErrors.push(`[${cat}] ${err?.message || 'Cleanup failed'}`);
    }

    details[cat] = stat;
    totalDeleted += stat.deleted;
    totalPreserved += stat.preserved;
    totalFilesDeleted += stat.filesDeleted;
    totalFailed += stat.failed;
    totalSkipped += stat.skipped;
  }

  // Remaining record counts for audit & report
  const remainingCollections = [
    'users',
    'userRoles',
    'games',
    'playerProfiles',
    'academies',
    'stores',
    'facilities',
    'products',
    'events',
    'registrations',
    'bookings',
    'orders',
    'rentals',
    'matches',
    'chats',
    'notifications',
  ];
  const remainingCounts: Record<string, number> = {};
  await Promise.all(
    remainingCollections.map(async (c) => {
      try {
        remainingCounts[c] = (await adminDb.collection(c).count().get()).data().count;
      } catch {
        remainingCounts[c] = 0;
      }
    })
  );

  await logActivity({
    userId: actorUid,
    userName: actorEmail || 'Administrator',
    action: 'database_cleanup_executed',
    entityType: 'system',
    entityId: mode,
    details: `Executed ${mode} cleanup on [${preview.categories.join(', ')}]: deleted=${totalDeleted}, preserved=${totalPreserved}, filesDeleted=${totalFilesDeleted}, failed=${totalFailed}`,
  });

  return {
    mode,
    executedAt: now,
    executedBy: actorEmail || actorUid,
    deletedCount: totalDeleted,
    preservedCount: totalPreserved + remainingCounts.users + remainingCounts.userRoles,
    filesDeleted: totalFilesDeleted,
    failedCount: totalFailed,
    skippedCount: totalSkipped,
    remainingCounts,
    details,
    errors: globalErrors,
    recoveryInstructions:
      totalFailed > 0
        ? [
            'Some records failed to delete. Inspect the error details above and re-run preview + selective cleanup for the affected category.',
            'Restore from your downloaded JSON backup if you need to recover deleted operational documents.',
          ]
        : [
            'Permanent admin accounts, users, userRoles, and master games catalog remained untouched.',
            'If needed, restore operational records from the pre-cleanup JSON backup file.',
          ],
  };
}
