import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin as checkAdminAccess } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { getUserOwnedAcademyIds } from '@/lib/academies/resolve';

const PUBLIC_TOURNAMENT_STATUSES = new Set(['Registration Open', 'Upcoming', 'Ongoing']);

const UpdateTournamentSchema = z.object({
  name: z.string().min(2).optional(),
  sport: z.string().min(2).optional(),
  category: z.string().optional(),
  participationType: z.enum(['individual', 'team']).optional(),
  description: z.string().optional(),
  venue: z.string().min(2).optional(),
  date: z.string().min(2).optional(),
  registrationDeadline: z.string().min(2).optional(),
  maxParticipants: z.number().int().min(2).optional(),
  entryFee: z.number().min(0).optional(),
  rules: z.string().optional(),
  posterUrl: z.string().optional(),
  status: z.enum([
    'Draft',
    'Upcoming',
    'Registration Open',
    'Registration Closed',
    'Ongoing',
    'Completed',
    'Cancelled'
  ]).optional(),
});

async function getUserRoles(uid: string) {
  const snap = await adminDb.collection('userRoles')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d: any) => d.data().roleId as string);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await verifySession();
    const [callerIsAdmin, ownedAcademyIds] = session
      ? await Promise.all([checkAdminAccess(session.uid), getUserOwnedAcademyIds(session.uid)])
      : [false, new Set<string>()];

    const doc = await adminDb.collection('events').doc(params.id).get();
    if (!doc.exists) return fail('not_found', 'Tournament not found', 404);

    const ev = doc.data()!;
    const isOwner = Boolean(session && ownedAcademyIds.has(ev.academyId));

    if (!callerIsAdmin && !isOwner) {
      if (ev.status === 'Draft') {
        return fail('not_found', 'Tournament not found', 404);
      }

      let isApprovedSource = ev.organizerType === 'admin' || ev.academyVerification === 'approved';
      if (!isApprovedSource && ev.academyId) {
        const acadDoc = await adminDb.collection('academies').doc(ev.academyId).get();
        isApprovedSource = acadDoc.exists && acadDoc.data()?.verificationStatus === 'approved';
      }
      if (!isApprovedSource) {
        return fail('not_found', 'Tournament not found', 404);
      }
      if (!session && !PUBLIC_TOURNAMENT_STATUSES.has(ev.status || 'Upcoming')) {
        return fail('unauthorized', 'Login required', 401);
      }
    }

    const safeBase = {
      id: doc.id,
      name: ev.name || 'Tournament',
      sport: ev.sport || 'Sport',
      category: ev.category || 'Open Championship',
      participationType: ev.participationType || 'individual',
      description: ev.description || '',
      venue: ev.venue || ev.loc || '',
      loc: ev.loc || ev.venue || '',
      date: ev.date || '',
      registrationDeadline: ev.registrationDeadline || '',
      maxParticipants: ev.maxParticipants ?? 0,
      registeredCount: ev.registeredCount ?? 0,
      entryFee: ev.entryFee ?? ev.price ?? 0,
      price: ev.price ?? ev.entryFee ?? 0,
      rules: ev.rules || '',
      posterUrl: ev.posterUrl || '',
      status: ev.status || 'Upcoming',
      academyName: ev.academyName || 'PlayNex',
      createdAt: ev.createdAt || 0,
    };

    if (!session) {
      return ok(safeBase);
    }

    return ok({
      ...safeBase,
      academyId: ev.academyId || null,
      academyVerification: ev.academyVerification || null,
      organizerType: ev.organizerType || null,
    });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const isAdmin = await checkAdminAccess(session.uid);

  try {
    const docRef = adminDb.collection('events').doc(params.id);
    const doc = await docRef.get();
    if (!doc.exists) return fail('not_found', 'Tournament not found', 404);

    const existing = doc.data()!;
    const ownedAcademyIds = await getUserOwnedAcademyIds(session.uid);
    if (!isAdmin && !ownedAcademyIds.has(existing.academyId)) {
      return fail('forbidden', 'You can only edit tournaments you created', 403);
    }

    const body = await req.json();
    const parsed = UpdateTournamentSchema.safeParse(body);
    if (!parsed.success) {
      return fail('invalid', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const updates: any = {
      ...parsed.data,
      updatedAt: Date.now(),
    };
    if (parsed.data.venue) updates.loc = parsed.data.venue;
    if (parsed.data.entryFee !== undefined) updates.price = parsed.data.entryFee;

    await docRef.update(updates);

    await logActivity({
      userId: session.uid,
      action: 'tournament_updated',
      entityType: 'tournament',
      entityId: params.id,
      details: `Updated tournament "${existing.name}". Status changed: ${parsed.data.status || existing.status}`,
    });

    const organizerName = existing.academyName || 'PlayNex Tournament Desk';

    // AUTOMATIC CROSS-PORTAL NOTIFICATIONS: Detect meaningful published changes
    
    // 1. Status Changes
    if (parsed.data.status && parsed.data.status !== existing.status) {
      const newStatus = parsed.data.status;

      if (newStatus === 'Registration Open') {
        await dispatchNotification({
          title: `Registration Open: ${existing.name}`,
          message: `Registration has opened for ${existing.name} (${existing.sport}). Secure your slot before ${parsed.data.registrationDeadline || existing.registrationDeadline || 'the deadline'}!`,
          category: 'tournament',
          targetRole: 'player',
          targetSport: existing.sport,
          link: '/player',
          senderName: organizerName,
          idempotencyKey: `notif_status_open_${params.id}_${Date.now()}`,
        });
      } else if (newStatus === 'Registration Closed') {
        await dispatchNotification({
          title: `🔒 Registration Closed: ${existing.name}`,
          message: `Registration is now closed for ${existing.name}. Tournament begins on ${existing.date}.`,
          category: 'tournament',
          targetRole: 'player',
          targetEventId: params.id,
          link: '/player',
          senderName: organizerName,
          idempotencyKey: `notif_status_closed_${params.id}_${Date.now()}`,
        });
      } else if (newStatus === 'Cancelled') {
        await dispatchNotification({
          title: `⚠️ Tournament Cancelled: ${existing.name}`,
          message: `Notice: ${existing.name} scheduled for ${existing.date} has been cancelled by the organizer.`,
          category: 'tournament',
          targetRole: 'player',
          targetEventId: params.id,
          link: '/player',
          senderName: organizerName,
          idempotencyKey: `notif_status_cancelled_${params.id}_${Date.now()}`,
        });
      }
    }

    // 2. Date Changes
    if (parsed.data.date && parsed.data.date !== existing.date) {
      await dispatchNotification({
        title: `📅 Schedule Change: ${existing.name}`,
        message: `${existing.name} has been rescheduled to ${parsed.data.date}. Please update your calendar.`,
        category: 'tournament',
        targetRole: 'player',
        targetEventId: params.id,
        link: '/player',
        senderName: organizerName,
        idempotencyKey: `notif_date_change_${params.id}_${parsed.data.date}`,
      });
    }

    // 3. Venue Changes
    if (parsed.data.venue && parsed.data.venue !== existing.venue && parsed.data.venue !== existing.loc) {
      await dispatchNotification({
        title: `📍 Venue Update: ${existing.name}`,
        message: `The venue for ${existing.name} is now: ${parsed.data.venue}.`,
        category: 'tournament',
        targetRole: 'player',
        targetEventId: params.id,
        link: '/player',
        senderName: organizerName,
        idempotencyKey: `notif_venue_change_${params.id}_${Date.now()}`,
      });
    }

    // 4. Registration Deadline Extension
    if (parsed.data.registrationDeadline && parsed.data.registrationDeadline !== existing.registrationDeadline) {
      await dispatchNotification({
        title: `⏰ Deadline Extended: ${existing.name}`,
        message: `Registration deadline for ${existing.name} is now ${parsed.data.registrationDeadline}.`,
        category: 'tournament',
        targetRole: 'player',
        targetSport: existing.sport,
        link: '/player',
        senderName: organizerName,
        idempotencyKey: `notif_deadline_change_${params.id}_${parsed.data.registrationDeadline}`,
      });
    }

    return ok({ success: true, id: params.id, ...updates });
  } catch (e: any) {
    return fail('server_error', e.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  if (!params.id) return fail('invalid', 'Tournament ID is required', 400);

  const isAdmin = await checkAdminAccess(session.uid);

  try {
    const docRef = adminDb.collection('events').doc(params.id);
    const doc = await docRef.get();
    if (!doc.exists) return fail('not_found', 'Tournament not found', 404);

    const existing = doc.data()!;
    const ownedAcademyIds = await getUserOwnedAcademyIds(session.uid);
    if (!isAdmin && !ownedAcademyIds.has(existing.academyId)) {
      return fail('forbidden', 'Administrator permissions or tournament ownership required', 403);
    }

    // 1. Before deleting, identify all registered players
    const regSnap = await adminDb.collection('registrations').where('eventId', '==', params.id).get();
    const registeredUserIds: string[] = Array.from(
      new Set(regSnap.docs.map((d: any) => d.data().userId).filter(Boolean))
    );

    // 2. Safely delete all associated registration records in batches
    const regDocs = regSnap.docs;
    const batchSize = 400;
    for (let i = 0; i < regDocs.length; i += batchSize) {
      const chunk = regDocs.slice(i, i + batchSize);
      const batch = adminDb.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Delete the tournament document
    await docRef.delete();

    // 4. Record the deletion in immutable activity logs
    await logActivity({
      userId: session.uid,
      userName: isAdmin ? 'Administrator' : (existing.academyName || 'Academy'),
      action: 'tournament_deleted',
      entityType: 'tournament',
      entityId: params.id,
      details: `Permanently deleted tournament "${existing.name}" (Status: ${existing.status || 'Active'}) and purged ${regDocs.length} registration(s)`,
    });

    // 5. Notify ONLY affected registered players with exact message
    const organizerName = existing.academyName || 'PlayNex';
    for (const uid of registeredUserIds) {
      await dispatchNotification({
        title: 'Tournament Cancelled',
        message: `The tournament ${existing.name} has been cancelled and removed by the organizer.`,
        category: 'tournament',
        targetRole: 'player',
        targetUserId: uid,
        link: '/player',
        senderName: organizerName,
        idempotencyKey: `notif_tournament_cancelled_${params.id}_${uid}`,
      });
    }

    return ok({ 
      success: true, 
      deletedId: params.id, 
      tournamentName: existing.name,
      registrationsRemoved: regDocs.length,
      playersNotified: registeredUserIds.length 
    });
  } catch (e: any) {
    console.error('Failed to delete tournament:', e);
    return fail('server_error', e.message || 'Failed to delete tournament', 500);
  }
}
