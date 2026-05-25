import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        school: {
          select: { slug: true, name: true, logoUrl: true },
        },
        employee: {
          select: { bankName: true, bankAccount: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      schoolId: user.schoolId,
      school: user.school,
      employee: user.employee,
    });
  } catch (error) {
    console.error("Mobile Profile Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
