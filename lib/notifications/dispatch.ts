import { adminDb } from '@/lib/firebase/admin';
import { logActivity } from '@/lib/firebase/activity';

export interface DispatchNotificationInput {
  title: string;
  message: string;
  category:
    | 'tournament'
    | 'match'
    | 'academy'
    | 'store'
    | 'announcement'
    | 'order'
    | 'rental'
    | 'registration'
    | 'verification'
    | 'chat'
    | 'system';
  targetRole?: 'player' | 'all' | 'academy' | 'store' | 'admin';
  targetUserId?: string;
  recipientId?: string;
  targetSport?: string;
  targetEventId?: string;
  link?: string;
  senderName?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Centrally dispatches cross-portal and individual notifications with guaranteed
 * idempotency, strict recipientId isolation, and automated audit logging.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<string | null> {
  try {
    const targetRole = input.targetRole || 'player';
    const senderName = input.senderName || 'PlayNex';
    const recipient = input.recipientId || input.targetUserId || null;
    const now = Date.now();

    const notifData = {
      title: input.title,
      message: input.message,
      category: input.category,
      targetRole,
      targetUserId: recipient,
      recipientId: recipient,
      targetSport: input.targetSport || null,
      targetEventId: input.targetEventId || null,
      link: input.link || (targetRole === 'academy' ? '/academy' : targetRole === 'store' ? '/store' : targetRole === 'admin' ? '/admin' : '/player'),
      senderName,
      metadata: input.metadata || {},
      createdAt: now,
      idempotencyKey: input.idempotencyKey || null,
    };

    let docId: string;
    if (input.idempotencyKey) {
      const cleanKey = input.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
      const notifRef = adminDb.collection('notifications').doc(cleanKey);
      const existing = await notifRef.get();
      if (existing.exists) {
        return cleanKey;
      }
      await notifRef.set(notifData);
      docId = cleanKey;
    } else {
      const docRef = await adminDb.collection('notifications').add(notifData);
      docId = docRef.id;
    }

    await logActivity({
      userId: recipient || 'system',
      userName: senderName,
      action: 'notification_dispatched',
      entityType: 'announcement',
      entityId: docId,
      details: `[${input.category.toUpperCase()}] ${input.title} -> ${recipient ? `User:${recipient}` : `Audience:${targetRole}`}`,
    });

    return docId;
  } catch (error) {
    console.error('Failed to dispatch cross-portal notification:', error);
    return null;
  }
}
