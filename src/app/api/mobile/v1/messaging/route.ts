import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const session = getMobileSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId: session.id },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const formatted = conversations.map((p: any) => {
      const conv = p.conversation;
      const lastMessage = conv.messages.length > 0 ? conv.messages[0].content : 'No messages yet';
      const lastMessageTime = conv.messages.length > 0 ? conv.messages[0].createdAt.toISOString() : conv.createdAt.toISOString();

      return {
        id: conv.id,
        name: conv.title || (conv.isGroup ? 'Group Chat' : 'Direct Message'),
        lastMessage,
        time: lastMessageTime,
        unread: p.unreadCount,
        avatar: null,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Mobile Messaging Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
