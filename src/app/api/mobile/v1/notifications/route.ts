import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const user = getMobileSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notifications = await prisma.appNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = notifications.map((n: any) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      time: n.createdAt.toISOString(),
      type: n.type,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getMobileSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.appNotification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
