import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { isValidCoordinates } from '@/lib/location/geo';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const [userDoc, profileDoc, verificationState] = await Promise.all([
      adminDb.collection('users').doc(session.uid).get(),
      adminDb.collection('playerProfiles').doc(session.uid).get(),
      checkAndEnforcePlayerVerification(session.uid),
    ]);

    const user = userDoc.data();
    const profile = profileDoc.exists ? profileDoc.data() : {};

    return ok({
      uid: session.uid,
      name: user?.fullName || 'PlayNex Player',
      email: user?.email || session.email || '',
      accountStatus: user?.accountStatus || 'active',
      skill: profile?.skillLevel || 'Intermediate',
      location: user?.address || profile?.city || '',
      coords:
        profile?.location && isValidCoordinates(profile.location.lat, profile.location.lng)
          ? { lat: profile.location.lat, lng: profile.location.lng }
          : null,
      shareLocation: profile?.shareLocation ?? false,
      available: profile?.available || false,
      sportsPreferences: profile?.sportsPreferences || ['Basketball', 'Football'],
      notificationPreferences: profile?.notificationPreferences || {
        tournaments: true,
        matches: true,
        academy: true,
        promotions: true,
        announcements: true,
      },
      matchesPlayed: profile?.matchesPlayed || 0,
      winRate: profile?.winRate || '—',
      verification: verificationState,
    });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const Body = z.object({
  available: z.boolean().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  skill: z.string().trim().min(1).max(50).optional(),
  location: z.string().trim().min(1).max(150).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  shareLocation: z.boolean().optional(),
  sportsPreferences: z.array(z.string()).optional(),
  notificationPreferences: z
    .object({
      tournaments: z.boolean().optional(),
      matches: z.boolean().optional(),
      academy: z.boolean().optional(),
      promotions: z.boolean().optional(),
      announcements: z.boolean().optional(),
    })
    .optional(),
});

export async function PUT(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);

    const updates = parsed.data;
    const now = Date.now();
    const profileUpdates: any = { updatedAt: now };

    if (updates.available !== undefined) profileUpdates.available = updates.available;
    if (updates.skill !== undefined) profileUpdates.skillLevel = updates.skill;
    if (updates.sportsPreferences !== undefined) profileUpdates.sportsPreferences = updates.sportsPreferences;
    if (updates.location !== undefined) profileUpdates.city = updates.location;
    if (updates.shareLocation !== undefined) profileUpdates.shareLocation = updates.shareLocation;
    if (updates.notificationPreferences !== undefined) {
      profileUpdates.notificationPreferences = updates.notificationPreferences;
    }

    if (updates.lat !== undefined && updates.lng !== undefined) {
      if (updates.lat === null || updates.lng === null) {
        profileUpdates.location = null;
      } else if (!isValidCoordinates(updates.lat, updates.lng)) {
        return fail('invalid', 'Invalid latitude/longitude coordinates', 400);
      } else {
        profileUpdates.location = { lat: updates.lat, lng: updates.lng, updatedAt: now };
      }
    }

    await adminDb.collection('playerProfiles').doc(session.uid).set(profileUpdates, { merge: true });

    if (updates.name !== undefined || updates.location !== undefined) {
      await adminDb.collection('users').doc(session.uid).set(
        {
          ...(updates.name !== undefined && { fullName: updates.name }),
          ...(updates.location !== undefined && { address: updates.location }),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return ok({ success: true });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
