import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { runVerificationExpirationSweep } from '@/lib/verification/player';
import { logActivity } from '@/lib/firebase/activity';
import { ok, fail } from '@/lib/api/response';

/**
 * Triggers a server-side 5-day player verification deadline expiration sweep.
 * Accessible by Administrators OR via CRON_SECRET bearer header for scheduled runs.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let actorUid = 'system_cron';
  if (!isCron) {
    const session = await verifySession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    if (!(await isAdmin(session.uid))) return fail('forbidden', 'Admin access required', 403);
    actorUid = session.uid;
  }

  try {
    const result = await runVerificationExpirationSweep();

    await logActivity({
      userId: actorUid,
      userName: isCron ? 'Scheduled Cron' : 'Administrator',
      action: 'verification_expiration_sweep',
      entityType: 'verification',
      entityId: 'sweep',
      details: `Checked ${result.checked} player profile(s): suspended ${result.suspendedCount} expired account(s), skipped ${result.skippedCount}.`,
    });

    return ok(result);
  } catch (e: any) {
    return fail('server_error', e?.message || 'Verification expiration sweep failed', 500);
  }
}
