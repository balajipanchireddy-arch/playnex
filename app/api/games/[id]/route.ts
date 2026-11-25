import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

const UpdateGameSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  category: z.string().min(2, 'Category is required').optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  minPlayers: z.number().optional(),
  maxPlayers: z.number().optional(),
  rulesSummary: z.string().optional(),
});

async function checkAdmin(uid: string) {
  const snap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .where('status', '==', 'active')
    .get();
  return !snap.empty;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifySession();
    if (!session) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const isAdmin = await checkAdmin(session.uid);
    if (!isAdmin) {
      return fail('Only administrators can edit games', 'FORBIDDEN', 403);
    }

    const { id } = params;
    if (!id) {
      return fail('Game ID required', 'BAD_REQUEST', 400);
    }

    const docRef = adminDb.collection('games').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return fail('Game not found', 'NOT_FOUND', 404);
    }

    const body = await req.json();
    const parsed = UpdateGameSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || 'Invalid input', 'VALIDATION_ERROR', 400);
    }

    const updateData: any = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    if (parsed.data.name) {
      updateData.slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    await docRef.update(updateData);

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Admin',
      action: 'game_updated',
      entityType: 'game',
      entityId: id,
      details: `Updated game "${docSnap.data()?.name}"`,
    });

    const updated = await docRef.get();
    return ok({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    console.error('Error updating game:', error);
    return fail(error.message || 'Failed to update game', 'SERVER_ERROR', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifySession();
    if (!session) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const isAdmin = await checkAdmin(session.uid);
    if (!isAdmin) {
      return fail('Only administrators can delete games', 'FORBIDDEN', 403);
    }

    const { id } = params;
    if (!id) {
      return fail('Game ID required', 'BAD_REQUEST', 400);
    }

    const docRef = adminDb.collection('games').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return fail('Game not found', 'NOT_FOUND', 404);
    }

    const gameName = docSnap.data()?.name || id;

    await docRef.delete();

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Admin',
      action: 'game_deleted',
      entityType: 'game',
      entityId: id,
      details: `Deleted game "${gameName}"`,
    });

    return ok({ message: `Game "${gameName}" deleted successfully` });
  } catch (error: any) {
    console.error('Error deleting game:', error);
    return fail(error.message || 'Failed to delete game', 'SERVER_ERROR', 500);
  }
}

