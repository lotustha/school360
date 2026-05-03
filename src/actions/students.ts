"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { todayBS, currentBSYear } from "@/lib/nepali-date"

const EnrollSchema = z.object({
  fullName:         z.string().min(2),
  email:            z.string().email(),
  password:         z.string().min(6).default("student123"),
  classId:          z.string().min(1),
  sectionId:        z.string().optional(),
  dobBS:            z.string().min(6),
  gender:           z.string().min(1),
  bloodGroup:       z.string().optional(),
  religion:         z.string().optional(),
  caste:            z.string().optional(),
  // Nepal address
  province:         z.string().optional(),
  district:         z.string().optional(),
  municipality:     z.string().optional(),
  wardNo:           z.string().optional(),
  street:           z.string().optional(),
  // Guardian
  guardianName:     z.string().min(2),
  guardianPhone:    z.string().min(7),
  guardianRelation: z.string().min(1),
})

async function nextAdmissionNo(schoolId: string, slug: string): Promise<string> {
  const year = currentBSYear()
  const count = await prisma.student.count({ where: { schoolId } })
  const seq = String(count + 1).padStart(4, "0")
  return `${slug}-${year}-${seq}`
}

export async function enrollStudent(schoolId: string, slug: string, rawData: unknown) {
  const data = EnrollSchema.parse(rawData)

  const exists = await prisma.user.findUnique({ where: { email: data.email } })
  if (exists) return { success: false, error: "Email already in use." }

  const admissionNo = await nextAdmissionNo(schoolId, slug)
  const hashedPw = await bcrypt.hash(data.password, 10)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: data.fullName,
        email:    data.email,
        password: hashedPw,
        role:     "STUDENT",
        schoolId,
      },
    })

    const formattedAddress = [
      data.street,
      data.wardNo && `Ward ${data.wardNo}`,
      data.municipality,
      data.district,
      data.province,
    ].filter(Boolean).join(", ")

    await tx.student.create({
      data: {
        userId:           user.id,
        schoolId,
        admissionNo,
        classId:          data.classId,
        sectionId:        data.sectionId    ?? null,
        dobBS:            data.dobBS,
        gender:           data.gender,
        bloodGroup:       data.bloodGroup   ?? null,
        religion:         data.religion     ?? null,
        caste:            data.caste        ?? null,
        province:         data.province     ?? null,
        district:         data.district     ?? null,
        municipality:     data.municipality ?? null,
        wardNo:           data.wardNo       ?? null,
        street:           data.street       ?? null,
        permanentAddress: formattedAddress  || null,
        guardians: {
          create: {
            name:     data.guardianName,
            phone:    data.guardianPhone,
            relation: data.guardianRelation,
            isPrimary: true,
          },
        },
      },
    })
  })

  revalidatePath("/students")
  return { success: true, admissionNo }
}

export async function getStudents(
  schoolId: string,
  filters?: { classId?: string; sectionId?: string; status?: string; search?: string }
) {
  return prisma.student.findMany({
    where: {
      schoolId,
      ...(filters?.classId   && { classId:   filters.classId }),
      ...(filters?.sectionId && { sectionId: filters.sectionId }),
      ...(filters?.status    && { status:    filters.status }),
      ...(filters?.search    && {
        user: { fullName: { contains: filters.search, mode: "insensitive" } },
      }),
    },
    include: {
      user:    { select: { fullName: true, email: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
      guardians: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: { admissionNo: "asc" },
  })
}

export async function getStudentById(schoolId: string, studentId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      user:      { select: { fullName: true, email: true } },
      class:     true,
      section:   true,
      guardians: true,
      documents: true,
    },
  })
}

export async function updateStudentStatus(
  schoolId: string,
  studentId: string,
  status: string
) {
  await prisma.student.update({
    where: { id: studentId, schoolId },
    data:  { status },
  })
  revalidatePath("/students")
}
