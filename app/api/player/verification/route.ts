import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

/**
 * Player Verification API
 *
 * GET  /api/player/verification       — Get own verification status
 * POST /api/player/verification       — Submit verification request
 * PATCH /api/player/verification      — Admin: approve/reject/request resubmission
 */

const STATUSES = ['not_submitted', 'pending', 'under_review', 'approved', 'rejected', 'resubmission_required'] as const;

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId');
  const listAll = searchParams.get('all') === 'true';

  if (listAll) {
    if (!(await isAdmin(session.uid))) {
      return fail('forbidden', 'Admin access required', 403);
    }
    try {
      const snap = await adminDb.collection('playerVerifications').get();
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      items.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      return ok(items);
    } catch (e: any) {
      return fail('server_error', e.message, 500);
    }
  }

  // Admin can query any user's verification; players only their own
  const userId = targetUserId && (await isAdmin(session.uid)) ? targetUserId : session.uid;

  try {
    const snap = await adminDb
      .collection('playerVerifications')
      .where('userId', '==', userId)
      .get();

    if (snap.empty) {
      return ok({ status: 'not_submitted', history: [] });
    }

    const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    const latest = docs[0];

    const history = docs.map((d: any) => ({
      id: d.id,
      status: d.status,
      submittedAt: d.createdAt,
      reviewedAt: d.reviewedAt,
      reason: d.reason,
    }));

    return ok({ ...latest, history });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const SubmitBody = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(6),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  documentUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = SubmitBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid data', 400);
  }

  try {
    // Check for existing pending submission
    const existingSnap = await adminDb
      .collection('playerVerifications')
      .where('userId', '==', session.uid)
      .where('status', 'in', ['pending', 'under_review'])
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return fail('conflict', 'A verification request is already pending review.', 409);
    }

    const now = Date.now();
    const docRef = adminDb.collection('playerVerifications').doc();
    await docRef.set({
      userId: session.uid,
      userEmail: session.email || '',
      ...parsed.data,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    // Update player profile with pending verification status
    await adminDb.collection('playerProfiles').doc(session.uid).set(
      { verificationStatus: 'pending', updatedAt: now },
      { merge: true }
    );

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Player',
      action: 'verification_submitted',
      entityType: 'verification',
      entityId: docRef.id,
      details: 'Player submitted verification request',
    });

    return ok({ id: docRef.id, status: 'pending' });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const ReviewBody = z.object({
  verificationId: z.string().min(1),
  status: z.enum(['approved', 'rejected', 'under_review', 'resubmission_required']),
  reason: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  const parsed = ReviewBody.safeParse(await req.json());
  if (!parsed.success) return fail('invalid', 'Invalid review payload', 400);

  const { verificationId, status, reason } = parsed.data;
  const now = Date.now();

  try {
    const docRef = adminDb.collection('playerVerifications').doc(verificationId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return fail('not_found', 'Verification not found', 404);

    const data = docSnap.data()!;

    await docRef.update({
      status,
      reason: reason || '',
      reviewedAt: now,
      reviewedBy: session.uid,
      updatedAt: now,
    });

    // Update the player profile verification status
    await adminDb.collection('playerProfiles').doc(data.userId).set(
      { verificationStatus: status, updatedAt: now },
      { merge: true }
    );

    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: `verification_${status}`,
      entityType: 'verification',
      entityId: verificationId,
      details: `Admin ${status} player verification${reason ? `: ${reason}` : ''}`,
    });

    return ok({ id: verificationId, status, reason });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

