import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

// Persistent Firestore rate limiter (max 20 calls per 60s per user) with in-memory fallback
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const AI_RATE_LIMIT_MAX = 20;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;

function checkInMemoryRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + AI_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= AI_RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const now = Date.now();
  const limitRef = adminDb.collection('aiRateLimits').doc(userId);
  try {
    return await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(limitRef);
      const data = snap.exists ? snap.data() : null;
      if (!data || typeof data.resetAt !== 'number' || now > data.resetAt) {
        tx.set(limitRef, {
          userId,
          count: 1,
          resetAt: now + AI_RATE_LIMIT_WINDOW_MS,
          updatedAt: now,
        });
        return true;
      }
      if (Number(data.count || 0) >= AI_RATE_LIMIT_MAX) {
        return false;
      }
      tx.update(limitRef, {
        count: Number(data.count || 0) + 1,
        updatedAt: now,
      });
      return true;
    });
  } catch {
    return checkInMemoryRateLimit(userId);
  }
}

async function getUserContext(uid: string, roles: string[]) {
  const context: Record<string, any> = {
    roles,
  };

  try {
    if (roles.includes('admin')) {
      const [usersSnap, eventsSnap, gamesSnap, verifAcadSnap, verifStoreSnap, verifPlayerSnap] =
        await Promise.all([
          adminDb.collection('users').count().get().then((s: any) => s.data().count).catch(() => 0),
          adminDb.collection('events').count().get().then((s: any) => s.data().count).catch(() => 0),
          adminDb.collection('games').count().get().then((s: any) => s.data().count).catch(() => 0),
          adminDb.collection('academies').where('verificationStatus', '==', 'pending').count().get().then((s: any) => s.data().count).catch(() => 0),
          adminDb.collection('stores').where('verificationStatus', '==', 'pending').count().get().then((s: any) => s.data().count).catch(() => 0),
          adminDb.collection('playerVerifications').where('status', '==', 'pending').count().get().then((s: any) => s.data().count).catch(() => 0),
        ]);
      context.adminMetrics = {
        totalUsers: usersSnap,
        totalEvents: eventsSnap,
        totalGames: gamesSnap,
        pendingAcademyVerifications: verifAcadSnap,
        pendingStoreVerifications: verifStoreSnap,
        pendingPlayerVerifications: verifPlayerSnap,
      };
    }

    if (roles.includes('player')) {
      const [regSnap, bookingsSnap, profSnap] = await Promise.all([
        adminDb.collection('registrations').where('userId', '==', uid).count().get().catch(() => null),
        adminDb.collection('bookings').where('userId', '==', uid).count().get().catch(() => null),
        adminDb.collection('playerProfiles').doc(uid).get().catch(() => null),
      ]);
      context.playerMetrics = {
        registeredTournamentsCount: regSnap ? regSnap.data().count : 0,
        bookingsCount: bookingsSnap ? bookingsSnap.data().count : 0,
        verificationStatus: profSnap?.data()?.verificationStatus || 'not_submitted',
      };
    }

    if (roles.includes('academy')) {
      const [facSnap, eventSnap] = await Promise.all([
        adminDb.collection('facilities').where('academyId', '==', uid).count().get().catch(() => null),
        adminDb.collection('events').where('academyId', '==', uid).count().get().catch(() => null),
      ]);
      context.academyMetrics = {
        facilitiesCount: facSnap ? facSnap.data().count : 0,
        eventsCount: eventSnap ? eventSnap.data().count : 0,
      };
    }

    if (roles.includes('store')) {
      const [prodSnap, orderSnap, rentalSnap] = await Promise.all([
        adminDb.collection('products').where('storeId', '==', uid).count().get().catch(() => null),
        adminDb.collection('orders').where('storeId', '==', uid).count().get().catch(() => null),
        adminDb.collection('rentals').where('storeId', '==', uid).count().get().catch(() => null),
      ]);
      context.storeMetrics = {
        productsCount: prodSnap ? prodSnap.data().count : 0,
        ordersCount: orderSnap ? orderSnap.data().count : 0,
        rentalsCount: rentalSnap ? rentalSnap.data().count : 0,
      };
    }
  } catch (err) {
    console.error('Error compiling AI context:', err);
  }

  return context;
}

function buildSystemPrompt(userEmail: string, roles: string[], context: Record<string, any>) {
  return `You are PlayNex AI, the official assistant for PlayNex (https://playnex-beta.vercel.app), a connected sports and gaming platform.
Current User: ${userEmail}
User Roles: ${roles.join(', ')}

Live Platform Context for this user:
${JSON.stringify(context, null, 2)}

PLATFORM KNOWLEDGE:
- Players: 5-day verification window after signup (account suspended if expired, restored once proof is approved); GPS + manual nearby discovery (5/10/25/50 km); matchmaking requests & chat after acceptance; date+hour ground booking with QR attendance pass; gear purchase & date-range rental (pay at venue/delivery when no payment gateway is configured).
- Academy & Staff: Ground & slot management, tournament hosting, staff management, and QR/manual booking check-in hub.
- Stores: Sports gear catalog supporting purchases and rentals with configurable security deposit and optional ID proof.
- Admin: Partner & player verification, game catalog, announcements, analytics, and database cleanup tool (preserving permanent admins).

SAFETY RULES:
- Never expose private user details, ID document contents, or credentials.
- Never fabricate live numbers not present in the context above.
- Keep answers concise, accurate, and actionable.`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return fail('UNAUTHORIZED', 'Please sign in to chat with PlayNex AI.', 401);
    }

    if (!(await checkRateLimit(session.uid))) {
      return fail(
        'RATE_LIMITED',
        'Rate limit reached (20 messages/minute). Please wait a moment and try again.',
        429
      );
    }

    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return fail('VALIDATION_ERROR', 'Message cannot be empty.', 400);
    }
    if (message.length > 2000) {
      return fail('VALIDATION_ERROR', 'Message exceeds 2000 character limit.', 400);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return fail(
        'AI_NOT_CONFIGURED',
        'PlayNex AI is not configured yet. Set GEMINI_API_KEY in .env.local and Vercel Environment Variables to enable live AI responses.',
        503
      );
    }

    const rolesSnap = await adminDb
      .collection('userRoles')
      .where('userId', '==', session.uid)
      .where('status', '==', 'active')
      .get();
    const roles = rolesSnap.docs.map((d: any) => d.data().roleId as string);

    const context = await getUserContext(session.uid, roles);
    const systemPrompt = buildSystemPrompt(session.email || 'Athlete', roles, context);

    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const contents = [
      ...history
        .filter((h: any) => h && typeof h.text === 'string' && h.text.trim())
        .slice(-10)
        .map((h: any) => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text.slice(0, 2000) }],
        })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text().catch(() => '');
        console.error('Gemini API HTTP error:', geminiRes.status, errText.slice(0, 300));
        return fail(
          'AI_PROVIDER_ERROR',
          `AI service returned status ${geminiRes.status}. Verify GEMINI_API_KEY and model "${model}".`,
          502
        );
      }

      const geminiData = await geminiRes.json();
      const reply = geminiData?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text || '')
        .join('')
        .trim();

      if (!reply) {
        return fail(
          'EMPTY_AI_RESPONSE',
          'The AI model returned an empty response. Please rephrase your question and try again.',
          502
        );
      }

      return ok({ reply, model });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return fail('AI_TIMEOUT', 'AI request timed out after 20 seconds. Please try again.', 504);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    console.error('Error in PlayNex AI chat:', error);
    return fail('SERVER_ERROR', error?.message || 'Internal AI error', 500);
  }
}
