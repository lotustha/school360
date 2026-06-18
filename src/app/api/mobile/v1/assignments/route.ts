import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || session.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignments = await prisma.assignment.findMany({
      // courseId: null → only K-12 assignments; LMS-course assignments are
      // managed in the web LMS module and must not leak into the teacher app.
      where: { teacherId: session.id, courseId: null },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Mobile Assignments GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || session.role !== "TEACHER" || !session.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, dueDate, classId, subjectId } = body;

    if (!title || !dueDate || !classId || !subjectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        classId,
        subjectId,
        schoolId: session.schoolId,
        teacherId: session.id,
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Mobile Assignments POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
