import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSession } from "@/lib/mobile-auth";
import { saveUpload, UploadError, DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/storage";

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

    let fileUrl: string;
    try {
      fileUrl = await saveUpload("materials", file, {
        maxBytes: MAX_DOCUMENT_BYTES,
        allowedTypes: DOCUMENT_MIME_TYPES,
      });
    } catch (e) {
      if (e instanceof UploadError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

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
