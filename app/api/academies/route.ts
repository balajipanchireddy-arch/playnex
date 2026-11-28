import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { calculateDistanceKm, formatDistance, isValidCoordinates } from '@/lib/location/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession();

    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;
    const radiusParam = searchParams.get('radiusKm');
    const radiusKm = radiusParam && radiusParam !== 'all' ? Number(radiusParam) : null;
    const hasUserCoords = isValidCoordinates(lat, lng);

    const snap = await adminDb
      .collection('academies')
      .where('verificationStatus', '==', 'approved')
      .get();

    let academies = snap.docs.map((d: any) => {
      const a = d.data() || {};
      let distanceKm: number | null = null;
      if (
        hasUserCoords &&
        a.location &&
        isValidCoordinates(a.location.lat, a.location.lng)
      ) {
        distanceKm = calculateDistanceKm(
          lat as number,
          lng as number,
          a.location.lat,
          a.location.lng
        );
      }

      if (!session) {
        // Public discovery: safe approved fields only (omit contact, exact address, exact GPS coords)
        return {
          id: d.id,
          academyName: a.academyName || 'Sports Academy',
          city: a.city || '',
          description: a.description || '',
          distanceKm,
          distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
        };
      }

      return {
        id: d.id,
        academyName: a.academyName || 'Sports Academy',
        address: a.address || '',
        city: a.city || '',
        contact: a.contact || '',
        description: a.description || '',
        location: a.location || null,
        distanceKm,
        distanceLabel: distanceKm !== null ? formatDistance(distanceKm) : null,
      };
    });

    if (hasUserCoords && radiusKm && Number.isFinite(radiusKm) && radiusKm > 0) {
      academies = academies.filter(
        (a: any) => a.distanceKm !== null && a.distanceKm <= radiusKm
      );
    }

    if (hasUserCoords) {
      academies.sort((a: any, b: any) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return (a.academyName || '').localeCompare(b.academyName || '');
      });
    }

    return ok(academies);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
