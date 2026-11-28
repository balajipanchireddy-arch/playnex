import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import {
  checkAndEnforcePlayerVerification,
  restoreVerifiedPlayerAccess,
} from '@/lib/verification/player';

/**
 * Player Verification API (5-day deadline + private document vault + suspension/restoration)
 *
 * GET   /api/player/verification       — Own verification state & history, or ?all=true for Admin
 * POST  /api/player/verification       — Submit or resubmit verification proof
 * PATCH /api/player/verification       — Admin review (approved/rejected/under_review/resubmission_required)
 */

const ALLOWED_PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PROOF_BASE64_CHARS = 1_050_000; // ~750KB raw file fits safely inside Firestore 1MB doc limit

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
      const [snap, profilesSnap, usersSnap] = await Promise.all([
        adminDb.collection('playerVerifications').get(),
        adminDb.collection('playerProfiles').get(),
        adminDb.collection('users').get(),
      ]);

      const profileMap = new Map<string, any>();
      profilesSnap.docs.forEach((d: any) => profileMap.set(d.id, d.data()));
      const userMap = new Map<string, any>();
      usersSnap.docs.forEach((d: any) => userMap.set(d.id, d.data()));

      const items = snap.docs.map((d: any) => {
        const data = d.data();
        const prof = profileMap.get(data.userId) || {};
        const usr = userMap.get(data.userId) || {};
        return {
          id: d.id,
          userId: data.userId,
          userEmail: data.userEmail || usr.email || '',
          fullName: data.fullName || usr.fullName || 'Player',
          phone: data.phone || '',
          idType: data.idType || 'Government ID',
          idLast4:
            data.idLast4 ||
            (data.idNumber ? `****${String(data.idNumber).slice(-4)}` : ''),
          address: data.address || '',
          notes: data.notes || '',
          status: data.status,
          reason: data.reason || '',
          hasPrivateProof: Boolean(data.privateDocId),
          privateDocUrl: data.privateDocId ? `/api/documents/${data.privateDocId}` : null,
          verificationDeadline: prof.verificationDeadline || null,
          accountStatus: usr.accountStatus || 'active',
          auditHistory: Array.isArray(data.auditHistory) ? data.auditHistory : [],
          createdAt: data.createdAt,
          reviewedAt: data.reviewedAt || null,
        };
      });

      items.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      return ok(items);
    } catch (e: any) {
      return fail('server_error', e.message, 500);
    }
  }

  const callerIsAdmin = await isAdmin(session.uid);
  const userId = targetUserId && callerIsAdmin ? targetUserId : session.uid;

  try {
    const enforcement = await checkAndEnforcePlayerVerification(userId);

    const snap = await adminDb
      .collection('playerVerifications')
      .where('userId', '==', userId)
      .get();

    if (snap.empty) {
      return ok({
        status: enforcement.status,
        verificationStartedAt: enforcement.verificationStartedAt,
        verificationDeadline: enforcement.verificationDeadline,
        msRemaining: enforcement.msRemaining,
        daysRemaining: enforcement.daysRemaining,
        isExpired: enforcement.isExpired,
        isSuspended: enforcement.isSuspended,
        suspensionReason: enforcement.suspensionReason,
        canAccessRestrictedFeatures: enforcement.canAccessRestrictedFeatures,
        history: [],
      });
    }

    const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    const latest = docs[0];

    const history = docs.map((d: any) => ({
      id: d.id,
      status: d.status,
      idType: d.idType,
      submittedAt: d.createdAt,
      reviewedAt: d.reviewedAt || null,
      reason: d.reason || '',
      hasPrivateProof: Boolean(d.privateDocId),
      auditHistory: Array.isArray(d.auditHistory) ? d.auditHistory : [],
    }));

    return ok({
      id: latest.id,
      fullName: latest.fullName,
      idType: latest.idType,
      status: enforcement.isSuspended && latest.status !== 'pending' && latest.status !== 'under_review'
        ? enforcement.status
        : latest.status,
      reason: latest.reason || '',
      hasPrivateProof: Boolean(latest.privateDocId),
      privateDocUrl: latest.privateDocId ? `/api/documents/${latest.privateDocId}` : null,
      verificationStartedAt: enforcement.verificationStartedAt,
      verificationDeadline: enforcement.verificationDeadline,
      msRemaining: enforcement.msRemaining,
      daysRemaining: enforcement.daysRemaining,
      isExpired: enforcement.isExpired,
      isSuspended: enforcement.isSuspended,
      suspensionReason: enforcement.suspensionReason,
      canAccessRestrictedFeatures: enforcement.canAccessRestrictedFeatures,
      createdAt: latest.createdAt,
      reviewedAt: latest.reviewedAt || null,
      history,
    });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const SubmitBody = z.object({
  fullName: z.string().trim().min(2, 'Full legal name is required').max(120),
  phone: z.string().trim().min(6, 'Valid phone number is required').max(30),
  dateOfBirth: z.string().max(30).optional(),
  address: z.string().max(250).optional(),
  idType: z.string().min(2).max(60).default('Government ID'),
  idNumber: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  proofFileName: z.string().max(150).optional(),
  proofMimeType: z.string().max(80).optional(),
  proofDataBase64: z.string().max(MAX_PROOF_BASE64_CHARS).optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const parsed = SubmitBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid verification payload', 400);
  }

  const {
    fullName,
    phone,
    dateOfBirth,
    address,
    idType,
    idNumber,
    notes,
    proofFileName,
    proofMimeType,
    proofDataBase64,
  } = parsed.data;

  if (!proofDataBase64 || !proofMimeType) {
    return fail('invalid', 'Please upload a valid identity proof image or PDF document.', 400);
  }

  if (!ALLOWED_PROOF_MIME.includes(proofMimeType)) {
    return fail('invalid', 'Proof file must be JPEG, PNG, WebP, or PDF.', 400);
  }

  try {
    // Prevent duplicate pending submissions
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
    const privateDocRef = adminDb.collection('privateVerificationDocs').doc();

    // Store proof securely in private server-only vault (Firestore rules block all client access)
    const cleanBase64 = proofDataBase64.includes(',')
      ? proofDataBase64.split(',')[1]
      : proofDataBase64;

    await privateDocRef.set({
      ownerId: session.uid,
      purpose: 'player_verification',
      entityId: docRef.id,
      fileName: (proofFileName || 'proof').replace(/[^a-zA-Z0-9._-]/g, '_'),
      mimeType: proofMimeType,
      base64Data: cleanBase64,
      createdAt: now,
    });

    const maskedRef = idNumber ? `****${idNumber.trim().slice(-4)}` : '';

    await docRef.set({
      userId: session.uid,
      userEmail: session.email || '',
      fullName,
      phone,
      dateOfBirth: dateOfBirth || '',
      address: address || '',
      idType,
      idLast4: maskedRef,
      notes: notes || '',
      privateDocId: privateDocRef.id,
      status: 'pending',
      auditHistory: [
        {
          action: 'submitted',
          actorId: session.uid,
          at: now,
          note: 'Player submitted verification proof',
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('playerProfiles').doc(session.uid).set(
      {
        verificationStatus: 'pending',
        updatedAt: now,
      },
      { merge: true }
    );

    await logActivity({
      userId: session.uid,
      userName: fullName || session.email || 'Player',
      action: 'verification_submitted',
      entityType: 'verification',
      entityId: docRef.id,
      details: `Player "${fullName}" submitted ${idType} verification proof`,
    });

    await dispatchNotification({
      title: 'Verification Proof Received',
      message: 'Your identity proof has been securely received and queued for PlayNex Admin review.',
      category: 'verification',
      targetRole: 'player',
      recipientId: session.uid,
      targetUserId: session.uid,
      link: '/player',
      senderName: 'PlayNex Verification Desk',
      idempotencyKey: `notif_verif_sub_${docRef.id}`,
    });

    await dispatchNotification({
      title: 'New Player Verification Request',
      message: `${fullName} submitted ${idType} proof for verification review.`,
      category: 'verification',
      targetRole: 'admin',
      link: '/admin?tab=players',
      senderName: fullName,
      idempotencyKey: `notif_verif_admin_${docRef.id}`,
    });

    return ok({ id: docRef.id, status: 'pending' });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

const ReviewBody = z.object({
  verificationId: z.string().min(1),
  status: z.enum(['approved', 'rejected', 'under_review', 'resubmission_required']),
  reason: z.string().max(500).optional(),
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
    const existingHistory = Array.isArray(data.auditHistory) ? data.auditHistory : [];
    const nextHistory = [
      ...existingHistory,
      {
        action: status,
        actorId: session.uid,
        at: now,
        note: reason || `Marked ${status} by administrator`,
      },
    ];

    await docRef.update({
      status,
      reason: reason || '',
      reviewedAt: now,
      reviewedBy: session.uid,
      auditHistory: nextHistory,
      updatedAt: now,
    });

    if (status === 'approved') {
      await restoreVerifiedPlayerAccess(data.userId, session.uid);
    } else {
      await adminDb.collection('playerProfiles').doc(data.userId).set(
        { verificationStatus: status, updatedAt: now },
        { merge: true }
      );
    }

    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: `verification_${status}`,
      entityType: 'verification',
      entityId: verificationId,
      details: `Admin ${status} player verification for ${data.fullName || data.userId}${reason ? `: ${reason}` : ''}`,
    });

    const statusLabels: Record<string, string> = {
      approved: 'Approved — Full Access Restored',
      rejected: 'Verification Rejected',
      under_review: 'Verification Under Review',
      resubmission_required: 'Resubmission Required',
    };

    await dispatchNotification({
      title: statusLabels[status] || 'Verification Update',
      message:
        status === 'approved'
          ? 'Your player identity verification has been approved! All PlayNex player features are active.'
          : `Your verification status is now "${status.replace(/_/g, ' ')}".${reason ? ` Note: ${reason}` : ' Please review and resubmit if required.'}`,
      category: 'verification',
      targetRole: 'player',
      recipientId: data.userId,
      targetUserId: data.userId,
      link: '/player',
      senderName: 'PlayNex Verification Desk',
      idempotencyKey: `notif_verif_rev_${verificationId}_${status}_${now}`,
    });

    return ok({ id: verificationId, status, reason });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}
