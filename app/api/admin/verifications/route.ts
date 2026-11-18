import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

async function isAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles').where('userId', '==', uid).where('roleId', '==', 'admin').get();
  return !snap.empty;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const storesSnap = await adminDb.collection('stores').where('verificationStatus', '==', 'pending').get();
    const academiesSnap = await adminDb.collection('academies').where('verificationStatus', '==', 'pending').get();

    const pending = [
      ...storesSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'store', displayName: d.data().storeName })),
      ...academiesSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'academy', displayName: d.data().academyName }))
    ];

    return ok(pending);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const Body = z.object({
  id: z.string(),
  type: z.enum(['store', 'academy']),
  status: z.enum(['approved', 'rejected'])
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { id, type, status } = parsed.data;
    const collection = type === 'store' ? 'stores' : 'academies';
    
    await adminDb.collection(collection).doc(id).update({ verificationStatus: status });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
