"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- Faculties ---

export async function getFaculties(schoolId: string) {
  return await prisma.faculty.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { classes: true } },
    },
  })
}

export async function createFaculty(schoolId: string, name: string) {
  const faculty = await prisma.faculty.create({
    data: { name, schoolId },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/faculties")
  return faculty
}

// --- Classes ---

export async function getClasses(schoolId: string) {
  return await prisma.class.findMany({
    where: { schoolId },
    include: {
      faculty: true,
      _count: { select: { sections: true, subjects: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function createClass(schoolId: string, name: string, facultyId?: string) {
  const newClass = await prisma.class.create({
    data: {
      name,
      schoolId,
      facultyId: facultyId || null,
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/classes")
  return newClass
}

// --- Sections ---

export async function getSections(schoolId: string) {
  return await prisma.section.findMany({
    where: { schoolId },
    include: {
      class: { include: { faculty: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  })
}

export async function createSection(schoolId: string, classId: string, name: string) {
  const section = await prisma.section.create({
    data: { name, classId, schoolId },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/sections")
  return section
}

// --- Subjects ---

export async function getSubjects(schoolId: string) {
  return await prisma.subject.findMany({
    where: { schoolId },
    include: {
      class: true,
      components: true,
    },
    orderBy: { name: "asc" },
  })
}

export async function createSubject(
  schoolId: string,
  classId: string,
  name: string,
  code: string,
  creditHours?: number
) {
  const subject = await prisma.subject.create({
    data: {
      name,
      code,
      classId,
      schoolId,
      creditHours: creditHours || null,
    },
  })
  revalidatePath("/academics")
  revalidatePath("/academics/subjects")
  return subject
}
