import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { setSessionCookie } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

const Body = z.object({
  idToken: z.string().min(10),
  fullName: z.string().min(2),
  role: z.enum(['player', 'academy', 'store']),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return fail('invalid', 'Invalid input', 400);
    
    const { idToken, fullName, role } = parsed.data;
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const now = Date.now();
    
    const userRef = adminDb.collection('users').doc(uid);
    const exists = await userRef.get();
    
    if (!exists.exists) {
      await userRef.set({
        uid, fullName, email: decoded.email ?? '',
        accountStatus: 'active', createdAt: now, updatedAt: now,
      });
    }
    
    await adminDb.collection('userRoles').doc(`${uid}_${role}`).set({
      userId: uid, roleId: role, assignedAt: now, assignedBy: 'self', status: 'active',
    });

    // Create specific profiles based on role
    if (role === 'player') {
      await adminDb.collection('playerProfiles').doc(uid).set({
        userId: uid, sportsPreferences: [], skillLevel: 'Beginner', createdAt: now,
      }, { merge: true });
    } else if (role === 'store') {
      await adminDb.collection('stores').doc(uid).set({
        storeId: uid, ownerUserId: uid, storeName: fullName + "'s Store",
        address: 'Update address', contact: '', verificationStatus: 'pending', createdAt: now
      }, { merge: true });
    } else if (role === 'academy') {
      await adminDb.collection('academies').doc(uid).set({
        academyId: uid, ownerUserId: uid, academyName: fullName + "'s Academy",
        address: 'Update address', contact: '', verificationStatus: 'pending', createdAt: now
      }, { merge: true });
    }

    await adminAuth.setCustomUserClaims(uid, { roles: [role] });
    await setSessionCookie(idToken);
    
    return ok({ user: { uid, fullName, email: decoded.email }, roles: [role] });
  } catch (e: any) {
    console.error('register error', e);
    return fail('server_error', e?.message ?? 'Registration failed', 500);
  }
}
