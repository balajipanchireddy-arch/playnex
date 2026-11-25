import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const academyRef = adminDb.collection('academies').doc(session.uid);
    let academyDoc = await academyRef.get();

    // If academy document does not exist yet (e.g. registered before academy profile auto-init), initialize it
    if (!academyDoc.exists) {
      const userDoc = await adminDb.collection('users').doc(session.uid).get();
      const userName = userDoc.exists ? userDoc.data()?.fullName : 'Sports Arena';
      const initialData = {
        academyId: session.uid,
        ownerUserId: session.uid,
        academyName: `${userName}'s Academy`,
        address: userDoc.exists && userDoc.data()?.address ? userDoc.data().address : 'Address pending update',
        contact: userDoc.exists && userDoc.data()?.email ? userDoc.data().email : '',
        verificationStatus: 'pending',
        createdAt: Date.now(),
      };
      await academyRef.set(initialData);
      academyDoc = await academyRef.get();
    }

    return ok({ id: academyDoc.id, ...academyDoc.data() });
  } catch (e: any) { 
    return fail('server_error', e.message, 500); 
  }
}

