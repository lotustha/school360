"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function listStudentGroups(schoolId: string, opts?: { subjectId?: string }) {
  return prisma.studentGroup.findMany({
    where: {
      schoolId,
      ...(opts?.subjectId && { subjectId: opts.subjectId }),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      _count:  { select: { members: true, routineEntries: true } },
      members: {
        select: {
          student: {
            select: {
              id: true,
              class:   { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  })
}

export async function getStudentGroup(id: string) {
  return prisma.studentGroup.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      members: {
        include: {
          student: {
            include: {
              user:    { select: { fullName: true } },
              class:   { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })
}

export async function createStudentGroup(data: {
  schoolId:    string
  name:        string
  subjectId?:  string
  note?:       string
  studentIds:  string[]
}) {
  if (!data.name.trim()) throw new Error("Group name is required")

  const group = await prisma.studentGroup.create({
    data: {
      schoolId:  data.schoolId,
      name:      data.name.trim(),
      subjectId: data.subjectId ?? null,
      note:      data.note      ?? null,
      members: {
        create: data.studentIds.map(sid => ({ studentId: sid })),
      },
    },
  })
  revalidatePath("/academics/routine/groups")
  return group
}

export async function updateStudentGroup(id: string, data: {
  name?:      string
  subjectId?: string | null
  note?:      string | null
}) {
  await prisma.studentGroup.update({
    where: { id },
    data: {
      ...(data.name      !== undefined && { name:      data.name      }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
      ...(data.note      !== undefined && { note:      data.note      }),
    },
  })
  revalidatePath("/academics/routine/groups")
}

export async function deleteStudentGroup(id: string, opts?: { force?: boolean }) {
  const used = await prisma.routineEntry.count({ where: { studentGroupId: id } })
  if (used > 0 && !opts?.force) {
    throw new Error(`Group is referenced by ${used} routine entr${used === 1 ? "y" : "ies"}. Pass force=true to detach and delete.`)
  }
  await prisma.$transaction([
    prisma.routineEntry.updateMany({ where: { studentGroupId: id }, data: { studentGroupId: null } }),
    prisma.studentGroup.delete({ where: { id } }),
  ])
  revalidatePath("/academics/routine/groups")
}

/** Replace strategy: deletes all current members and re-creates from studentIds. */
export async function setStudentGroupMembers(groupId: string, studentIds: string[]) {
  await prisma.$transaction([
    prisma.studentGroupMember.deleteMany({ where: { groupId } }),
    ...(studentIds.length > 0
      ? [prisma.studentGroupMember.createMany({
          data: studentIds.map(sid => ({ groupId, studentId: sid })),
        })]
      : []),
  ])
  revalidatePath("/academics/routine/groups")
}

export async function addStudentToGroup(args: { groupId: string; studentId: string }) {
  await prisma.studentGroupMember.upsert({
    where:  { groupId_studentId: { groupId: args.groupId, studentId: args.studentId } },
    create: { groupId: args.groupId, studentId: args.studentId },
    update: {},
  })
  revalidatePath("/academics/routine/groups")
}

export async function removeStudentFromGroup(args: { groupId: string; studentId: string }) {
  await prisma.studentGroupMember.delete({
    where: { groupId_studentId: { groupId: args.groupId, studentId: args.studentId } },
  })
  revalidatePath("/academics/routine/groups")
}

/** Helper for the class-routine page: groups containing at least one student
 *  from the given class. Useful to show the right groups in the palette. */
export async function listGroupsForClass(classId: string) {
  return prisma.studentGroup.findMany({
    where: {
      members: { some: { student: { classId } } },
    },
    include: {
      subject: { select: { id: true, name: true } },
      _count:  { select: { members: true } },
    },
    orderBy: { name: "asc" },
  })
}
