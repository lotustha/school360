import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(request: Request) {
  try {
    const session = getMobileSession(request);
    if (!session || !session.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch classes where the teacher is class teacher OR teaches subjects
    const [classesTaught, subjectsTaught] = await Promise.all([
      prisma.class.findMany({
        where: { classTeacherId: session.id },
        select: { id: true },
      }),
      prisma.subjectTeacher.findMany({
        where: { teacherUserId: session.id },
        select: { subject: { select: { classId: true } } },
      }),
    ]);

    const classIds = [
      ...new Set([
        ...classesTaught.map(c => c.id),
        ...subjectsTaught.map(st => st.subject.classId),
      ])
    ];

    // If teacher has no classes at all, return empty
    if (classIds.length === 0) {
      return NextResponse.json([]);
    }

    const students = await prisma.student.findMany({
      where: {
        schoolId: session.schoolId,
        classId: { in: classIds },
        status: "ACTIVE",
      },
      include: {
        class: true,
        user: true,
      },
      orderBy: [
        { classId: "asc" },
        { rollNumber: "asc" },
      ],
    });

    const formatted = students.map(s => ({
      id: s.id,
      name: s.fullNameNepali || s.user?.fullName || 'Unknown',
      class: s.class.name,
      roll: s.rollNumber || 'N/A',
      avatar: s.user?.avatarUrl,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Mobile Directory Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
