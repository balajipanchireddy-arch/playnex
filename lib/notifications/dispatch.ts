import { adminDb } from '@/lib/firebase/admin';
import { logActivity } from '@/lib/firebase/activity';

export interface DispatchNotificationInput {
  title: string;
  message: string;
  category: 'tournament' | 'match' | 'academy' | 'store' | 'announcement' | 'order' | 'registration';
  targetRole?: 'player' | 'all' | 'academy' | 'store';
  targetUserId?: string;
  targetSport?: string;
  targetEventId?: string;
  link?: string;
  senderName?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Centrally dispatches cross-portal notifications with guaranteed idempotency
 * and automated audit logging.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<string | null> {
  try {
    const targetRole = input.targetRole || 'player';
    const senderName = input.senderName || 'PlayNex';
    const now = Date.now();

    const notifData = {
      title: input.title,
      message: input.message,
      category: input.category,
      targetRole,
      targetUserId: input.targetUserId || null,
      targetSport: input.targetSport || null,
      targetEventId: input.targetEventId || null,
      link: input.link || '/player',
      senderName,
      metadata: input.metadata || {},
      createdAt: now,
      idempotencyKey: input.idempotencyKey || null,
    };

    // If idempotencyKey is supplied, use it as the doc ID to ensure zero duplicate delivery
    let docId: string;
    if (input.idempotencyKey) {
      const cleanKey = input.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
      const notifRef = adminDb.collection('notifications').doc(cleanKey);
      const existing = await notifRef.get();
      if (existing.exists) {
        // Notification already sent for this exact action/event
        return cleanKey;
      }
      await notifRef.set(notifData);
      docId = cleanKey;
    } else {
      const docRef = await adminDb.collection('notifications').add(notifData);
      docId = docRef.id;
    }

    // Log the automated notification dispatch
    await logActivity({
      userId: input.targetUserId || 'system',
      userName: senderName,
      action: 'notification_dispatched',
      entityType: 'announcement',
      entityId: docId,
      details: `[${input.category.toUpperCase()}] ${input.title} -> ${input.targetUserId ? `User:${input.targetUserId}` : `Audience:${targetRole}`}`,
    });

    return docId;
  } catch (error) {
    console.error('Failed to dispatch cross-portal notification:', error);
    return null;
  }
}

