import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { findUserAcademyDoc } from '@/lib/academies/resolve';
import { findUserStoreDoc } from '@/lib/stores/resolve';

export async function POST(_req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const rolesSnap = await adminDb.collection('userRoles')
      .where('userId', '==', session.uid)
      .where('status', '==', 'active')
      .get();

    const roles = rolesSnap.docs.map((doc: any) => doc.data().roleId);
    const partnerType = roles.includes('academy')
      ? 'academy'
      : roles.includes('store')
        ? 'store'
        : null;

    if (!partnerType) {
      return fail('forbidden', 'Only Academy or Store partners can resubmit verification.', 403);
    }

    const partnerSnap =
      partnerType === 'academy'
        ? await findUserAcademyDoc(session.uid)
        : await findUserStoreDoc(session.uid);

    if (!partnerSnap || !partnerSnap.exists) {
      return fail('not_found', 'Partner profile not found.', 404);
    }
    const partnerRef = partnerSnap.ref;

    if (partnerSnap.data()?.verificationStatus !== 'rejected') {
      return fail('invalid_status', 'Only rejected applications can be resubmitted.', 400);
    }

    await partnerRef.update({
      verificationStatus: 'pending',
      reviewedAt: null,
      reviewedBy: null,
      resubmittedAt: Date.now(),
    });

    const relatedCollection = partnerType === 'academy' ? 'facilities' : 'products';
    const ownerField = partnerType === 'academy' ? 'academyId' : 'storeId';
    const statusField = partnerType === 'academy' ? 'academyVerification' : 'storeVerification';

    const relatedSnap = await adminDb.collection(relatedCollection)
      .where(ownerField, '==', partnerSnap.id)
      .get();

    if (!relatedSnap.empty) {
      const batch = adminDb.batch();
      relatedSnap.docs.forEach((doc: any) => {
        batch.update(doc.ref, { [statusField]: 'pending' });
      });
      await batch.commit();
    }

    return ok({
      success: true,
      type: partnerType,
      status: 'pending',
      message: 'Your application has been resubmitted for Admin review.',
    });
  } catch (error: any) {
    console.error('Partner resubmission error:', error);
    return fail('server_error', error.message || 'Could not resubmit application.', 500);
  }
}
