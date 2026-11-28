import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { getUserOwnedAcademyIds } from '@/lib/academies/resolve';

export const dynamic = 'force-dynamic';

const PUBLIC_EVENT_STATUSES = new Set(['Registration Open', 'Upcoming', 'Ongoing']);

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession();
    const [callerIsAdmin, ownedAcademyIds] = session
      ? await Promise.all([isAdmin(session.uid), getUserOwnedAcademyIds(session.uid)])
      : [false, new Set<string>()];

    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');

    let query: any = adminDb.collection('events');
    if (sport && sport !== 'All') {
      query = query.where('sport', '==', sport);
    }

    const [snap, academiesSnap] = await Promise.all([
      query.get(),
      adminDb.collection('academies').where('verificationStatus', '==', 'approved').get(),
    ]);
    const approvedAcademyIds = new Set<string>(academiesSnap.docs.map((d: any) => d.id));

    const data = snap.docs
      .filter((d: any) => {
        if (callerIsAdmin) return true;
        const ev = d.data() || {};
        const isOwner = Boolean(session && ownedAcademyIds.has(ev.academyId));
        if (isOwner) return true;
        if (ev.status === 'Draft') return false;

        const isApprovedSource =
          ev.organizerType === 'admin' ||
          ev.academyVerification === 'approved' ||
          approvedAcademyIds.has(ev.academyId);
        if (!isApprovedSource) return false;

        if (!session) {
          return PUBLIC_EVENT_STATUSES.has(ev.status || 'Upcoming');
        }
        return true;
      })
      .map((d: any) => {
        const ev = d.data() || {};
        const base = {
          id: d.id,
          name: ev.name || 'Tournament',
          sport: ev.sport || 'Sport',
          category: ev.category || 'Open Championship',
          participationType: ev.participationType || 'individual',
          description: ev.description || '',
          venue: ev.venue || ev.loc || '',
          loc: ev.loc || ev.venue || '',
          date: ev.date || '',
          registrationDeadline: ev.registrationDeadline || '',
          maxParticipants: ev.maxParticipants ?? 0,
          registeredCount: ev.registeredCount ?? 0,
          entryFee: ev.entryFee ?? ev.price ?? 0,
          price: ev.price ?? ev.entryFee ?? 0,
          rules: ev.rules || '',
          posterUrl: ev.posterUrl || '',
          status: ev.status || 'Upcoming',
          academyName: ev.academyName || 'PlayNex',
          createdAt: ev.createdAt || 0,
        };
        if (!session) return base;
        return {
          ...base,
          academyId: ev.academyId || null,
          academyVerification: ev.academyVerification || null,
          organizerType: ev.organizerType || null,
        };
      });

    // Sort by createdAt descending
    data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
