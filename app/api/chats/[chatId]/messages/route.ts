import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api/response';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { checkAndEnforcePlayerVerification } from '@/lib/verification/player';

export async function GET(
  _req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const { chatId } = params;
  if (!chatId) return fail('invalid', 'Chat ID required', 400);

  try {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) return fail('not_found', 'Conversation not found', 404);

    const chatData = chatSnap.data()!;
    if (!Array.isArray(chatData.participants) || !chatData.participants.includes(session.uid)) {
      return fail('forbidden', 'You are not a participant of this conversation.', 403);
    }

    const msgSnap = await chatRef
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();

    const messages = msgSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Update caller's read cursor
    await chatRef.update({
      [`lastReadAt.${session.uid}`]: Date.now(),
    });

    return ok({ chat: { id: chatSnap.id, ...chatData }, messages });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to load messages', 500);
  }
}

const SendMessageBody = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const session = await verifySession();
  if (!session) return fail('unauthorized', 'Login required', 401);

  const verif = await checkAndEnforcePlayerVerification(session.uid);
  if (!verif.canAccessRestrictedFeatures) {
    return fail(
      'account_suspended',
      'Your account is suspended due to expired verification. Submit proof to send messages.',
      403
    );
  }

  const { chatId } = params;
  const parsed = SendMessageBody.safeParse(await req.json());
  if (!parsed.success) {
    return fail('invalid', parsed.error.errors[0]?.message || 'Invalid message', 400);
  }

  try {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) return fail('not_found', 'Conversation not found', 404);

    const chatData = chatSnap.data()!;
    const participants: string[] = Array.isArray(chatData.participants) ? chatData.participants : [];
    if (!participants.includes(session.uid)) {
      return fail('forbidden', 'You are not a participant of this conversation.', 403);
    }

    const otherParticipants = participants.filter((uid) => uid !== session.uid);

    // Block check in both directions before allowing message
    for (const otherUid of otherParticipants) {
      const [b1, b2] = await Promise.all([
        adminDb.collection('userBlocks').doc(`${session.uid}_${otherUid}`).get(),
        adminDb.collection('userBlocks').doc(`${otherUid}_${session.uid}`).get(),
      ]);
      if (b1.exists || b2.exists) {
        return fail('blocked', 'Messaging is disabled because one of the users is blocked.', 403);
      }
    }

    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const senderName = userDoc.data()?.fullName || session.email || 'Player';
    const now = Date.now();

    const msgRef = await chatRef.collection('messages').add({
      chatId,
      senderId: session.uid,
      senderName,
      text: parsed.data.text,
      createdAt: now,
    });

    await chatRef.update({
      lastMessage: parsed.data.text.slice(0, 120),
      lastMessageAt: now,
      lastMessageSenderId: session.uid,
      updatedAt: now,
      [`lastReadAt.${session.uid}`]: now,
    });

    for (const recipientUid of otherParticipants) {
      await dispatchNotification({
        title: `New message from ${senderName}`,
        message: parsed.data.text.slice(0, 100),
        category: 'chat',
        targetRole: 'player',
        recipientId: recipientUid,
        targetUserId: recipientUid,
        link: '/player',
        senderName,
        idempotencyKey: `notif_chat_${msgRef.id}_${recipientUid}`,
      });
    }

    return ok({
      id: msgRef.id,
      chatId,
      senderId: session.uid,
      senderName,
      text: parsed.data.text,
      createdAt: now,
    });
  } catch (e: any) {
    return fail('server_error', e.message || 'Failed to send message', 500);
  }
}
