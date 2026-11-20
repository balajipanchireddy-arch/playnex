import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin, isSuperAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';


export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const [
      playersSnap,
      academiesSnap,
      storesSnap,
      groundsSnap,
      eventsSnap,
      tournamentsSnap,
      registrationsSnap,
      ordersSnap,
      productsSnap,
      notificationsSnap
    ] = await Promise.all([
      adminDb.collection('playerProfiles').count().get(),
      adminDb.collection('academies').count().get(),
      adminDb.collection('stores').count().get(),
      adminDb.collection('facilities').count().get(),
      adminDb.collection('events').count().get(),
      adminDb.collection('tournaments').count().get(),
      adminDb.collection('registrations').count().get(),
      adminDb.collection('orders').count().get(),
      adminDb.collection('products').count().get(),
      adminDb.collection('notifications').count().get(),
    ]);

    const counts = {
      players: playersSnap.data().count,
      academies: academiesSnap.data().count,
      stores: storesSnap.data().count,
      grounds: groundsSnap.data().count,
      tournaments: eventsSnap.data().count + tournamentsSnap.data().count,
      registrations: registrationsSnap.data().count,
      orders: ordersSnap.data().count,
      products: productsSnap.data().count,
      notifications: notificationsSnap.data().count,
    };

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return ok({ counts, total });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

async function batchDeleteCollection(collectionName: string): Promise<number> {
  const snap = await adminDb.collection(collectionName).get();
  if (snap.empty) return 0;

  let totalDeleted = 0;
  const docs = snap.docs;
  const chunkSize = 400; // safe under Firestore's 500 limit

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = adminDb.batch();
    const chunk = docs.slice(i, i + chunkSize);
    chunk.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += chunk.length;
  }

  return totalDeleted;
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('invalid', 'A valid JSON object is required', 400);
    }

    const { confirm, categories } = body;
    const isFullReset = confirm === 'DELETE ALL DATA';
    const allowedCategories = [
      'players', 'academies', 'stores', 'grounds', 'tournaments',
      'registrations', 'orders', 'products', 'notifications',
    ];

    if (isFullReset && !(await isSuperAdmin(session.uid))) {
      return fail('forbidden', 'Only the Super Admin can perform a full system reset', 403);
    }

    if (!isFullReset && (!Array.isArray(categories) || categories.length === 0)) {
      return fail('invalid', 'Provide one or more valid categories to delete', 400);
    }

    if (!isFullReset && categories.some(
      (category: unknown) => typeof category !== 'string' || !allowedCategories.includes(category)
    )) {
      return fail('invalid', 'One or more deletion categories are not allowed', 400);
    }

    const categoriesToDelete: string[] = isFullReset
      ? allowedCategories
      : [...new Set(categories as string[])];

    const results: Record<string, { deleted: number; error?: string }> = {};

    for (const cat of categoriesToDelete) {
      try {
        let count = 0;
        switch (cat) {
          case 'players':
            count = await batchDeleteCollection('playerProfiles');
            break;
          case 'academies':
            count = await batchDeleteCollection('academies');
            break;
          case 'stores':
            count = await batchDeleteCollection('stores');
            break;
          case 'grounds':
            count = await batchDeleteCollection('facilities');
            break;
          case 'tournaments':
            const c1 = await batchDeleteCollection('events');
            const c2 = await batchDeleteCollection('tournaments');
            count = c1 + c2;
            break;
          case 'registrations':
            count = await batchDeleteCollection('registrations');
            break;
          case 'orders':
            count = await batchDeleteCollection('orders');
            break;
          case 'products':
            count = await batchDeleteCollection('products');
            break;
          case 'notifications':
            const n1 = await batchDeleteCollection('notifications');
            const n2 = await batchDeleteCollection('notificationReads');
            count = n1 + n2;
            break;
          default:
            break;
        }
        results[cat] = { deleted: count };
      } catch (err: any) {
        results[cat] = { deleted: 0, error: err.message };
      }
    }

    // Always create an immutable audit record of this operation
    await logActivity({
      userId: session.uid,
      userName: 'Administrator',
      action: isFullReset ? 'system_reset' : 'selective_data_deletion',
      entityType: 'announcement',
      entityId: 'data_reset',
      details: `Admin ${isFullReset ? 'executed complete operational reset' : 'performed selective deletion'} on: ${categoriesToDelete.join(', ')}. Results: ${JSON.stringify(results)}`,
    });

    return ok({
      success: true,
      mode: isFullReset ? 'complete_reset' : 'selective',
      results,
    });
  } catch (e: any) {
    return fail('server_error', e.message || 'System management error', 500);
  }
}
