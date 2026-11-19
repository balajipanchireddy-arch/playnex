import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { logActivity } from '@/lib/firebase/activity';

const GameSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().min(2, 'Category is required'),
  description: z.string().default(''),
  logoUrl: z.string().default(''),
  bannerUrl: z.string().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
  minPlayers: z.number().optional().default(1),
  maxPlayers: z.number().optional().default(11),
  rulesSummary: z.string().optional().default(''),
});

const DEFAULT_GAMES = [
  {
    name: 'Badminton',
    category: 'Racquet Sports',
    description: 'Fast-paced singles and doubles competitive racquet sport played with shuttlecocks.',
    logoUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Football / Turf Soccer',
    category: 'Team Sports',
    description: '5-a-side and 7-a-side dynamic turf football leagues, friendly matches and tournaments.',
    logoUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Box Cricket',
    category: 'Team Sports',
    description: 'High-energy indoor & turf box cricket championships with custom overs rules.',
    logoUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Basketball',
    category: 'Team Sports',
    description: '3v3 half-court streetball and 5v5 full-court competitive basketball tournaments.',
    logoUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Tennis & Pickleball',
    category: 'Racquet Sports',
    description: 'Hard court and clay court tennis opens, along with booming pickleball leagues.',
    logoUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Battlegrounds Mobile (BGMI)',
    category: 'Esports',
    description: 'Squad battle royale esports tournaments with prize pools and custom room matches.',
    logoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'Valorant',
    category: 'Esports',
    description: '5v5 tactical hero shooter community showdowns and college championships.',
    logoUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
  {
    name: 'EA FC / FIFA',
    category: 'Esports',
    description: '1v1 and 2v2 virtual football console and PC tournament brackets.',
    logoUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=1200&auto=format&fit=crop&q=80',
    status: 'active',
  },
];

async function checkAdmin(uid: string) {
  const snap = await adminDb
    .collection('userRoles')
    .where('userId', '==', uid)
    .where('roleId', '==', 'admin')
    .where('status', '==', 'active')
    .get();
  return !snap.empty;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const all = searchParams.get('all') === 'true';

    const snap = await adminDb.collection('games').get();

    // If no games exist yet, auto-populate default curated sports/games
    if (snap.empty) {
      const batch = adminDb.batch();
      const initialGames: any[] = [];

      for (const item of DEFAULT_GAMES) {
        const ref = adminDb.collection('games').doc();
        const docData = {
          ...item,
          slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        batch.set(ref, docData);
        initialGames.push({ id: ref.id, ...docData });
      }

      await batch.commit();
      return ok(initialGames);
    }

    let games = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    if (!all) {
      games = games.filter((g: any) => g.status === 'active');
    }

    if (category && category !== 'All') {
      games = games.filter((g: any) => g.category?.toLowerCase() === category.toLowerCase());
    }

    // Sort alphabetically by name
    games.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    return ok(games);
  } catch (error: any) {
    console.error('Error fetching games:', error);
    return fail(error.message || 'Failed to fetch games', 'SERVER_ERROR', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const isAdmin = await checkAdmin(session.uid);
    if (!isAdmin) {
      return fail('Only administrators can create games', 'FORBIDDEN', 403);
    }

    const body = await req.json();
    const parsed = GameSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message || 'Invalid input', 'VALIDATION_ERROR', 400);
    }

    const now = new Date().toISOString();
    const docData = {
      ...parsed.data,
      slug: parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      createdAt: now,
      updatedAt: now,
      createdBy: session.uid,
    };

    const docRef = await adminDb.collection('games').add(docData);

    await logActivity({
      userId: session.uid,
      userName: session.email || 'Admin',
      action: 'game_created',
      entityType: 'game',
      entityId: docRef.id,
      details: `Added new game "${parsed.data.name}" (${parsed.data.category})`,
    });

    return ok({ id: docRef.id, ...docData });
  } catch (error: any) {
    console.error('Error creating game:', error);
    return fail(error.message || 'Failed to create game', 'SERVER_ERROR', 500);
  }
}

