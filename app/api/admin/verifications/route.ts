import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';


export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const storesSnap = await adminDb.collection('stores').where('verificationStatus', '==', 'pending').get();
    const academiesSnap = await adminDb.collection('academies').where('verificationStatus', '==', 'pending').get();

    const pending = [
      ...storesSnap.docs.map((d: any) => ({ 
        id: d.id, 
        ...d.data(), 
        type: 'store', 
        displayName: d.data().storeName || 'Sports Store' 
      })),
      ...academiesSnap.docs.map((d: any) => ({ 
        id: d.id, 
        ...d.data(), 
        type: 'academy', 
        displayName: d.data().academyName || 'Sports Academy' 
      }))
    ];

    return ok(pending);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const Body = z.object({
  id: z.string().min(1),
  type: z.enum(['store', 'academy']),
  status: z.enum(['approved', 'rejected'])
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid verification payload', 400);
    
    const { id, type, status } = parsed.data;
    const collection = type === 'store' ? 'stores' : 'academies';
    
    const targetRef = adminDb.collection(collection).doc(id);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return fail('not_found', `${type === 'store' ? 'Store' : 'Academy'} not found`, 404);
    }

    await targetRef.set({
      verificationStatus: status,
      reviewedAt: Date.now(),
      reviewedBy: session.uid,
    }, { merge: true });

    // Synchronize verification status across associated entities
    if (type === 'academy') {
      const facilitiesSnap = await adminDb.collection('facilities').where('academyId', '==', id).get();
      const batch = adminDb.batch();
      facilitiesSnap.docs.forEach((doc: any) => {
        batch.update(doc.ref, { academyVerification: status });
      });
      await batch.commit();
    } else if (type === 'store') {
      const productsSnap = await adminDb.collection('products').where('storeId', '==', id).get();
      const batch = adminDb.batch();
      productsSnap.docs.forEach((doc: any) => {
        batch.update(doc.ref, { storeVerification: status });
      });
      await batch.commit();
    }

    return ok({ success: true, id, type, status });
  } catch (e: any) { 
    console.error('Verification review error:', e);
    return fail('server_error', e.message, 500); 
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type') as 'store' | 'academy';

  if (!id || !type || !['store', 'academy'].includes(type)) {
    return fail('invalid', 'Valid "id" and "type" (store | academy) are required', 400);
  }

  try {
    const collection = type === 'store' ? 'stores' : 'academies';
    const docRef = adminDb.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return fail('not_found', 'Partner record not found', 404);

    const data = snap.data();
    const partnerName = type === 'store' ? (data?.storeName || 'Store') : (data?.academyName || 'Academy');

    // Soft delete/dismiss the verification request
    await docRef.set({
      verificationStatus: 'dismissed',
      dismissedAt: Date.now(),
      dismissedBy: session.uid,
    }, { merge: true });

    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: 'verification_dismissed',
      entityType: 'verification',
      entityId: id,
      details: `Dismissed ${type} application for "${partnerName}"`,
    });

    return ok({ success: true, id, type, status: 'dismissed' });
  } catch (e: any) {
    console.error('Failed to dismiss verification:', e);
    return fail('server_error', e.message || 'Operation failed', 500);
  }
}
