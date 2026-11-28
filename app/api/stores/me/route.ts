import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { findUserStoreDoc } from '@/lib/stores/resolve';
import { deleteStoreCascade } from '@/lib/services/deletion';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const adminUser = await isAdmin(session.uid);

    if (adminUser) {
      const storesSnap = await adminDb.collection('stores').get();
      const stores = storesSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));
      stores.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

      return ok({
        isAdmin: true,
        store: null,
        stores,
        needsRegistration: false,
      });
    }

    const storeDoc = await findUserStoreDoc(session.uid);
    if (!storeDoc) {
      return ok({
        isAdmin: false,
        store: null,
        stores: [],
        needsRegistration: true,
      });
    }

    return ok({
      isAdmin: false,
      needsRegistration: false,
      id: storeDoc.id,
      ...storeDoc.data(),
    });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load store profile', 500);
  }
}

const RegisterStoreBody = z.object({
  storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(100),
  address: z.string().trim().min(2, 'Address is required').max(250),
  contact: z.string().trim().min(6, 'Contact number is required').max(40),
  description: z.string().trim().max(500).optional().default(''),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const parsed = RegisterStoreBody.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', parsed.error.errors[0]?.message || 'Invalid store details', 400);
    }

    const adminUser = await isAdmin(session.uid);
    const existing = await findUserStoreDoc(session.uid);
    if (existing && !adminUser) {
      return fail('conflict', 'A store profile already exists for this account.', 409);
    }

    const now = Date.now();
    const { storeName, address, contact, description } = parsed.data;

    const storeRef = adminUser
      ? adminDb.collection('stores').doc()
      : adminDb.collection('stores').doc(session.uid);

    const storeData = {
      storeId: storeRef.id,
      ownerUserId: session.uid,
      ownerEmail: session.email || '',
      storeName,
      address,
      contact,
      description,
      verificationStatus: adminUser ? 'approved' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await storeRef.set(storeData, { merge: true });

    if (!adminUser) {
      await adminDb.collection('userRoles').doc(`${session.uid}_store`).set(
        {
          userId: session.uid,
          roleId: 'store',
          assignedAt: now,
          assignedBy: 'self_store_registration',
          status: 'active',
        },
        { merge: true }
      );
    }

    await logActivity({
      userId: session.uid,
      userName: storeName,
      action: 'store_registered',
      entityType: 'verification',
      entityId: storeRef.id,
      details: `Registered store "${storeName}" (${address})`,
    });

    return ok({
      id: storeRef.id,
      ...storeData,
    });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to register store', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get('storeId');

  try {
    const adminUser = await isAdmin(session.uid);
    const callerStore = await findUserStoreDoc(session.uid);
    const targetStoreId = adminUser && storeIdParam ? storeIdParam : callerStore?.id || session.uid;

    const result = await deleteStoreCascade(targetStoreId, session.uid, adminUser);
    if (result.status !== 200) {
      return fail(
        result.status === 404 ? 'not_found' : result.status === 409 ? 'conflict' : 'forbidden',
        result.error || 'Failed to delete store',
        result.status
      );
    }
    return ok(result.data);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to delete store', 500);
  }
}
