import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        school: { select: { name: true, logoUrl: true } },
        _count: {
          select: {
            classesTaught: true,
            subjectAssignments: true,
            leaveRequests: true,
          }
        }
      }
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
