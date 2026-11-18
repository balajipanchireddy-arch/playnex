import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const storeDoc = await adminDb.collection('stores').doc(session.uid).get();
    if (!storeDoc.exists) return fail('not_found', 'Store profile not found', 404);
    
    return ok({ id: storeDoc.id, ...storeDoc.data() });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
