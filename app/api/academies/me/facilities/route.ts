import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';
import { deleteFacilityCascade } from '@/lib/services/deletion';
import { isValidCoordinates } from '@/lib/location/geo';
import { findUserAcademyDoc, getUserOwnedAcademyIds } from '@/lib/academies/resolve';

const Body = z.object({
  name: z.string().min(2),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  description: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  sport: z.string().min(2),
  price: z.number().min(1),
  image: z.string().optional().default(''),
});

async function isAcademyOrAdmin(uid: string) {
  if (await isAdmin(uid)) return true;
  const snap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  const roles = snap.docs.map((d: any) => d.data().roleId);
  return roles.includes('admin') || roles.includes('academy');
}

async function isApprovedAcademy(uid: string): Promise<boolean> {
  const roleSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'academy')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (roleSnap.empty) return false;

  const academyDoc = await findUserAcademyDoc(uid);
  return Boolean(academyDoc && academyDoc.data()?.verificationStatus === 'approved');
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const ownedIds = Array.from(await getUserOwnedAcademyIds(session.uid)).slice(0, 30);
    const snap = await adminDb
      .collection('facilities')
      .where('academyId', 'in', ownedIds)
      .get();
    const facilities = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return ok(facilities);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const adminUser = await isAdmin(session.uid);
  if (!adminUser && !(await isApprovedAcademy(session.uid))) {
    return fail(
      'forbidden',
      'Your academy must be approved by PlayNex Admin before adding grounds.',
      403
    );
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { name, address, city, lat, lng, description, contact, sport, price, image } = parsed.data;

    let validatedLocation: { lat: number; lng: number } | null = null;
    if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
      if (!isValidCoordinates(lat, lng)) {
        return fail('invalid', 'Invalid latitude/longitude coordinates', 400);
      }
      validatedLocation = { lat, lng };
    }

    const defaultSlots: Record<string, boolean> = {};
    for (let i = 6; i <= 22; i++) defaultSlots[i.toString()] = true;

    const academyDoc = await findUserAcademyDoc(session.uid);
    const resolvedAcademyId = academyDoc?.id || session.uid;
    const academyData = academyDoc ? academyDoc.data() : null;
    const academyName = academyData?.academyName || 'Sports Academy';
    const academyVerification = academyData?.verificationStatus || (adminUser ? 'approved' : 'pending');

    // Fall back to academy coordinates only if academy has real coordinates and ground didn't override
    const finalLocation =
      validatedLocation ||
      (academyData?.location && isValidCoordinates(academyData.location.lat, academyData.location.lng)
        ? { lat: academyData.location.lat, lng: academyData.location.lng }
        : null);

    const docRef = await adminDb.collection('facilities').add({
      academyId: resolvedAcademyId,
      academyName,
      academyVerification,
      name,
      address: address || academyData?.address || '',
      city: city || academyData?.city || '',
      location: finalLocation,
      description: description || '',
      contact: contact || '',
      sport,
      price,
      image: image || '',
      rating: 0,
      ratingCount: 0,
      slots: defaultSlots,
      closed: false,
      createdAt: Date.now(),
    });

    const sportTrimmed = sport.trim();
    const sportSlug = sportTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (sportSlug) {
      const existingGame = await adminDb
        .collection('games')
        .where('slug', '==', sportSlug)
        .limit(1)
        .get();
      if (existingGame.empty) {
        const nowIso = new Date().toISOString();
        await adminDb.collection('games').add({
          name: sportTrimmed,
          slug: sportSlug,
          category: 'Ground Sport',
          status: 'active',
          isCustom: true,
          createdBy: session.uid,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    await logActivity({
      userId: session.uid,
      userName: academyName,
      action: 'facility_created',
      entityType: 'booking',
      entityId: docRef.id,
      details: `${academyName} added venue "${name}" (${sport}) at ₹${price}/hr`,
    });

    await dispatchNotification({
      title: `New Turf Arena: ${name}`,
      message: `${academyName} opened ${name} for ${sport} bookings${address ? ` at ${address}` : ''}. Hourly rate: ₹${price}/hr.`,
      category: 'academy',
      targetRole: 'player',
      targetSport: sport,
      link: '/player',
      senderName: academyName,
      idempotencyKey: `notif_facility_added_${docRef.id}`,
    });

    return ok({ success: true, id: docRef.id });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const PatchBody = z.object({
  facilityId: z.string().min(1),
  slot: z.string().optional(),
  available: z.boolean().optional(),
  price: z.number().optional(),
  closed: z.boolean().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const adminUser = await isAdmin(session.uid);
  if (!adminUser && !(await isApprovedAcademy(session.uid))) {
    return fail(
      'forbidden',
      'Your academy must be approved by PlayNex Admin before editing grounds.',
      403
    );
  }

  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { facilityId, slot, available, price, closed, address, city, lat, lng } = parsed.data;

    const facRef = adminDb.collection('facilities').doc(facilityId);
    const facSnap = await facRef.get();
    if (!facSnap.exists) return fail('not_found', 'Facility not found', 404);
    const ownedIds = await getUserOwnedAcademyIds(session.uid);
    if (!adminUser && !ownedIds.has(facSnap.data()?.academyId)) {
      return fail('forbidden', 'Unauthorized to modify this facility', 403);
    }

    const updates: any = { updatedAt: Date.now() };
    if (slot !== undefined && available !== undefined) updates[`slots.${slot}`] = available;
    if (price !== undefined) updates.price = price;
    if (closed !== undefined) updates.closed = closed;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
      if (!isValidCoordinates(lat, lng)) {
        return fail('invalid', 'Invalid latitude/longitude coordinates', 400);
      }
      updates.location = { lat, lng };
    }

    await facRef.update(updates);
    return ok({ success: true });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const facilityId = searchParams.get('facilityId');
  if (!facilityId) return fail('invalid', 'Missing facilityId', 400);

  try {
    const canDelete = await isAcademyOrAdmin(session.uid);
    if (!canDelete) {
      return fail('forbidden', 'Academy operator or admin permissions required', 403);
    }

    const adminUser = await isAdmin(session.uid);
    const result = await deleteFacilityCascade(facilityId, session.uid, adminUser);
    if (result.status !== 200) {
      return fail(result.status === 404 ? 'not_found' : 'forbidden', result.error || 'Failed to delete facility', result.status);
    }

    return ok(result.data);
  } catch (e: any) {
    console.error('Failed to delete facility:', e);
    return fail('server_error', e.message || 'Failed to delete facility', 500);
  }
}
