import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Mobile Leaves GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || !session.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { startDate, endDate, reason } = await req.json();

    if (!startDate || !endDate || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        schoolId: session.schoolId,
        userId: session.id,
      }
    });

    return NextResponse.json(leave);
  } catch (error) {
    console.error("Mobile Leaves POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
