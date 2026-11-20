import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { NextRequest } from 'next/server';


export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const [
      usersSnap,
      rolesSnap,
      eventsSnap,
      registrationsSnap,
      academiesSnap,
      storesSnap,
      facilitiesSnap,
      productsSnap,
      ordersSnap,
      logsSnap,
    ] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('userRoles').get(),
      adminDb.collection('events').get(),
      adminDb.collection('registrations').get(),
      adminDb.collection('academies').get(),
      adminDb.collection('stores').get(),
      adminDb.collection('facilities').get(),
      adminDb.collection('products').get(),
      adminDb.collection('orders').get(),
      adminDb.collection('activityLogs').orderBy('timestamp', 'desc').limit(25).get(),
    ]);

    // Role breakdown (The 4 core platform roles: player, academy, store, admin)
    const roleCounts: Record<string, number> = {
      player: 0,
      academy: 0,
      store: 0,
      admin: 0,
    };
    rolesSnap.docs.forEach((d: any) => {
      const r = d.data().roleId;
      if (roleCounts[r] !== undefined) roleCounts[r]++;
    });

    // Tournament status breakdown
    const tournamentStatusCounts: Record<string, number> = {
      upcoming: 0,
      registration_open: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
      draft: 0,
    };
    eventsSnap.docs.forEach((d: any) => {
      const s = (d.data().status || '').toLowerCase().replace(/\s+/g, '_');
      if (tournamentStatusCounts[s] !== undefined) {
        tournamentStatusCounts[s]++;
      } else {
        tournamentStatusCounts['upcoming']++;
      }
    });

    // Verification counts
    let pendingAcademies = 0;
    let approvedAcademies = 0;
    academiesSnap.docs.forEach((d: any) => {
      if (d.data().verificationStatus === 'approved') approvedAcademies++;
      else pendingAcademies++;
    });

    let pendingStores = 0;
    let approvedStores = 0;
    storesSnap.docs.forEach((d: any) => {
      if (d.data().verificationStatus === 'approved') approvedStores++;
      else pendingStores++;
    });

    // Sports breakdown in tournaments
    const sportCounts: Record<string, number> = {};
    eventsSnap.docs.forEach((d: any) => {
      const sp = d.data().sport || 'Other';
      sportCounts[sp] = (sportCounts[sp] || 0) + 1;
    });

    // Total revenue from shipped orders
    let totalRevenue = 0;
    ordersSnap.docs.forEach((d: any) => {
      const data = d.data();
      if (data.status === 'shipped') {
        totalRevenue += Number(data.total || data.price * (data.qty || 1) || 0);
      }
    });

    // Recent registrations
    const recentRegistrations = registrationsSnap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);

    // Recent activity logs
    const activityLogs = logsSnap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    return ok({
      totals: {
        users: usersSnap.size,
        players: roleCounts.player,
        academies: academiesSnap.size,
        stores: storesSnap.size,
        tournaments: eventsSnap.size,
        registrations: registrationsSnap.size,
        facilities: facilitiesSnap.size,
        products: productsSnap.size,
        orders: ordersSnap.size,
        revenue: totalRevenue,
        pendingVerifications: pendingAcademies + pendingStores,
      },
      verifications: {
        academies: { approved: approvedAcademies, pending: pendingAcademies },
        stores: { approved: approvedStores, pending: pendingStores },
      },
      roles: roleCounts,
      tournamentStatuses: tournamentStatusCounts,
      tournamentsBySport: sportCounts,
      recentRegistrations,
      activityLogs,
    });
  } catch (e: any) {
    console.error('Error compiling analytics:', e);
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);

  try {
    const logsSnap = await adminDb.collection('activityLogs').get();
    const batchSize = 400;
    const docs = logsSnap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batch = adminDb.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

    // Keep an initial log noting that logs were pruned
    await adminDb.collection('activityLogs').add({
      userId: session.uid,
      userName: 'Administrator',
      action: 'logs_pruned',
      entityType: 'announcement',
      details: `Administrator pruned ${docs.length} old platform activity logs`,
      timestamp: Date.now(),
    });

    return ok({ success: true, count: docs.length });
  } catch (e: any) {
    console.error('Failed to clear logs:', e);
    return fail('server_error', e.message || 'Operation failed', 500);
  }
}
