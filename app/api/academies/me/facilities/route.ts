import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { logActivity } from '@/lib/firebase/activity';

const Body = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  sport: z.string().min(2),
  price: z.number().min(1),
  image: z.string().optional(),
});

async function isAcademyOrAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  const roles = snap.docs.map((d: any) => d.data().roleId);
  return roles.includes('admin') || roles.includes('academy');
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const snap = await adminDb.collection('facilities').where('academyId', '==', session.uid).get();
    const facilities = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return ok(facilities);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!(await isAcademyOrAdmin(session.uid))) {
    return fail('forbidden', 'Academy operator permissions required', 403);
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { name, address, sport, price, image } = parsed.data;
    
    const defaultSlots: Record<string, boolean> = {};
    for (let i = 6; i <= 22; i++) defaultSlots[i.toString()] = true;

    const academyDoc = await adminDb.collection('academies').doc(session.uid).get();
    const academyName = academyDoc.exists ? academyDoc.data()?.academyName : 'Sports Academy';
    const academyVerification = academyDoc.exists ? academyDoc.data()?.verificationStatus : 'pending';

    const docRef = await adminDb.collection('facilities').add({
      academyId: session.uid,
      academyName,
      academyVerification,
      name,
      address,
      sport,
      price,
      image: image || '',
      rating: 0,
      ratingCount: 0,
      slots: defaultSlots,
      closed: false,
      createdAt: Date.now()
    });

    await logActivity({
      userId: session.uid,
      userName: academyName,
      action: 'facility_created',
      entityType: 'booking',
      entityId: docRef.id,
      details: `${academyName} added venue "${name}" (${sport}) at ₹${price}/hr`,
    });

    // AUTOMATIC ACADEMY-TO-PLAYER NOTIFICATION:
    // Inform athletes interested in this sport about the new venue
    await dispatchNotification({
      title: `🏟️ New Turf Arena: ${name}`,
      message: `${academyName} opened ${name} for ${sport} bookings at ${address}. Hourly rate: ₹${price}/hr.`,
      category: 'academy',
      targetRole: 'player',
      targetSport: sport,
      link: '/player',
      senderName: academyName,
      idempotencyKey: `notif_facility_added_${docRef.id}`,
    });

    return ok({ success: true, id: docRef.id });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

const PatchBody = z.object({
  facilityId: z.string().min(1),
  slot: z.string().optional(),
  available: z.boolean().optional(),
  price: z.number().optional(),
  closed: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input payload', 400);
    const { facilityId, slot, available, price, closed } = parsed.data;

    const facRef = adminDb.collection('facilities').doc(facilityId);
    const facSnap = await facRef.get();
    if (!facSnap.exists) return fail('not_found', 'Facility not found', 404);
    if (facSnap.data().academyId !== session.uid) return fail('forbidden', 'Unauthorized to modify this facility', 403);

    const updates: any = {};
    if (slot !== undefined && available !== undefined) updates[`slots.${slot}`] = available;
    if (price !== undefined) updates.price = price;
    if (closed !== undefined) updates.closed = closed;

    await facRef.update(updates);
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get('facilityId');
    if (!productId(facilityId)) return fail('invalid', 'Missing facilityId', 400);

    const facRef = adminDb.collection('facilities').doc(facilityId);
    const facSnap = await facRef.get();
    if (!facSnap.exists) return fail('not_found', 'Facility not found', 404);
    if (facSnap.data().academyId !== session.uid) return fail('forbidden', 'Unauthorized to delete this facility', 403);

    await facRef.delete();
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

function productId(val: any) { return !!val; }
