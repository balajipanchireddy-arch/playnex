import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

export async function GET() {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const snap = await adminDb.collection('tasks').where('assignedTo', '==', session.uid).get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ok(tasks);
  } catch (e: any) { return fail('server_error', e.message, 500); }
}

export async function PATCH(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const body = await req.json();
    if (!body.taskId) return fail('invalid', 'Missing taskId', 400);

    await adminDb.collection('tasks').doc(body.taskId).update({ status: 'completed' });
    return ok({ success: true });
  } catch (e: any) { return fail('server_error', e.message, 500); }
}
