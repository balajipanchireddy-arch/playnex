import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';

// In-memory sliding rate limiter: max 20 calls per 60s per user
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 20) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function getUserContext(uid: string, roles: string[]) {
  const context: Record<string, any> = {
    roles,
  };

  try {
    if (roles.includes('admin')) {
      const [usersSnap, eventsSnap, gamesSnap, verifAcadSnap, verifStoreSnap] = await Promise.all([
        adminDb.collection('users').get().then((s: any) => s.size).catch(() => 0),
        adminDb.collection('events').get().then((s: any) => s.size).catch(() => 0),
        adminDb.collection('games').get().then((s: any) => s.size).catch(() => 0),
        adminDb.collection('academies').where('verificationStatus', '==', 'pending').get().then((s: any) => s.size).catch(() => 0),
        adminDb.collection('stores').where('verificationStatus', '==', 'pending').get().then((s: any) => s.size).catch(() => 0),
      ]);
      context.adminMetrics = {
        totalUsers: usersSnap,
        totalEvents: eventsSnap,
        totalGames: gamesSnap,
        pendingAcademyVerifications: verifAcadSnap,
        pendingStoreVerifications: verifStoreSnap,
      };
    }

    if (roles.includes('player')) {
      const regSnap = await adminDb.collection('registrations').where('userId', '==', uid).get().catch(() => null);
      context.playerMetrics = {
        registeredTournamentsCount: regSnap ? regSnap.size : 0,
      };
    }

    if (roles.includes('academy')) {
      const [facSnap, eventSnap] = await Promise.all([
        adminDb.collection('facilities').where('academyId', '==', uid).get().catch(() => null),
        adminDb.collection('events').where('academyId', '==', uid).get().catch(() => null),
      ]);
      context.academyMetrics = {
        facilitiesCount: facSnap ? facSnap.size : 0,
        eventsCount: eventSnap ? eventSnap.size : 0,
      };
    }

    if (roles.includes('store')) {
      const [prodSnap, orderSnap] = await Promise.all([
        adminDb.collection('products').where('storeId', '==', uid).get().catch(() => null),
        adminDb.collection('orders').where('storeId', '==', uid).get().catch(() => null),
      ]);
      context.storeMetrics = {
        productsCount: prodSnap ? prodSnap.size : 0,
        ordersCount: orderSnap ? orderSnap.size : 0,
      };
    }
  } catch (err) {
    console.error('Error compiling AI context:', err);
  }

  return context;
}

function buildSystemPrompt(userEmail: string, roles: string[], context: Record<string, any>) {
  return `You are PlayNex AI, the official intelligent assistant for PlayNex (https://playnex-beta.vercel.app), a modern sports and gaming ecosystem.
Current User: ${userEmail}
User Roles: ${roles.join(', ')}

Live Platform Context for this user:
${JSON.stringify(context, null, 2)}

ROLE-BASED GUIDELINES:
1. PLAYER: Explain how to discover turfs, reserve hourly match slots, register for open tournaments, track registrations, find nearby athletes, and order authentic sports gear.
2. ACADEMY: Explain how to register grounds/turfs, manage live hourly time-slots, toggle arena closures, host and manage tournaments, and manage registrations.
3. STORE: Help merchants manage catalog products, stock levels, view customer equipment orders, and fulfill shipments.
4. ADMIN: Assist with platform moderation, managing games in the Game Management system, approving academy/store verifications, ecosystem metrics, and announcements.

SAFETY & PRIVACY CONSTRAINTS:
- NEVER reveal personal, financial, or private account details of other users or administrators.
- If a user asks for something outside their role's permissions (e.g. non-admin asking for other user passwords or full database exports), politely explain role-based security boundaries.
- Keep answers concise, actionable, and formatted with clear bullet points.
- Use a friendly, high-energy sports-tech tone.`;
}

// Fallback response engine if Gemini API key is missing or encounters errors
function generateFallbackResponse(message: string, roles: string[], context: Record<string, any>): string {
  const q = message.toLowerCase();

  if (q.includes('game') || q.includes('esport') || q.includes('sport')) {
    return `### 🎮 PlayNex Games & Sports
PlayNex features a centralized Game Management system spanning physical sports and esports:
- **Racquet Sports**: Badminton, Tennis, Pickleball
- **Team Sports**: Football / Turf Soccer, Box Cricket, Basketball
- **Esports**: Battlegrounds Mobile (BGMI), Valorant, EA FC / FIFA

**How it works**:
- **Players**: Can filter tournaments by game or sport directly in the Player Arena.
- **Academies**: Can link their tournaments to official games during creation.
- **Stores**: Can tag equipment to specific games for targeted search.
${roles.includes('admin') ? '- **Admins**: Can add, update, or delete games anytime from the **Admin Control > Game Management** tab.' : ''}`;
  }

  if (q.includes('tournament') || q.includes('event') || q.includes('register')) {
    if (roles.includes('academy')) {
      return `### 🏆 Academy Tournament Hosting
As an academy operator, you can host tournaments directly from your **Academy & Turfs** dashboard:
1. Click **Host Tournament**.
2. Select the game/sport, title, venue, entry fee, participant cap, and registration deadline.
3. Once published, athletes across PlayNex can register instantly.
4. You can monitor registrations and safely delete or cancel events if needed (registered athletes are automatically notified).`;
    }
    return `### 🏆 Tournament Registrations
In the **Player Arena**:
1. Browse active tournaments filtered by your favorite game or sport.
2. Check entry fees, date, venue, and live athlete registration count.
3. Click **Register** to secure your spot.
4. View all your active tournament registrations anytime from your dashboard.`;
  }

  if (q.includes('turf') || q.includes('ground') || q.includes('book') || q.includes('slot')) {
    if (roles.includes('academy')) {
      return `### 🏟️ Ground & Slot Management
1. In your **Academy & Turfs** portal, view all listed grounds.
2. Toggle individual hourly slots between **Open** (Available) and **Booked**.
3. Adjust hourly pricing or mark grounds temporarily closed for maintenance.`;
    }
    return `### 🏟️ Ground & Turf Booking
Athletes can explore verified turfs and grounds in the **Player Arena**:
- View amenities, hourly rates, and live slot availability (6 AM - 10 PM).
- Confirm reservations and get instant booking confirmations.`;
  }

  if (q.includes('store') || q.includes('product') || q.includes('order') || q.includes('gear')) {
    if (roles.includes('store')) {
      return `### 🛍️ Store Inventory & Order Management
From your **Sports Store** control hub:
- Click **Add Product** to list authentic apparel, footwear, and equipment with images and stock counts.
- Monitor incoming orders and update delivery status to **Shipped** or **Delivered**.`;
    }
    return `### 🛍️ PlayNex Sports Store
Browse authentic sporting equipment and merchandise listed by verified merchant shops in the **Sports Store** tab.`;
  }

  if (roles.includes('admin') && (q.includes('metric') || q.includes('stat') || q.includes('analytic') || q.includes('verify'))) {
    const metrics = context.adminMetrics || {};
    return `### 🛡️ Admin Executive Briefing
- **Total Registered Users**: ${metrics.totalUsers ?? 'Loading'}
- **Live Tournaments & Events**: ${metrics.totalEvents ?? 'Loading'}
- **Managed Games**: ${metrics.totalGames ?? 'Loading'}
- **Pending Academy Verifications**: ${metrics.pendingAcademyVerifications ?? 0}
- **Pending Store Verifications**: ${metrics.pendingStoreVerifications ?? 0}

Navigate to **Admin Control** to review pending documents, publish platform announcements, or manage games.`;
  }

  return `### ⚡ PlayNex AI Assistant
Welcome! I'm here to help you get the most out of PlayNex:
- **Player Arena**: Find matches, join tournaments, book hourly turfs.
- **Academy & Turfs**: Manage venues, hourly availability, and host tournaments.
- **Sports Store**: Browse gear or manage merchant inventory.
- **Game Hub**: Explore supported physical sports and esports titles.

How can I help you with your sports journey today?`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) {
      return fail('Please sign in to chat with PlayNex AI', 'UNAUTHORIZED', 401);
    }

    if (!checkRateLimit(session.uid)) {
      return fail('You have sent too many requests. Please wait a minute before asking again.', 'RATE_LIMITED', 429);
    }

    const body = await req.json();
    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return fail('Message cannot be empty', 'VALIDATION_ERROR', 400);
    }

    const rolesSnap = await adminDb
      .collection('userRoles')
      .where('userId', '==', session.uid)
      .where('status', '==', 'active')
      .get();
    const roles = rolesSnap.docs.map((d: any) => d.data().roleId as string);

    const context = await getUserContext(session.uid, roles);
    const systemPrompt = buildSystemPrompt(session.email || 'Athlete', roles, context);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: "Understood. I am PlayNex AI, ready to assist with sports, tournaments, venues, games, and portal management according to the user's role." }] },
          ...history.slice(-6).map((h: any) => ({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          })),
          { role: 'user', parts: [{ text: message }] },
        ];

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return ok({ reply });
          }
        } else {
          console.warn('Gemini API call returned non-200, falling back to local reasoning:', geminiRes.status);
        }
      } catch (geminiErr) {
        console.warn('Gemini API request failed, falling back to contextual engine:', geminiErr);
      }
    }

    // High quality contextual fallback
    const fallbackReply = generateFallbackResponse(message, roles, context);
    return ok({ reply: fallbackReply });
  } catch (error: any) {
    console.error('Error in PlayNex AI chat:', error);
    return fail(error.message || 'Internal AI error', 'SERVER_ERROR', 500);
  }
}
