import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { ok, fail } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');

    let query: any = adminDb.collection('events');
    if (sport && sport !== 'All') {
      query = query.where('sport', '==', sport);
    }

    const snap = await query.get();
    const data = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort by createdAt descending
    data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
