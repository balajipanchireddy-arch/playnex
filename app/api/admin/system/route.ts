import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifySession } from '@/lib/auth/session';
import { isSuperAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import {
  CLEANUP_CATEGORIES,
  type CleanupCategory,
  inspectDatabase,
  generateCleanupPreview,
  exportCleanupBackup,
  executeCleanup,
} from '@/lib/services/cleanup';

/**
 * Admin-Only Database Inspection, Preview, Backup & Safe Cleanup API
 * Strictly restricted to the two permanent PlayNex administrators.
 */

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isSuperAdmin(session.uid, session.email))) {
    return fail('forbidden', 'Only the two permanent PlayNex administrators may access the database cleanup tool.', 403);
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'inspect';

  try {
    if (action === 'backup') {
      const rawCats = searchParams.get('categories') || '';
      const parsedCats = rawCats
        .split(',')
        .map((c) => c.trim())
        .filter((c): c is CleanupCategory =>
          (CLEANUP_CATEGORIES as readonly string[]).includes(c)
        );
      const categories: CleanupCategory[] =
        parsedCats.length > 0 ? parsedCats : [...CLEANUP_CATEGORIES];
      const backup = await exportCleanupBackup(categories);
      return ok(backup);
    }

    const inspection = await inspectDatabase();
    return ok(inspection);
  } catch (e: any) {
    return fail('server_error', e?.message || 'Database inspection failed', 500);
  }
}

const PreviewSchema = z.object({
  mode: z.enum(['selective', 'complete_reset']).default('selective'),
  categories: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isSuperAdmin(session.uid, session.email))) {
    return fail('forbidden', 'Only the two permanent PlayNex administrators may preview database cleanup.', 403);
  }

  try {
    const parsed = PreviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', 'Invalid preview parameters', 400);
    }

    const { mode, categories } = parsed.data;
    const validCategories = categories.filter((c): c is CleanupCategory =>
      (CLEANUP_CATEGORIES as readonly string[]).includes(c)
    );

    if (mode === 'selective' && validCategories.length === 0) {
      return fail('invalid', 'Select at least one valid cleanup category to preview', 400);
    }

    if (mode === 'selective' && validCategories.length !== categories.length) {
      return fail('invalid', 'One or more requested categories are not permitted', 400);
    }

    const preview = await generateCleanupPreview(validCategories, mode);
    return ok(preview);
  } catch (e: any) {
    return fail('server_error', e?.message || 'Failed to generate cleanup preview', 500);
  }
}

const ExecuteSchema = z.object({
  mode: z.enum(['selective', 'complete_reset']),
  categories: z.array(z.string()).default([]),
  previewHash: z.string().min(8, 'Preview must be generated before deletion'),
  confirm: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);
  if (!(await isSuperAdmin(session.uid, session.email))) {
    return fail('forbidden', 'Only the two permanent PlayNex administrators may execute database cleanup.', 403);
  }

  try {
    const parsed = ExecuteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('invalid', parsed.error.errors[0]?.message || 'Invalid cleanup payload', 400);
    }

    const { mode, categories, previewHash, confirm } = parsed.data;

    if (mode === 'complete_reset' && confirm !== 'DELETE ALL DATA') {
      return fail('invalid', 'Type "DELETE ALL DATA" to confirm full application-data reset.', 400);
    }
    if (mode === 'selective' && confirm !== 'CONFIRM CLEANUP') {
      return fail('invalid', 'Explicit confirmation ("CONFIRM CLEANUP") is required.', 400);
    }

    const validCategories = categories.filter((c): c is CleanupCategory =>
      (CLEANUP_CATEGORIES as readonly string[]).includes(c)
    );
    if (mode === 'selective' && (validCategories.length === 0 || validCategories.length !== categories.length)) {
      return fail('invalid', 'One or more cleanup categories are invalid', 400);
    }

    const report = await executeCleanup({
      categories: validCategories,
      mode,
      previewHash,
      actorUid: session.uid,
      actorEmail: session.email,
    });

    return ok(report);
  } catch (e: any) {
    if (String(e?.message || '').startsWith('PREVIEW_MISMATCH')) {
      return fail('conflict', e.message, 409);
    }
    return fail('server_error', e?.message || 'Database cleanup execution failed', 500);
  }
}
