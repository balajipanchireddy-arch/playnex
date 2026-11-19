import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifySession, setSessionCookie, clearSessionCookie } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
const Body = z.object({ idToken: z.string().min(10) });
export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) return fail('not_found', 'No account found. Please register first.', 404);
    const u = userDoc.data()!;
    if (u.accountStatus === 'suspended') return fail('suspended', 'Account suspended', 403);
    const rolesSnap = await adminDb.collection('userRoles').where('userId','==',decoded.uid).where('status','==','active').get();
    const roles = rolesSnap.docs.map((d: any) => d.data().roleId);
    if (!roles.length) return fail('no_roles', 'No roles assigned to this account', 403);
    await setSessionCookie(parsed.data.idToken);
    return ok({ user: u, roles });
  } catch (e: any) {
    console.error('session POST error', e);
    return fail('server_error', e?.message ?? 'Sign in failed', 500);
  }
}
export async function GET() {
  const decoded = await verifySession();
  if (!decoded) return fail('unauthorized', 'Not signed in', 401);
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) return fail('not_found', 'User missing', 404);
  const rolesSnap = await adminDb.collection('userRoles').where('userId','==',decoded.uid).where('status','==','active').get();
  const roles = rolesSnap.docs.map((d: any) => d.data().roleId);
  return ok({ user: userDoc.data(), roles });
}
export async function DELETE() {
  clearSessionCookie();
  return ok({ signedOut: true });
}
