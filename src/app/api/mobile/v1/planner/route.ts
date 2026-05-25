import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const session = getMobileSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lessonPlans = await prisma.lessonPlan.findMany({
      where: { teacherId: session.id },
      include: {
        subject: true,
        class: true,
      },
      orderBy: { date: 'desc' },
    });

    const formatted = lessonPlans.map((lp: any) => ({
      id: lp.id,
      date: lp.date.toISOString(),
      subject: lp.subject.name,
      topic: lp.topic,
      class: lp.class.name,
      status: lp.status,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Mobile Planner Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
