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
        OR: [
          { targetRole: "ALL" },
          { targetRole: "TEACHER" },
          { targetRole: null }
        ]
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notices);
  } catch (error) {
    console.error("Mobile Notices GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
