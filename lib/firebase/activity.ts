import { adminDb } from '@/lib/firebase/admin';

export interface ActivityLogInput {
  userId: string;
  userName?: string;
  action: string;
  entityType:
    | 'tournament'
    | 'registration'
    | 'verification'
    | 'user'
    | 'order'
    | 'rental'
    | 'booking'
    | 'announcement'
    | 'game'
    | 'staff'
    | 'match'
    | 'chat'
    | 'system';
  entityId?: string;
  details: string;
}

export async function logActivity(input: ActivityLogInput) {
  try {
    await adminDb.collection('activityLogs').add({
      ...input,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export interface NotificationInput {
  title: string;
  message: string;
  category:
    | 'tournament'
    | 'match'
    | 'system'
    | 'announcement'
    | 'registration'
    | 'order'
    | 'rental'
    | 'academy'
    | 'store'
    | 'verification'
    | 'chat';
  targetRole: 'all' | 'player' | 'academy' | 'store' | 'admin';
  targetUserId?: string;
  recipientId?: string;
  link?: string;
  senderName?: string;
}

export async function sendNotification(input: NotificationInput) {
  try {
    const recipient = input.recipientId || input.targetUserId || null;
    const docRef = await adminDb.collection('notifications').add({
      ...input,
      targetUserId: recipient,
      recipientId: recipient,
      senderName: input.senderName || 'PlayNex Admin',
      createdAt: Date.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return null;
  }
}
