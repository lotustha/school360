import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || !session.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notices = await prisma.notice.findMany({
      where: {
        schoolId: session.schoolId,
        isActive: true,
        AND: [
          // not expired
          { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
          // teacher-relevant audiences (legacy targetRole field kept in sync by src/actions/notices.ts)
          { OR: [{ targetRole: "ALL" }, { targetRole: "TEACHER" }, { targetRole: null }] },
        ],
      },
      orderBy: { publishedAt: "desc" },
    });

    return NextResponse.json(notices);
  } catch (error) {
    console.error("Mobile Notices GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
