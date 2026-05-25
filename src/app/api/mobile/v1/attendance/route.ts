import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const dateBS = searchParams.get("dateBS");

    if (!classId || !dateBS) {
      return NextResponse.json({ error: "classId and dateBS are required" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: { classId, status: "ACTIVE" },
      select: {
        id: true,
        rollNumber: true,
        fullNameNepali: true,
        user: { select: { fullName: true, avatarUrl: true } }
      },
      orderBy: { rollNumber: "asc" },
    });

    const attendances = await prisma.attendance.findMany({
      where: { classId, dateBS, period: null },
    });

    return NextResponse.json({ students, attendances });
  } catch (error) {
    console.error("Mobile Attendance GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const attendanceSchema = z.object({
  classId: z.string(),
  dateBS: z.string(),
  dateAD: z.string(),
  records: z.array(z.object({
    studentId: z.string(),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    note: z.string().optional().nullable(),
  })),
});

export async function POST(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || !session.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = attendanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error }, { status: 400 });

    const { classId, dateBS, dateAD, records } = parsed.data;

    // Delete existing daily attendance for this class/date
    await prisma.attendance.deleteMany({
      where: { classId, dateBS, period: null }
    });

    // Insert new records
    if (records.length > 0) {
      await prisma.attendance.createMany({
        data: records.map(r => ({
          studentId: r.studentId,
          schoolId: session.schoolId!,
          classId: classId,
          dateBS: dateBS,
          dateAD: new Date(dateAD),
          status: r.status,
          note: r.note,
          takenById: session.id,
        })),
      });
    }

    return NextResponse.json({ success: true, message: "Attendance saved successfully" });
  } catch (error) {
    console.error("Mobile Attendance POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
