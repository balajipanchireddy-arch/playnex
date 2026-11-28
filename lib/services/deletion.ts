import 'server-only';

import type { DocumentReference, Query } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { isProtectedPermanentAdmin } from '@/lib/auth/admin';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { findUserAcademyDoc, getUserOwnedAcademyIds } from '@/lib/academies/resolve';
import { findUserStoreDoc } from '@/lib/stores/resolve';

const BATCH_LIMIT = 400;

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Recursively deletes a document and all of its nested subcollections,
 * respecting Firestore batch limits.
 */
export async function deleteDocumentWithSubcollections(
  docRef: DocumentReference
): Promise<number> {
  let deleted = 0;
  const subcollections = await docRef.listCollections();
  for (const subcol of subcollections) {
    const subResult = await deleteQueryInBatches(subcol);
    deleted += subResult.deleted;
  }
  await withRetry(() => docRef.delete());
  return deleted + 1;
}

/**
 * Deletes documents matching a query/collection in paginated batches (<= 400).
 * Supports nested subcollections and an optional preservation predicate.
 */
export async function deleteQueryInBatches(
  baseQuery: Query,
  options?: {
    shouldPreserve?: (docId: string, data: Record<string, any>) => boolean;
    includeSubcollections?: boolean;
  }
): Promise<{ deleted: number; preserved: number; failed: number; errors: string[] }> {
  let deleted = 0;
  let preserved = 0;
  let failed = 0;
  const errors: string[] = [];
  const includeSubcollections = options?.includeSubcollections ?? true;

  let lastDoc: any = null;
  while (true) {
    let pageQuery = baseQuery.limit(BATCH_LIMIT);
    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const snap = await pageQuery.get();
    if (snap.empty) break;

    lastDoc = snap.docs[snap.docs.length - 1];

    const toDelete: any[] = [];
    for (const d of snap.docs) {
      const data = d.data() || {};
      if (options?.shouldPreserve?.(d.id, data)) {
        preserved++;
      } else {
        toDelete.push(d);
      }
    }

    if (toDelete.length > 0) {
      if (includeSubcollections) {
        for (const d of toDelete) {
          try {
            const subcols = await d.ref.listCollections();
            for (const subcol of subcols) {
              const subRes = await deleteQueryInBatches(subcol, { includeSubcollections: true });
              deleted += subRes.deleted;
              failed += subRes.failed;
              errors.push(...subRes.errors);
            }
          } catch (err: any) {
            errors.push(`Subcollection cleanup failed for ${d.ref.path}: ${err?.message}`);
          }
        }
      }

      try {
        await withRetry(async () => {
          const batch = adminDb.batch();
          toDelete.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        });
        deleted += toDelete.length;
      } catch (err: any) {
        // Fallback: delete individually to isolate partial failure
        for (const d of toDelete) {
          try {
            await withRetry(() => d.ref.delete());
            deleted++;
          } catch (singleErr: any) {
            failed++;
            errors.push(`Failed to delete ${d.ref.path}: ${singleErr?.message}`);
          }
        }
      }
    }

    if (snap.docs.length < BATCH_LIMIT) break;
  }

  return { deleted, preserved, failed, errors };
}

/**
 * Extracts a Firebase Storage object path from a download URL or gs:// URI
 * belonging to the configured bucket, then attempts deletion safely.
 * On Firebase Spark plan without Storage enabled, this gracefully returns skipped
 * rather than throwing and blocking Firestore deletion.
 */
export async function deleteStorageFileIfManaged(
  fileUrl?: string | null
): Promise<{ deleted: boolean; skippedReason?: string }> {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return { deleted: false, skippedReason: 'no_file' };
  }

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    return { deleted: false, skippedReason: 'storage_bucket_not_configured' };
  }

  let objectPath: string | null = null;
  if (fileUrl.startsWith(`gs://${bucketName}/`)) {
    objectPath = fileUrl.slice(`gs://${bucketName}/`.length);
  } else if (fileUrl.includes('firebasestorage.googleapis.com') && fileUrl.includes(bucketName)) {
    try {
      const u = new URL(fileUrl);
      const match = u.pathname.match(/\/o\/(.+)$/);
      if (match?.[1]) {
        objectPath = decodeURIComponent(match[1]);
      }
    } catch {
      return { deleted: false, skippedReason: 'invalid_url' };
    }
  } else {
    return { deleted: false, skippedReason: 'external_url' };
  }

  if (!objectPath) {
    return { deleted: false, skippedReason: 'unresolvable_path' };
  }

  try {
    const bucket = adminStorage.bucket(bucketName);
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
    return { deleted: true };
  } catch (err: any) {
    return {
      deleted: false,
      skippedReason: err?.message || 'storage_unavailable_on_plan',
    };
  }
}

export async function deleteProductCascade(
  productId: string,
  actorUid: string,
  actorIsAdmin: boolean,
  callerStoreId?: string | null
) {
  const prodRef = adminDb.collection('products').doc(productId);
  const prodSnap = await prodRef.get();
  if (!prodSnap.exists) {
    return { status: 404 as const, error: 'Product not found' };
  }

  const prodData = prodSnap.data()!;
  if (!actorIsAdmin && (!callerStoreId || prodData.storeId !== callerStoreId)) {
    return { status: 403 as const, error: 'Unauthorized to delete this product' };
  }

  // Protect active/unreturned rentals
  const activeRentalsSnap = await adminDb
    .collection('rentals')
    .where('productId', '==', productId)
    .get();
  const blockingRentals = activeRentalsSnap.docs.filter((d: any) =>
    ['pending', 'active', 'overdue'].includes(d.data()?.status)
  );
  if (blockingRentals.length > 0) {
    return {
      status: 409 as const,
      error: `Cannot delete product with ${blockingRentals.length} active or unreturned rental(s). Mark them returned or cancelled first.`,
    };
  }

  // Preserve historical orders & returned rentals (mark productDeleted metadata)
  const ordersSnap = await adminDb.collection('orders').where('productId', '==', productId).get();
  if (!ordersSnap.empty) {
    for (let i = 0; i < ordersSnap.docs.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      ordersSnap.docs.slice(i, i + BATCH_LIMIT).forEach((d: any) => {
        batch.update(d.ref, { productDeleted: true });
      });
      await batch.commit();
    }
  }

  // Clean up product ratings
  const ratingsRes = await deleteQueryInBatches(
    adminDb.collection('ratings').where('targetId', '==', productId)
  );

  // Clean up associated storage image if hosted on configured Firebase bucket
  const storageRes = await deleteStorageFileIfManaged(prodData.image);

  // Clean up private docs if any or product record
  await deleteDocumentWithSubcollections(prodRef);

  await logActivity({
    userId: actorUid,
    userName: prodData.storeName || 'Sports Store',
    action: 'product_deleted',
    entityType: 'order',
    entityId: productId,
    details: `Deleted product "${prodData.name}" (${prodData.sport}); preserved ${ordersSnap.size} historical order(s); removed ${ratingsRes.deleted} rating(s).`,
  });

  return {
    status: 200 as const,
    data: {
      success: true,
      productId,
      productName: prodData.name,
      ratingsRemoved: ratingsRes.deleted,
      ordersPreserved: ordersSnap.size,
      fileDeleted: storageRes.deleted,
    },
  };
}

export async function deleteFacilityCascade(
  facilityId: string,
  actorUid: string,
  actorIsAdmin: boolean
) {
  const facRef = adminDb.collection('facilities').doc(facilityId);
  const facSnap = await facRef.get();
  if (!facSnap.exists) {
    return { status: 404 as const, error: 'Facility not found' };
  }

  const facData = facSnap.data()!;
  if (!actorIsAdmin) {
    const ownedAcademyIds = await getUserOwnedAcademyIds(actorUid);
    if (!ownedAcademyIds.has(facData.academyId)) {
      return { status: 403 as const, error: 'Unauthorized to delete this facility' };
    }
  }

  // Protect historical check-in & completed bookings; cancel only active confirmed bookings
  const bookingsSnap = await adminDb
    .collection('bookings')
    .where('facilityId', '==', facilityId)
    .get();

  const confirmedBookings = bookingsSnap.docs.filter((d: any) => d.data()?.status === 'confirmed');
  const historicalBookings = bookingsSnap.docs.filter((d: any) =>
    ['checked_in', 'completed', 'no_show'].includes(d.data()?.status)
  );

  const affectedUserIds = new Set<string>();
  const now = Date.now();

  for (let i = 0; i < confirmedBookings.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    confirmedBookings.slice(i, i + BATCH_LIMIT).forEach((bDoc: any) => {
      const b = bDoc.data();
      batch.update(bDoc.ref, {
        status: 'cancelled',
        cancellationReason: 'Ground removed by academy management',
        facilityDeleted: true,
        cancelledAt: now,
        updatedAt: now,
      });
      if (b.userId) affectedUserIds.add(b.userId);
    });
    await batch.commit();
  }

  if (historicalBookings.length > 0) {
    for (let i = 0; i < historicalBookings.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      historicalBookings.slice(i, i + BATCH_LIMIT).forEach((bDoc: any) => {
        batch.update(bDoc.ref, { facilityDeleted: true });
      });
      await batch.commit();
    }
  }

  // Remove bookingSlots lock records for this facility
  const slotsRes = await deleteQueryInBatches(
    adminDb.collection('bookingSlots').where('facilityId', '==', facilityId)
  );

  // Remove facility ratings
  const ratingsRes = await deleteQueryInBatches(
    adminDb.collection('ratings').where('targetId', '==', facilityId)
  );

  // Remove managed storage image if any
  const storageRes = await deleteStorageFileIfManaged(facData.image);

  // Delete facility doc + subcollections
  await deleteDocumentWithSubcollections(facRef);

  for (const uid of Array.from(affectedUserIds)) {
    await dispatchNotification({
      title: 'Turf Booking Cancelled',
      message: `Your confirmed booking at ${facData.name} has been cancelled because the ground was removed.`,
      category: 'academy',
      targetRole: 'player',
      targetUserId: uid,
      link: '/player',
      senderName: facData.academyName || 'PlayNex Academy',
      idempotencyKey: `notif_fac_del_${facilityId}_${uid}`,
    });
  }

  await logActivity({
    userId: actorUid,
    userName: facData.academyName || 'Academy',
    action: 'facility_deleted',
    entityType: 'booking',
    entityId: facilityId,
    details: `Deleted ground "${facData.name}". Cancelled ${confirmedBookings.length} confirmed booking(s), preserved ${historicalBookings.length} attendance/history record(s).`,
  });

  return {
    status: 200 as const,
    data: {
      success: true,
      facilityId,
      bookingsCancelled: confirmedBookings.length,
      bookingsPreserved: historicalBookings.length,
      slotsCleared: slotsRes.deleted,
      ratingsRemoved: ratingsRes.deleted,
      playersNotified: affectedUserIds.size,
      fileDeleted: storageRes.deleted,
    },
  };
}

export async function deleteAcademyCascade(
  academyId: string,
  actorUid: string,
  actorIsAdmin: boolean
) {
  if (await isProtectedPermanentAdmin(academyId)) {
    return { status: 403 as const, error: 'Protected administrator account records cannot be deleted' };
  }

  const acadRef = adminDb.collection('academies').doc(academyId);
  const acadSnap = await acadRef.get();
  if (!acadSnap.exists) {
    return { status: 404 as const, error: 'Academy not found' };
  }

  const acadData = acadSnap.data()!;
  if (!actorIsAdmin && acadData.ownerUserId !== actorUid && academyId !== actorUid) {
    return { status: 403 as const, error: 'Unauthorized to delete this academy' };
  }

  // Cascade facilities
  const facSnap = await adminDb.collection('facilities').where('academyId', '==', academyId).get();
  let facilitiesDeleted = 0;
  let bookingsCancelled = 0;
  let bookingsPreserved = 0;
  for (const fDoc of facSnap.docs) {
    const res = await deleteFacilityCascade(fDoc.id, actorUid, true);
    if (res.status === 200) {
      facilitiesDeleted++;
      bookingsCancelled += res.data.bookingsCancelled;
      bookingsPreserved += res.data.bookingsPreserved;
    }
  }

  // Cascade staff profiles
  const staffRes = await deleteQueryInBatches(
    adminDb.collection('staffProfiles').where('academyId', '==', academyId)
  );

  // Handle events (delete non-completed events & notify registered players; preserve completed event history? Or remove events)
  const eventsSnap = await adminDb.collection('events').where('academyId', '==', academyId).get();
  let eventsDeleted = 0;
  for (const evDoc of eventsSnap.docs) {
    const ev = evDoc.data();
    const regSnap = await adminDb.collection('registrations').where('eventId', '==', evDoc.id).get();
    const regUserIds = new Set<string>(regSnap.docs.map((r: any) => r.data()?.userId).filter(Boolean));
    await deleteQueryInBatches(adminDb.collection('registrations').where('eventId', '==', evDoc.id));
    await deleteDocumentWithSubcollections(evDoc.ref);
    eventsDeleted++;
    for (const uid of Array.from(regUserIds)) {
      await dispatchNotification({
        title: 'Event Cancelled',
        message: `${ev.name} has been cancelled because ${acadData.academyName || 'the academy'} was removed.`,
        category: 'academy',
        targetRole: 'player',
        targetUserId: uid,
        link: '/player',
        senderName: 'PlayNex',
        idempotencyKey: `notif_acad_ev_del_${evDoc.id}_${uid}`,
      });
    }
  }

  await deleteStorageFileIfManaged(acadData.image);
  await deleteDocumentWithSubcollections(acadRef);

  await logActivity({
    userId: actorUid,
    userName: actorIsAdmin ? 'Administrator' : acadData.academyName || 'Academy',
    action: 'academy_deleted',
    entityType: 'verification',
    entityId: academyId,
    details: `Deleted academy "${acadData.academyName}" (${facilitiesDeleted} grounds, ${staffRes.deleted} staff, ${eventsDeleted} events). Preserved ${bookingsPreserved} historical booking(s).`,
  });

  return {
    status: 200 as const,
    data: {
      success: true,
      academyId,
      facilitiesDeleted,
      staffRemoved: staffRes.deleted,
      eventsDeleted,
      bookingsCancelled,
      bookingsPreserved,
    },
  };
}

export async function deleteStoreCascade(
  storeId: string,
  actorUid: string,
  actorIsAdmin: boolean
) {
  if (await isProtectedPermanentAdmin(storeId)) {
    return { status: 403 as const, error: 'Protected administrator account records cannot be deleted' };
  }

  const storeRef = adminDb.collection('stores').doc(storeId);
  const storeSnap = await storeRef.get();
  if (!storeSnap.exists) {
    return { status: 404 as const, error: 'Store not found' };
  }

  const storeData = storeSnap.data()!;
  if (!actorIsAdmin && storeData.ownerUserId !== actorUid && storeId !== actorUid) {
    return { status: 403 as const, error: 'Unauthorized to delete this store' };
  }

  // Check for active unreturned rentals
  const rentalsSnap = await adminDb.collection('rentals').where('storeId', '==', storeId).get();
  const activeRentals = rentalsSnap.docs.filter((d: any) =>
    ['pending', 'active', 'overdue'].includes(d.data()?.status)
  );
  if (activeRentals.length > 0) {
    return {
      status: 409 as const,
      error: `Cannot delete store while ${activeRentals.length} rental(s) are still pending or unreturned.`,
    };
  }

  // Delete products belonging to store (preserving order history)
  const prodSnap = await adminDb.collection('products').where('storeId', '==', storeId).get();
  let productsDeleted = 0;
  for (const pDoc of prodSnap.docs) {
    const res = await deleteProductCascade(pDoc.id, actorUid, true, storeId);
    if (res.status === 200) productsDeleted++;
  }

  // Mark orders storeDeleted: true while preserving financial order history
  const ordersSnap = await adminDb.collection('orders').where('storeId', '==', storeId).get();
  for (let i = 0; i < ordersSnap.docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    ordersSnap.docs.slice(i, i + BATCH_LIMIT).forEach((d: any) => {
      batch.update(d.ref, { storeDeleted: true });
    });
    await batch.commit();
  }

  await deleteDocumentWithSubcollections(storeRef);

  await logActivity({
    userId: actorUid,
    userName: actorIsAdmin ? 'Administrator' : storeData.storeName || 'Store',
    action: 'store_deleted',
    entityType: 'order',
    entityId: storeId,
    details: `Deleted store "${storeData.storeName}" and ${productsDeleted} product(s). Preserved ${ordersSnap.size} historical order(s).`,
  });

  return {
    status: 200 as const,
    data: {
      success: true,
      storeId,
      productsDeleted,
      ordersPreserved: ordersSnap.size,
      rentalsPreserved: rentalsSnap.size,
    },
  };
}

export async function purgeUserAccountCascade(targetUid: string, actorUid: string) {
  if (await isProtectedPermanentAdmin(targetUid)) {
    return { status: 403 as const, error: 'Permanent administrator accounts cannot be deleted or suspended' };
  }

  const userRef = adminDb.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { status: 404 as const, error: 'User record not found' };
  }
  const userData = userSnap.data()!;

  // Remove Firebase Auth user
  try {
    await adminAuth.deleteUser(targetUid);
  } catch (authError: any) {
    if (authError?.code !== 'auth/user-not-found') {
      throw authError;
    }
  }

  // Cascade owned Academy / Store if present (by UID or ownerUserId)
  const acadDoc = await findUserAcademyDoc(targetUid);
  if (acadDoc) {
    await deleteAcademyCascade(acadDoc.id, actorUid, true);
  }
  const storeDoc = await findUserStoreDoc(targetUid);
  if (storeDoc) {
    await deleteStoreCascade(storeDoc.id, actorUid, true);
  }

  // Delete user-owned operational profile & verification records
  const [
    rolesRes,
    verifRes,
    privateDocsRes,
    notifRes,
    notifReadsRes,
    blocksRes,
  ] = await Promise.all([
    deleteQueryInBatches(adminDb.collection('userRoles').where('userId', '==', targetUid)),
    deleteQueryInBatches(adminDb.collection('playerVerifications').where('userId', '==', targetUid)),
    deleteQueryInBatches(adminDb.collection('privateVerificationDocs').where('ownerId', '==', targetUid)),
    deleteQueryInBatches(adminDb.collection('notifications').where('recipientId', '==', targetUid)),
    deleteQueryInBatches(adminDb.collection('notificationReads').where('userId', '==', targetUid)),
    deleteQueryInBatches(adminDb.collection('userBlocks').where('blockerId', '==', targetUid)),
  ]);

  // Cancel open matches created by this user
  const myMatches = await adminDb.collection('matches').where('creatorId', '==', targetUid).get();
  for (const mDoc of myMatches.docs) {
    const m = mDoc.data();
    if (['open', 'full', 'ready'].includes(m.status)) {
      await mDoc.ref.update({ status: 'cancelled', cancelledAt: Date.now(), updatedAt: Date.now() });
    }
  }

  // Preserve financial/attendance records (`orders`, `bookings`, `rentals`) with deleted marker
  const ordersSnap = await adminDb.collection('orders').where('playerId', '==', targetUid).get();
  for (let i = 0; i < ordersSnap.docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    ordersSnap.docs.slice(i, i + BATCH_LIMIT).forEach((d: any) => batch.update(d.ref, { userDeleted: true }));
    await batch.commit();
  }

  const bookingsSnap = await adminDb.collection('bookings').where('userId', '==', targetUid).get();
  for (let i = 0; i < bookingsSnap.docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    bookingsSnap.docs.slice(i, i + BATCH_LIMIT).forEach((d: any) => {
      const b = d.data();
      if (b.status === 'confirmed') {
        batch.update(d.ref, { status: 'cancelled', cancellationReason: 'Account deleted', userDeleted: true });
      } else {
        batch.update(d.ref, { userDeleted: true });
      }
    });
    await batch.commit();
  }

  // Delete core profile documents
  await Promise.all([
    deleteDocumentWithSubcollections(userRef),
    deleteDocumentWithSubcollections(adminDb.collection('playerProfiles').doc(targetUid)),
    deleteDocumentWithSubcollections(adminDb.collection('staffProfiles').doc(targetUid)),
  ]);

  await logActivity({
    userId: actorUid,
    userName: 'Administrator',
    action: 'user_purged',
    entityType: 'user',
    entityId: targetUid,
    details: `Permanently purged account "${userData.fullName || userData.email || targetUid}" (${rolesRes.deleted} roles, ${verifRes.deleted} verifications, ${privateDocsRes.deleted} private docs, ${notifRes.deleted + notifReadsRes.deleted} notification records, ${blocksRes.deleted} blocks). Preserved ${ordersSnap.size} orders & ${bookingsSnap.size} bookings for financial retention.`,
  });

  return {
    status: 200 as const,
    data: {
      success: true,
      userId: targetUid,
      status: 'purged',
      ordersPreserved: ordersSnap.size,
      bookingsPreserved: bookingsSnap.size,
    },
  };
}
