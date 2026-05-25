import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || !session.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");

    // If no specific exam/subject requested, return options for the dropdowns
    if (!examId || !subjectId) {
      // Fetch exams for this school (ideally filtered by current academic year, but we'll fetch all active/recent)
      const exams = await prisma.exam.findMany({
        where: { schoolId: session.schoolId },
        select: { id: true, name: true, academicYear: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      // Fetch subjects assigned to this teacher
      const teacherSubjects = await prisma.subjectTeacher.findMany({
        where: { teacherUserId: session.id },
        include: {
          subject: { select: { id: true, name: true, class: { select: { name: true } } } },
        },
      });

      const subjects = teacherSubjects.map(ts => ({
        id: ts.subject.id,
        name: `${ts.subject.name} (${ts.subject.class.name})`,
      }));

      return NextResponse.json({ exams, subjects });
    }

    // If examId and subjectId are provided, fetch students enrolled in the subject's class and their existing scores
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    const students = await prisma.student.findMany({
      where: { classId: subject.classId, status: "ACTIVE" },
      select: {
        id: true,
        rollNumber: true,
        fullNameNepali: true,
        user: { select: { fullName: true, avatarUrl: true } }
      },
      orderBy: { rollNumber: "asc" },
    });

    const scores = await prisma.terminalExamScore.findMany({
      where: { examId, subjectId },
    });

    return NextResponse.json({ students, scores });
  } catch (error) {
    console.error("Mobile Gradebook GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const scoreSchema = z.object({
  examId: z.string(),
  subjectId: z.string(),
  records: z.array(z.object({
    studentId: z.string(),
    rawScore: z.number().nullable(),
    isAbsent: z.boolean(),
  })),
});

export async function POST(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || !session.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = scoreSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid data", details: parsed.error }, { status: 400 });

    const { examId, subjectId, records } = parsed.data;

    // We can't use createMany with upsert, so we use transaction
    const upserts = records.map(r => prisma.terminalExamScore.upsert({
      where: {
        examId_studentId_subjectId: {
          examId,
          studentId: r.studentId,
          subjectId,
        }
      },
      update: {
        rawScore: r.rawScore,
        isAbsent: r.isAbsent,
        enteredById: session.id,
      },
      create: {
        examId,
        studentId: r.studentId,
        subjectId,
        rawScore: r.rawScore,
        isAbsent: r.isAbsent,
        enteredById: session.id,
      }
    }));

    await prisma.$transaction(upserts);

    return NextResponse.json({ success: true, message: "Scores saved successfully" });
  } catch (error) {
    console.error("Mobile Gradebook POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
