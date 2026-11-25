import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const { searchParams } = new URL(req.url);
    const sportFilter = searchParams.get('sport');
    const availableOnly = searchParams.get('available') === 'true';

    // Fetch caller's profile to know their location
    const [callerUserDoc, callerProfileDoc] = await Promise.all([
      adminDb.collection('users').doc(session.uid).get(),
      adminDb.collection('playerProfiles').doc(session.uid).get(),
    ]);

    const callerCity = callerUserDoc.data()?.address || callerProfileDoc.data()?.city || 'Visakhapatnam';

    // Fetch all player profiles
    const [profilesSnap, usersSnap] = await Promise.all([
      adminDb.collection('playerProfiles').get(),
      adminDb.collection('users').get(),
    ]);

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
      // Don't include caller in nearby list
      if (doc.id === session.uid) return;

      const profile = doc.data();
      const user = usersMap.get(doc.id) || {};

      const isAvailable = profile.available ?? false;
      if (availableOnly && !isAvailable) return;

      const sports: string[] = profile.sportsPreferences || [profile.primarySport || 'Basketball'];
      sports.forEach((sp) => {
        if (sportCounts[sp] !== undefined) {
          sportCounts[sp]++;
        } else {
          sportCounts[sp] = (sportCounts[sp] || 0) + 1;
        }
      });

      if (sportFilter && sportFilter !== 'All' && !sports.includes(sportFilter)) {
        return;
      }

      const playerCity = user.address || profile.city || callerCity;

      players.push({
        id: doc.id,
        name: user.fullName || 'PlayNex Athlete',
        skillLevel: profile.skillLevel || 'Intermediate',
        sports,
        available: isAvailable,
        city: playerCity,
        approxDistance: playerCity.toLowerCase() === callerCity.toLowerCase() ? '< 5 km' : '~15 km',
      });
    });

    return ok({
      callerCity,
      totalNearby: players.length,
      sportCounts,
      players,
    });
  } catch (e: any) {
    console.error('Error fetching nearby players:', e);
    return fail('server_error', e.message, 500);
  }
}

