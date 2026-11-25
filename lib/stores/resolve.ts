import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Resolves a user's Store document by document ID (`uid`) or fallback `ownerUserId`.
 */
export async function findUserStoreDoc(uid: string) {
  const directDoc = await adminDb.collection('stores').doc(uid).get();
  if (directDoc.exists) return directDoc;

  const querySnap = await adminDb
    .collection('stores')
    .where('ownerUserId', '==', uid)
    .limit(1)
    .get();

  return querySnap.empty ? null : querySnap.docs[0];
}

