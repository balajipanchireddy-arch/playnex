import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { calculateDistanceKm, formatDistance, isValidCoordinates } from '@/lib/location/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession();
    const callerIsAdmin = session ? await isAdmin(session.uid) : false;

    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;
    const radiusParam = searchParams.get('radiusKm');
    const radiusKm = radiusParam && radiusParam !== 'all' ? Number(radiusParam) : null;
    const sport = searchParams.get('sport');

    const hasUserCoords = isValidCoordinates(lat, lng);

    const [snap, academiesSnap] = await Promise.all([
      adminDb.collection('facilities').get(),
      adminDb.collection('academies').where('verificationStatus', '==', 'approved').get(),
    ]);

    const approvedAcademyIds = new Set<string>(academiesSnap.docs.map((d: any) => d.id));

    let data = snap.docs
      .filter((d: any) => {
        if (callerIsAdmin) return true;
        const f = d.data() || {};
        const isApproved =
          f.academyVerification === 'approved' || approvedAcademyIds.has(f.academyId);
        if (!isApproved) return false;
        if (!session && f.closed === true) return false;
        return true;
      })
      .map((d: any) => {
        const f = d.data() || {};
        let distanceKm: number | null = null;
        if (
          hasUserCoords &&
          f.location &&
          isValidCoordinates(f.location.lat, f.location.lng)
        ) {
          distanceKm = calculateDistanceKm(
            lat as number,
            lng as number,
            f.location.lat,
            f.location.lng
          );
        }

        if (!session) {
          // Public discovery projection: approved/open grounds only, no exact GPS/contact/internal fields
          return {
            id: d.id,
            name: f.name || 'Sports Arena',
            academyName: f.academyName || 'Verified Academy',
            city: f.city || '',
            description: f.description || '',
            sport: f.sport || 'Sport',
            price: typeof f.price === 'number' ? f.price : 0,
            image: f.image || '',
            rating: typeof f.rating === 'number' ? f.rating : 0,
            ratingCount: typeof f.ratingCount === 'number' ? f.ratingCount : 0,
            distanceKm,
            distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
          };
        }

        return {
          id: d.id,
          name: f.name || 'Sports Arena',
          academyId: f.academyId || null,
          academyName: f.academyName || 'Sports Academy',
          academyVerification:
            f.academyVerification ||
            (approvedAcademyIds.has(f.academyId) ? 'approved' : 'pending'),
          address: f.address || '',
          city: f.city || '',
          location: f.location || null,
          description: f.description || '',
          contact: f.contact || '',
          sport: f.sport || 'Sport',
          price: typeof f.price === 'number' ? f.price : 0,
          image: f.image || '',
          rating: typeof f.rating === 'number' ? f.rating : 0,
          ratingCount: typeof f.ratingCount === 'number' ? f.ratingCount : 0,
          slots: f.slots || {},
          closed: Boolean(f.closed),
          createdAt: f.createdAt || 0,
          distanceKm,
          distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
        };
      });

    if (sport && sport !== 'All') {
      data = data.filter(
        (f: any) => (f.sport || '').toLowerCase() === sport.toLowerCase()
      );
    }

    if (hasUserCoords && radiusKm && Number.isFinite(radiusKm) && radiusKm > 0) {
      data = data.filter((f: any) => f.distanceKm !== null && f.distanceKm <= radiusKm);
    }

    if (hasUserCoords) {
      data.sort((a: any, b: any) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    return ok(data);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
