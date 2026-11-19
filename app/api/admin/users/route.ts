import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

async function isAdmin(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .get();
  return !snap.empty;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const [usersSnap, rolesSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('userRoles').get(),
    ]);

    // Map roles by userId
    const userRolesMap = new Map<string, string[]>();
    rolesSnap.docs.forEach((d: any) => {
      const data = d.data();
      const existing = userRolesMap.get(data.userId) || [];
      existing.push(data.roleId);
      userRolesMap.set(data.userId, existing);
    });

    const users = usersSnap.docs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        fullName: data.fullName || 'User',
        email: data.email || '',
        accountStatus: data.accountStatus || 'active',
        address: data.address || '',
        roles: userRolesMap.get(d.id) || ['player'],
        createdAt: data.createdAt || 0,
      };
    });

    return ok(users);
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

