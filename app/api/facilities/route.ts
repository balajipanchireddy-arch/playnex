import { adminDb } from '@/lib/firebase/admin';
import { ok, fail } from '@/lib/api/response';
export async function GET() {
  try {
    const snap = await adminDb.collection('facilities').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(data);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
