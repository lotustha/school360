import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routine = await prisma.routineEntry.findMany({
      where: { teacherUserId: session.id },
      include: {
        class: { select: { id: true, name: true } },
        periodSlot: true,
        subject: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { periodSlot: { startTime: "asc" } },
      ],
    });

    return NextResponse.json({ routine });
  } catch (error) {
    console.error("Mobile Routine Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
