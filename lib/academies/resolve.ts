import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Resolves a user's Academy document by document ID (`uid`) or fallback `ownerUserId`.
 */
export async function findUserAcademyDoc(uid: string) {
  const directDoc = await adminDb.collection('academies').doc(uid).get();
  if (directDoc.exists) return directDoc;

  const querySnap = await adminDb
    .collection('academies')
    .where('ownerUserId', '==', uid)
    .limit(1)
    .get();

  return querySnap.empty ? null : querySnap.docs[0];
}

/**
 * Returns all Academy IDs owned by this user (UID itself plus any academies where `ownerUserId === uid`).
 */
export async function getUserOwnedAcademyIds(uid: string): Promise<Set<string>> {
  const ids = new Set<string>([uid]);
  const [directDoc, ownedSnap] = await Promise.all([
    adminDb.collection('academies').doc(uid).get(),
    adminDb.collection('academies').where('ownerUserId', '==', uid).get(),
  ]);
  if (directDoc.exists) ids.add(directDoc.id);
  ownedSnap.docs.forEach((d: any) => ids.add(d.id));
  return ids;
}
