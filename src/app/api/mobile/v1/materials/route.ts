import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || session.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const materials = await prisma.studyMaterial.findMany({
      where: { teacherId: session.id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error("Mobile Materials GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = getMobileSession(req);
    if (!session || session.role !== "TEACHER" || !session.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const classId = formData.get("classId") as string;
    const subjectId = formData.get("subjectId") as string;

    if (!file || !title || !classId || !subjectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Save to local storage (public/uploads)
    const uploadDir = join(process.cwd(), "public", "uploads", "materials");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    
    const fileUrl = `/uploads/materials/${fileName}`;

    const material = await prisma.studyMaterial.create({
      data: {
        title,
        fileUrl,
        classId,
        subjectId,
        schoolId: session.schoolId,
        teacherId: session.id,
      }
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error("Mobile Material Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
