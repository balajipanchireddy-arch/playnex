import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

/**
 * Sports & Games Catalog API
 *
 * GET  /api/games           — List active sports/games (?all=true for all including inactive)
 * POST /api/games           — Create a new sport/game (Admin, or Custom Sport by Academy/Player)
 */

const CreateGameSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  category: z.string().min(2).default('Team Sports'),
  description: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  bannerUrl: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
  minPlayers: z.number().int().min(1).optional(),
  maxPlayers: z.number().int().min(1).optional(),
  rulesSummary: z.string().optional().default(''),
  isCustom: z.boolean().optional().default(false),
});

function normalizeSportName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('all') === 'true';

  try {
    const [snap, facSnap] = await Promise.all([
      adminDb.collection('games').get(),
      adminDb.collection('facilities').get(),
    ]);

    let games = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    if (!includeAll) {
      games = games.filter((g: any) => g.status !== 'inactive');
    }

    // Merge any sports already present on Ground (facilities) records so they
    // automatically appear as selectable games in Tournament creation without duplicates.
    const seenSlugs = new Set<string>(
      games.map((g: any) =>
        (g.slug || g.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      )
    );

    facSnap.docs.forEach((d: any) => {
      const sportRaw = (d.data()?.sport || '').trim();
      if (!sportRaw) return;
      const slug = sportRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (slug && !seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        games.push({
          id: `ground_${slug}`,
          name: sportRaw,
          slug,
          category: 'Ground Sport',
          status: 'active',
          source: 'ground',
        });
      }
    });

    games.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    return ok(games);
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to fetch games catalog', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  try {
    const body = await req.json();
    const parsed = CreateGameSchema.safeParse(body);
    if (!parsed.success) {
      return fail('invalid', parsed.error.errors[0]?.message || 'Invalid game payload', 400);
    }

    const adminUser = await isAdmin(session.uid);
    // Non-admins can only register custom sports if isCustom is true
    if (!adminUser && !parsed.data.isCustom) {
      return fail('forbidden', 'Only administrators can add catalog games', 403);
    }

    const normalizedName = normalizeSportName(parsed.data.name);
    const slug = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Prevent accidental duplicates by slug
    const existingSnap = await adminDb
      .collection('games')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      return ok({ id: existing.id, ...existing.data(), alreadyExisted: true });
    }

    const now = new Date().toISOString();
    const gameData = {
      name: normalizedName,
      slug,
      category: parsed.data.category || (parsed.data.isCustom ? 'Custom Sport' : 'Team Sports'),
      description: parsed.data.description || '',
      logoUrl: parsed.data.logoUrl || '',
      bannerUrl: parsed.data.bannerUrl || '',
      status: parsed.data.status || 'active',
      minPlayers: parsed.data.minPlayers ?? 2,
      maxPlayers: parsed.data.maxPlayers ?? 22,
      rulesSummary: parsed.data.rulesSummary || '',
      isCustom: Boolean(parsed.data.isCustom),
      createdBy: session.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('games').add(gameData);

    await logActivity({
      userId: session.uid,
      userName: session.email || (adminUser ? 'Admin' : 'Partner'),
      action: parsed.data.isCustom ? 'custom_sport_created' : 'game_created',
      entityType: 'game',
      entityId: docRef.id,
      details: `Added ${parsed.data.isCustom ? 'custom sport' : 'game'} "${normalizedName}"`,
    });

    return ok({ id: docRef.id, ...gameData });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to create game', 500);
  }
}
