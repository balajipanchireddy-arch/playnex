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
      rentalsSnap,
      bookingsSnap,
      matchesSnap,
      playerVerifsSnap,
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
      adminDb.collection('rentals').get(),
      adminDb.collection('bookings').get(),
      adminDb.collection('matches').get(),
      adminDb.collection('playerVerifications').get(),
      adminDb.collection('activityLogs').orderBy('timestamp', 'desc').limit(30).get(),
    ]);

    const roleCounts: Record<string, number> = {
      player: 0,
      academy: 0,
      store: 0,
      admin: 0,
    };
    rolesSnap.docs.forEach((d: any) => {
      const r = d.data().roleId;
      if (d.data().status === 'active' && roleCounts[r] !== undefined) roleCounts[r]++;
    });

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

    let pendingAcademies = 0;
    let approvedAcademies = 0;
    academiesSnap.docs.forEach((d: any) => {
      if (d.data().verificationStatus === 'approved') approvedAcademies++;
      else if (d.data().verificationStatus === 'pending') pendingAcademies++;
    });

    let pendingStores = 0;
    let approvedStores = 0;
    storesSnap.docs.forEach((d: any) => {
      if (d.data().verificationStatus === 'approved') approvedStores++;
      else if (d.data().verificationStatus === 'pending') pendingStores++;
    });

    const pendingPlayerVerifs = playerVerifsSnap.docs.filter((d: any) =>
      ['pending', 'under_review'].includes(d.data()?.status)
    ).length;

    const sportCounts: Record<string, number> = {};
    eventsSnap.docs.forEach((d: any) => {
      const sp = d.data().sport || 'Other';
      sportCounts[sp] = (sportCounts[sp] || 0) + 1;
    });

    let totalRevenue = 0;
    ordersSnap.docs.forEach((d: any) => {
      const data = d.data();
      if (data.status === 'shipped' || data.status === 'delivered') {
        totalRevenue += Number(data.total || data.price * (data.qty || 1) || 0);
      }
    });

    const bookingsByStatus: Record<string, number> = {
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    bookingsSnap.docs.forEach((d: any) => {
      const st = d.data()?.status || 'confirmed';
      bookingsByStatus[st] = (bookingsByStatus[st] || 0) + 1;
    });

    const recentRegistrations = registrationsSnap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);

    const activityLogs = logsSnap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    // Facility counts per academy
    const facByAcademy = new Map<string, number>();
    facilitiesSnap.docs.forEach((d: any) => {
      const aid = d.data()?.academyId;
      if (aid) facByAcademy.set(aid, (facByAcademy.get(aid) || 0) + 1);
    });
    const academiesList = academiesSnap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
      facilitiesCount: facByAcademy.get(d.id) || 0,
    }));

    // Product & order counts per store
    const prodByStore = new Map<string, number>();
    productsSnap.docs.forEach((d: any) => {
      const sid = d.data()?.storeId;
      if (sid) prodByStore.set(sid, (prodByStore.get(sid) || 0) + 1);
    });
    const ordByStore = new Map<string, number>();
    ordersSnap.docs.forEach((d: any) => {
      const sid = d.data()?.storeId;
      if (sid) ordByStore.set(sid, (ordByStore.get(sid) || 0) + 1);
    });
    const storesList = storesSnap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
      productsCount: prodByStore.get(d.id) || 0,
      ordersCount: ordByStore.get(d.id) || 0,
    }));

    const matchesList = matchesSnap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

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
        rentals: rentalsSnap.size,
        bookings: bookingsSnap.size,
        matches: matchesSnap.size,
        revenue: totalRevenue,
        pendingVerifications: pendingAcademies + pendingStores + pendingPlayerVerifs,
        pendingPlayerVerifications: pendingPlayerVerifs,
      },
      verifications: {
        academies: { approved: approvedAcademies, pending: pendingAcademies },
        stores: { approved: approvedStores, pending: pendingStores },
        players: { pending: pendingPlayerVerifs },
      },
      roles: roleCounts,
      tournamentStatuses: tournamentStatusCounts,
      tournamentsBySport: sportCounts,
      bookingsByStatus,
      recentRegistrations,
      activityLogs,
      academiesList,
      storesList,
      matchesList,
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
    const docs = logsSnap.docs.filter((d: any) => d.data()?.action !== 'database_cleanup_executed');
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = adminDb.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

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
