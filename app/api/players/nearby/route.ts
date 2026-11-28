import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import {
  approximateCoords,
  calculateDistanceKm,
  formatDistance,
  isValidCoordinates,
} from '@/lib/location/geo';

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const { searchParams } = new URL(req.url);
    const sportFilter = searchParams.get('sport');
    const availableOnly = searchParams.get('available') === 'true';
    const radiusParam = searchParams.get('radiusKm');
    const radiusKm =
      radiusParam && radiusParam !== 'all' ? Number(radiusParam) : null;
    const queryLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
    const queryLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;

    const [callerUserDoc, callerProfileDoc, profilesSnap, usersSnap, blocksSnap] =
      await Promise.all([
        adminDb.collection('users').doc(session.uid).get(),
        adminDb.collection('playerProfiles').doc(session.uid).get(),
        adminDb.collection('playerProfiles').get(),
        adminDb.collection('users').get(),
        adminDb.collection('userBlocks').where('blockerId', '==', session.uid).get(),
      ]);

    const blockedIds = new Set<string>(blocksSnap.docs.map((d: any) => d.data()?.blockedId));

    const callerProf = callerProfileDoc.data() || {};
    const callerCity = callerUserDoc.data()?.address || callerProf.city || '';
    const callerCoords =
      isValidCoordinates(queryLat, queryLng)
        ? { lat: queryLat as number, lng: queryLng as number }
        : callerProf.location && isValidCoordinates(callerProf.location.lat, callerProf.location.lng)
        ? { lat: callerProf.location.lat, lng: callerProf.location.lng }
        : null;

    const usersMap = new Map<string, any>();
    usersSnap.docs.forEach((d: any) => usersMap.set(d.id, d.data()));

    const players: any[] = [];
    const sportCounts: Record<string, number> = {
      Basketball: 0,
      Football: 0,
      Cricket: 0,
      Tennis: 0,
    };

    profilesSnap.docs.forEach((doc: any) => {
      if (doc.id === session.uid) return;
      if (blockedIds.has(doc.id)) return;

      const profile = doc.data();
      const user = usersMap.get(doc.id) || {};
      if (user.accountStatus === 'suspended') return;

      const isAvailable = profile.available ?? false;
      if (availableOnly && !isAvailable) return;

      const sports: string[] =
        Array.isArray(profile.sportsPreferences) && profile.sportsPreferences.length > 0
          ? profile.sportsPreferences
          : profile.primarySport
          ? [profile.primarySport]
          : ['Basketball'];

      sports.forEach((sp) => {
        sportCounts[sp] = (sportCounts[sp] || 0) + 1;
      });

      if (
        sportFilter &&
        sportFilter !== 'All' &&
        !sports.some((s) => s.toLowerCase() === sportFilter.toLowerCase())
      ) {
        return;
      }

      const sharesLocation = profile.shareLocation === true;
      const hasValidCoords =
        sharesLocation &&
        profile.location &&
        isValidCoordinates(profile.location.lat, profile.location.lng);

      let distanceKm: number | null = null;
      if (callerCoords && hasValidCoords) {
        distanceKm = calculateDistanceKm(
          callerCoords.lat,
          callerCoords.lng,
          profile.location.lat,
          profile.location.lng
        );
      }

      if (radiusKm && Number.isFinite(radiusKm) && radiusKm > 0) {
        if (distanceKm === null || distanceKm > radiusKm) {
          return;
        }
      }

      const playerCity = user.address || profile.city || '';
      const approx = hasValidCoords
        ? approximateCoords(profile.location.lat, profile.location.lng)
        : null;

      players.push({
        id: doc.id,
        name: user.fullName || 'PlayNex Athlete',
        skillLevel: profile.skillLevel || 'Intermediate',
        sports,
        available: isAvailable,
        city: playerCity || 'City not set',
        shareLocation: sharesLocation,
        approxLocation: approx, // Rounded to ~1.1km grid; exact private coordinates are NEVER exposed
        distanceKm,
        approxDistance:
          distanceKm !== null
            ? formatDistance(distanceKm)
            : playerCity && callerCity && playerCity.toLowerCase() === callerCity.toLowerCase()
            ? 'Same city'
            : 'Location not shared',
      });
    });

    players.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return ok({
      callerCity: callerCity || 'Not set',
      hasCallerCoordinates: Boolean(callerCoords),
      totalNearby: players.length,
      sportCounts,
      players,
    });
  } catch (e: any) {
    console.error('Error fetching nearby players:', e);
    return fail('server_error', e.message, 500);
  }
}
