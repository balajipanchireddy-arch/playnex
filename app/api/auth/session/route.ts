import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import {
  verifySession,
  setSessionCookie,
  clearSessionCookie,
} from '@/lib/auth/session';
import {
  isSuperAdmin as isConfiguredSuperAdmin,
  ensureSuperAdminAccount,
} from '@/lib/auth/admin';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({ idToken: z.string().min(10) });

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);

    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
    const isSuperAdmin = await isConfiguredSuperAdmin(decoded.uid, decoded.email);

    if (isSuperAdmin) {
      const user = await ensureSuperAdminAccount(
        decoded.uid,
        decoded.email || '',
        typeof decoded.name === 'string' ? decoded.name : undefined
      );

      try {
        await adminAuth.setCustomUserClaims(decoded.uid, { roles: ['admin'] });
      } catch (err) {
        console.warn('Could not update Admin claims:', err);
      }

      await setSessionCookie(parsed.data.idToken);

      return ok({
        user: user || {
          uid: decoded.uid,
          email: decoded.email,
          fullName: 'Administrator',
        },
        roles: ['admin'],
        isSuperAdmin: true,
      });
    }

    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return fail('not_found', 'No account found. Please register first.', 404);
    }

    const user = userDoc.data()!;

    // Block manually suspended accounts unless suspended solely due to expired 5-day verification
    // (verification_expired players are allowed to sign in to submit proof for restoration).
    if (
      user.accountStatus === 'suspended' &&
      user.suspensionReason &&
      user.suspensionReason !== 'verification_expired'
    ) {
      return fail('suspended', 'Account suspended. Contact support.', 403);
    }

    const rolesSnap = await adminDb
      .collection('userRoles')
      .where('userId', '==', decoded.uid)
      .get();

    const activeRoles = rolesSnap.docs
      .filter((d: any) => d.data().status === 'active')
      .map((d: any) => d.data().roleId as string);
    const suspendedVerificationRoles = rolesSnap.docs
      .filter(
        (d: any) =>
          d.data().status === 'suspended' &&
          d.data().suspensionReason === 'verification_expired'
      )
      .map((d: any) => d.data().roleId as string);

    const roles = Array.from(new Set([...activeRoles, ...suspendedVerificationRoles]));

    if (!roles.length) {
      return fail('no_roles', 'No roles assigned to this account. Contact an administrator.', 403);
    }

    let verificationState = null;
    if (roles.includes('player')) {
      verificationState = await checkAndEnforcePlayerVerification(decoded.uid);
    }

    await setSessionCookie(parsed.data.idToken);
    return ok({ user, roles, verificationState });
  } catch (e: any) {
    console.error('session POST error', e);
    return fail('server_error', e?.message ?? 'Sign in failed', 500);
  }
}

export async function GET() {
  const decoded = await verifySession();
  if (!decoded) return fail('unauthorized', 'Not signed in', 401);

  const isSuperAdmin = await isConfiguredSuperAdmin(decoded.uid, decoded.email);

  if (isSuperAdmin) {
    const user = await ensureSuperAdminAccount(
      decoded.uid,
      decoded.email || '',
      typeof decoded.name === 'string' ? decoded.name : undefined
    );

    return ok({
      user: user || {
        uid: decoded.uid,
        email: decoded.email,
        fullName: 'Administrator',
      },
      roles: ['admin'],
      isSuperAdmin: true,
    });
  }

  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) return fail('not_found', 'User missing', 404);

  const rolesSnap = await adminDb
    .collection('userRoles')
    .where('userId', '==', decoded.uid)
    .get();

  const roles = Array.from(
    new Set(
      rolesSnap.docs
        .filter(
          (d: any) =>
            d.data().status === 'active' ||
            (d.data().status === 'suspended' &&
              d.data().suspensionReason === 'verification_expired')
        )
        .map((d: any) => d.data().roleId as string)
    )
  );

  let verificationState = null;
  if (roles.includes('player') && !roles.includes('admin')) {
    verificationState = await checkAndEnforcePlayerVerification(decoded.uid);
  }

  return ok({ user: userDoc.data(), roles, verificationState });
}

export async function DELETE() {
  clearSessionCookie();
  return ok({ signedOut: true });
}
