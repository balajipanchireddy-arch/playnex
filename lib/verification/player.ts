import 'server-only';

import { adminDb } from '@/lib/firebase/admin';
import { isAdmin, isProtectedPermanentAdmin } from '@/lib/auth/admin';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import type { PlayerVerificationStatus } from '@/types';

export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export interface VerificationEnforcementState {
  status: PlayerVerificationStatus;
  verificationStartedAt: number;
  verificationDeadline: number;
  msRemaining: number;
  daysRemaining: number;
  isExpired: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  canAccessRestrictedFeatures: boolean;
}

/**
 * Ensures player verification deadline timestamps exist using authoritative server time.
 */
export async function ensurePlayerVerificationWindow(uid: string) {
  const now = Date.now();
  const profileRef = adminDb.collection('playerProfiles').doc(uid);
  const profileSnap = await profileRef.get();
  const data = profileSnap.exists ? profileSnap.data() || {} : {};

  if (!data.verificationDeadline || !data.verificationStartedAt) {
    const startedAt = typeof data.createdAt === 'number' ? data.createdAt : now;
    const deadline = startedAt + FIVE_DAYS_MS;
    await profileRef.set(
      {
        userId: uid,
        verificationStatus: data.verificationStatus || 'not_submitted',
        verificationStartedAt: startedAt,
        verificationDeadline: deadline,
        updatedAt: now,
      },
      { merge: true }
    );
    return {
      ...data,
      verificationStatus: (data.verificationStatus || 'not_submitted') as PlayerVerificationStatus,
      verificationStartedAt: startedAt,
      verificationDeadline: deadline,
    };
  }

  return data;
}

/**
 * Evaluates and enforces the 5-day player verification deadline using server time.
 * Automatically suspends unverified players whose deadline has expired without
 * required submission, while preserving their Firebase Authentication account
 * so they can still submit proof later for admin review and restoration.
 */
export async function checkAndEnforcePlayerVerification(
  uid: string
): Promise<VerificationEnforcementState> {
  const now = Date.now();

  // Permanent admins and active admins are never restricted by player verification.
  if ((await isProtectedPermanentAdmin(uid)) || (await isAdmin(uid))) {
    return {
      status: 'approved',
      verificationStartedAt: now,
      verificationDeadline: now + FIVE_DAYS_MS,
      msRemaining: FIVE_DAYS_MS,
      daysRemaining: 5,
      isExpired: false,
      isSuspended: false,
      suspensionReason: null,
      canAccessRestrictedFeatures: true,
    };
  }

  const [userDoc, profileData] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    ensurePlayerVerificationWindow(uid),
  ]);

  const userData = userDoc.exists ? userDoc.data() || {} : {};
  const startedAt = Number(profileData.verificationStartedAt || now);
  const deadline = Number(profileData.verificationDeadline || startedAt + FIVE_DAYS_MS);
  const currentStatus = (profileData.verificationStatus || 'not_submitted') as PlayerVerificationStatus;

  const isApproved = currentStatus === 'approved';
  const hasActiveReview = currentStatus === 'pending' || currentStatus === 'under_review';
  const isExpired = !isApproved && !hasActiveReview && now > deadline;

  // Check if user was suspended manually by admin for another reason
  const manualSuspension =
    userData.accountStatus === 'suspended' &&
    userData.suspensionReason &&
    userData.suspensionReason !== 'verification_expired';

  if (manualSuspension) {
    return {
      status: currentStatus,
      verificationStartedAt: startedAt,
      verificationDeadline: deadline,
      msRemaining: Math.max(0, deadline - now),
      daysRemaining: Math.max(0, Math.ceil((deadline - now) / (24 * 60 * 60 * 1000))),
      isExpired,
      isSuspended: true,
      suspensionReason: userData.suspensionReason || 'admin_suspended',
      canAccessRestrictedFeatures: false,
    };
  }

  // Enforce automatic suspension on deadline expiration (without deleting Auth account)
  if (isExpired && (userData.accountStatus !== 'suspended' || currentStatus !== 'suspended_expired')) {
    const batch = adminDb.batch();
    batch.set(
      adminDb.collection('users').doc(uid),
      {
        accountStatus: 'suspended',
        suspensionReason: 'verification_expired',
        suspendedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    batch.set(
      adminDb.collection('playerProfiles').doc(uid),
      {
        verificationStatus: 'suspended_expired',
        suspendedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    const roleSnap = await adminDb
      .collection('userRoles')
      .where('userId', '==', uid)
      .where('roleId', '==', 'player')
      .get();
    roleSnap.docs.forEach((d: any) => {
      if (d.data()?.status === 'active') {
        batch.update(d.ref, {
          status: 'suspended',
          suspensionReason: 'verification_expired',
          updatedAt: now,
        });
      }
    });

    await batch.commit();

    await logActivity({
      userId: uid,
      userName: userData.fullName || userData.email || uid,
      action: 'player_verification_expired_suspended',
      entityType: 'verification',
      entityId: uid,
      details: 'Player account automatically suspended after 5-day verification deadline expired without approved submission.',
    });

    await dispatchNotification({
      title: 'Account Suspended — Verification Required',
      message:
        'Your 5-day player verification deadline has expired. Restricted features are paused until you submit verification proof and an administrator approves it.',
      category: 'system',
      targetRole: 'player',
      targetUserId: uid,
      link: '/player',
      senderName: 'PlayNex Verification Desk',
      idempotencyKey: `notif_verif_expired_${uid}_${deadline}`,
    });

    return {
      status: 'suspended_expired',
      verificationStartedAt: startedAt,
      verificationDeadline: deadline,
      msRemaining: 0,
      daysRemaining: 0,
      isExpired: true,
      isSuspended: true,
      suspensionReason: 'verification_expired',
      canAccessRestrictedFeatures: false,
    };
  }

  const isSuspended =
    userData.accountStatus === 'suspended' || currentStatus === 'suspended_expired';

  const msRemaining = Math.max(0, deadline - now);
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return {
    status: currentStatus,
    verificationStartedAt: startedAt,
    verificationDeadline: deadline,
    msRemaining,
    daysRemaining,
    isExpired,
    isSuspended,
    suspensionReason: isSuspended ? userData.suspensionReason || 'verification_expired' : null,
    canAccessRestrictedFeatures: !isSuspended,
  };
}

/**
 * Restores a player's suspended account when an administrator approves their verification.
 */
export async function restoreVerifiedPlayerAccess(uid: string, adminUid: string) {
  const now = Date.now();
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  const batch = adminDb.batch();
  if (
    userData.accountStatus === 'suspended' &&
    (!userData.suspensionReason || userData.suspensionReason === 'verification_expired')
  ) {
    batch.set(
      userRef,
      {
        accountStatus: 'active',
        suspensionReason: null,
        reactivatedAt: now,
        reactivatedBy: adminUid,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  batch.set(
    adminDb.collection('playerProfiles').doc(uid),
    {
      verificationStatus: 'approved',
      verifiedAt: now,
      verifiedBy: adminUid,
      updatedAt: now,
    },
    { merge: true }
  );

  const roleSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'player')
    .get();
  roleSnap.docs.forEach((d: any) => {
    if (d.data()?.status === 'suspended') {
      batch.update(d.ref, {
        status: 'active',
        suspensionReason: null,
        updatedAt: now,
      });
    }
  });

  await batch.commit();
}

/**
 * Sweeps all player profiles for expired 5-day verification deadlines.
 * Can be triggered by Admin or an external cron/scheduler endpoint.
 */
export async function runVerificationExpirationSweep() {
  const now = Date.now();
  const profilesSnap = await adminDb.collection('playerProfiles').get();
  let checked = 0;
  let suspendedCount = 0;
  let skippedCount = 0;

  for (const doc of profilesSnap.docs) {
    const data = doc.data() || {};
    checked++;
    if (data.verificationStatus === 'approved' || data.verificationStatus === 'suspended_expired') {
      skippedCount++;
      continue;
    }
    const deadline = Number(data.verificationDeadline || 0);
    if (!deadline || now <= deadline) {
      skippedCount++;
      continue;
    }
    const res = await checkAndEnforcePlayerVerification(doc.id);
    if (res.isSuspended && res.status === 'suspended_expired') {
      suspendedCount++;
    }
  }

  return { checked, suspendedCount, skippedCount, sweptAt: now };
}
