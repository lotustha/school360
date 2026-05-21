"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { SubjectGroupKind } from "../../generated/prisma/client"

// ──────────────────────────────────────────────────────────────────────────────
// Routine-mirror sync
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Keep a StudentGroup row in sync with one (SubjectGroup, subject, academicYear)
 * enrollment cohort, so the daily-routine grid can split a cell by enrolled
 * students without admins re-picking them.
 *
 * Idempotent. Safe to call after any enrollment mutation. If the enrollment
 * cohort is empty, the mirror StudentGroup is deleted (along with any
 * RoutineEntry references via FK cascade reset).
 */
async function syncRoutineMirror(
  groupId:        string,
  subjectId:      string,
  academicYearId: string,
): Promise<void> {
  const [group, subject, enrollments] = await Promise.all([
    prisma.subjectGroup.findUnique({
      where:  { id: groupId },
      select: { id: true, label: true, schoolId: true },
    }),
    prisma.subject.findUnique({
      where:  { id: subjectId },
      select: { name: true },
    }),
    prisma.subjectEnrollment.findMany({
      where:  { groupId, subjectId, academicYearId },
      select: { studentId: true },
    }),
  ])
  if (!group || !subject) return

  const mirrorName = `${group.label} — ${subject.name}`
  const findKey = {
    sourceEnrollmentGroupId_subjectId_sourceAcademicYearId: {
      sourceEnrollmentGroupId: groupId,
      subjectId,
      sourceAcademicYearId:    academicYearId,
    },
  }

  if (enrollments.length === 0) {
    // Detach routine entries pointing at the mirror, then drop it.
    const existing = await prisma.studentGroup.findUnique({ where: findKey, select: { id: true } })
    if (existing) {
      await prisma.$transaction([
        prisma.routineEntry.updateMany({
          where: { studentGroupId: existing.id }, data: { studentGroupId: null },
        }),
        prisma.studentGroup.delete({ where: { id: existing.id } }),
      ])
    }
    return
  }

  const mirror = await prisma.studentGroup.upsert({
    where:  findKey,
    update: { name: mirrorName, subjectId },
    create: {
      schoolId:                group.schoolId,
      name:                    mirrorName,
      subjectId,
      sourceEnrollmentGroupId: groupId,
      sourceAcademicYearId:    academicYearId,
    },
  })

  // Replace members atomically.
  await prisma.$transaction([
    prisma.studentGroupMember.deleteMany({ where: { groupId: mirror.id } }),
    prisma.studentGroupMember.createMany({
      data: enrollments.map(e => ({ groupId: mirror.id, studentId: e.studentId })),
    }),
  ])
  revalidatePath("/academics/routine")
}

/**
 * Sync all subjects in a group for one year — used by bulk operations that
 * touch every subject (e.g. carryEnrollmentsFromPreviousYear).
 */
async function syncAllSubjectsInGroup(groupId: string, academicYearId: string): Promise<void> {
  const group = await prisma.subjectGroup.findUnique({
    where:   { id: groupId },
    include: { subjects: { select: { subjectId: true } } },
  })
  if (!group) return
  for (const s of group.subjects) {
    await syncRoutineMirror(groupId, s.subjectId, academicYearId)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateGroupArgs {
  label:         string
  kind:          SubjectGroupKind
  pickCount?:    number              // default 1; only meaningful for OPTIONAL_PICK
  subjectIds:    string[]
  sourceGroupId?: string | null      // grade-predecessor group for cross-grade carry
}

export interface UpdateGroupArgs {
  label?:        string
  pickCount?:    number
  subjectIds?:   string[]            // when present, replaces the membership set
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────────────────────────────────────

async function loadSubjectsOrThrow(
  schoolId:   string,
  classId:    string,
  subjectIds: string[],
) {
  if (subjectIds.length === 0) throw new Error("At least one subject is required")
  const subjects = await prisma.subject.findMany({
    where:  { id: { in: subjectIds }, schoolId, classId },
    select: { id: true, type: true, name: true },
  })
  if (subjects.length !== subjectIds.length) {
    throw new Error("One or more subjects don't belong to this school/class")
  }
  return subjects
}

function validateGroupShape(
  kind: SubjectGroupKind,
  pickCount: number,
  subjects: { type: string }[],
) {
  if (kind === "OPTIONAL_PICK") {
    if (subjects.length < 2) {
      throw new Error("Optional groups need at least 2 subjects")
    }
    if (pickCount < 1 || pickCount >= subjects.length) {
      throw new Error(`pickCount must be between 1 and ${subjects.length - 1}`)
    }
  } else {
    if (subjects.length !== 1) {
      throw new Error("Extra-cohort groups must have exactly one subject")
    }
    if (subjects[0].type !== "EXTRA") {
      throw new Error("Extra-cohort groups can only hold an EXTRA-type subject")
    }
  }
}

async function ensureSubjectsUngrouped(
  subjectIds:    string[],
  excludeGroupId?: string,
) {
  const existing = await prisma.subjectGroupSubject.findMany({
    where:  {
      subjectId: { in: subjectIds },
      ...(excludeGroupId ? { groupId: { not: excludeGroupId } } : {}),
    },
    select: { subjectId: true, groupId: true },
  })
  if (existing.length > 0) {
    throw new Error(
      `Subject(s) already belong to another group: ${existing.map(e => e.subjectId).join(", ")}`,
    )
  }
}

async function loadGroupOrThrow(groupId: string) {
  const group = await prisma.subjectGroup.findUnique({
    where:   { id: groupId },
    include: { subjects: { select: { subjectId: true } } },
  })
  if (!group) throw new Error("Group not found")
  return group
}

// ──────────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listSubjectGroups(classId: string) {
  return await prisma.subjectGroup.findMany({
    where:   { classId },
    include: {
      subjects: {
        include: { subject: { select: { id: true, name: true, code: true, type: true } } },
      },
      _count:   { select: { enrollments: true } },
    },
    orderBy: [{ kind: "asc" }, { label: "asc" }],
  })
}

export async function listGroupEnrollments(groupId: string, academicYearId: string) {
  const group = await loadGroupOrThrow(groupId)
  const [enrollments, classStudents] = await Promise.all([
    prisma.subjectEnrollment.findMany({
      where:  { groupId, academicYearId },
      select: { studentId: true, subjectId: true },
    }),
    prisma.student.findMany({
      where:  { classId: group.classId, academicYearId, status: "ACTIVE" },
      select: {
        id:          true,
        rollNumber:  true,
        admissionNo: true,
        user:        { select: { fullName: true, avatarUrl: true } },
      },
      orderBy: [{ rollNumber: "asc" }, { admissionNo: "asc" }],
    }),
  ])
  return { enrollments, classStudents }
}

export async function createSubjectGroup(
  schoolId: string,
  classId:  string,
  args:     CreateGroupArgs,
) {
  const pickCount = args.pickCount ?? 1
  const subjects  = await loadSubjectsOrThrow(schoolId, classId, args.subjectIds)
  validateGroupShape(args.kind, pickCount, subjects)
  await ensureSubjectsUngrouped(args.subjectIds)

  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } })
  if (!cls) throw new Error("Class not found in this school")

  const group = await prisma.$transaction(async tx => {
    const g = await tx.subjectGroup.create({
      data: {
        schoolId,
        classId,
        label:         args.label.trim(),
        kind:          args.kind,
        pickCount,
        sourceGroupId: args.sourceGroupId ?? null,
      },
    })
    await tx.subjectGroupSubject.createMany({
      data: args.subjectIds.map(subjectId => ({ groupId: g.id, subjectId })),
    })
    return g
  })

  revalidatePath("/academics/subjects")
  return group
}

export async function updateSubjectGroup(groupId: string, args: UpdateGroupArgs) {
  const group = await loadGroupOrThrow(groupId)

  // If subjects are being replaced, revalidate shape against new set
  let nextSubjectIds: string[] | null = null
  if (args.subjectIds) {
    const subjects = await loadSubjectsOrThrow(group.schoolId, group.classId, args.subjectIds)
    const pickCount = args.pickCount ?? group.pickCount
    validateGroupShape(group.kind, pickCount, subjects)
    await ensureSubjectsUngrouped(args.subjectIds, groupId)
    nextSubjectIds = args.subjectIds
  } else if (args.pickCount !== undefined) {
    // pickCount changed; validate against current subjects
    const subjects = await prisma.subject.findMany({
      where:  { id: { in: group.subjects.map(s => s.subjectId) } },
      select: { type: true },
    })
    validateGroupShape(group.kind, args.pickCount, subjects)
  }

  await prisma.$transaction(async tx => {
    await tx.subjectGroup.update({
      where: { id: groupId },
      data:  {
        ...(args.label     !== undefined && { label: args.label.trim() }),
        ...(args.pickCount !== undefined && { pickCount: args.pickCount }),
      },
    })

    if (nextSubjectIds) {
      const current = new Set(group.subjects.map(s => s.subjectId))
      const next    = new Set(nextSubjectIds)
      const toRemove = [...current].filter(id => !next.has(id))
      const toAdd    = [...next].filter(id => !current.has(id))

      if (toRemove.length > 0) {
        // Cascading enrollment cleanup for removed subjects.
        await tx.subjectEnrollment.deleteMany({
          where: { groupId, subjectId: { in: toRemove } },
        })
        await tx.subjectGroupSubject.deleteMany({
          where: { groupId, subjectId: { in: toRemove } },
        })
      }
      if (toAdd.length > 0) {
        await tx.subjectGroupSubject.createMany({
          data: toAdd.map(subjectId => ({ groupId, subjectId })),
        })
      }
    }
  })

  revalidatePath("/academics/subjects")
}

export async function deleteSubjectGroup(groupId: string) {
  // Enrollments and SubjectGroupSubject rows cascade-delete via FK.
  await prisma.subjectGroup.delete({ where: { id: groupId } })
  revalidatePath("/academics/subjects")
}

// ──────────────────────────────────────────────────────────────────────────────
// Enrollment
// ──────────────────────────────────────────────────────────────────────────────

async function ensureStudentInClass(
  studentId:      string,
  classId:        string,
  academicYearId: string,
) {
  const stu = await prisma.student.findFirst({
    where:  { id: studentId, classId, academicYearId },
    select: { id: true },
  })
  if (!stu) {
    throw new Error("Student is not in this class for the selected year")
  }
}

async function ensureSubjectInGroup(groupId: string, subjectId: string) {
  const row = await prisma.subjectGroupSubject.findUnique({
    where:  { groupId_subjectId: { groupId, subjectId } },
    select: { groupId: true },
  })
  if (!row) throw new Error("Subject doesn't belong to this group")
}

async function ensurePickCapacity(
  group:          { id: string; kind: SubjectGroupKind; pickCount: number },
  studentId:      string,
  academicYearId: string,
  excludeSubjectId?: string,
) {
  if (group.kind !== "OPTIONAL_PICK") return
  const count = await prisma.subjectEnrollment.count({
    where: {
      groupId:        group.id,
      academicYearId,
      studentId,
      ...(excludeSubjectId ? { subjectId: { not: excludeSubjectId } } : {}),
    },
  })
  if (count >= group.pickCount) {
    throw new Error(`Student already has ${count} pick(s) in this group (cap is ${group.pickCount})`)
  }
}

export async function enrollStudent(
  groupId:        string,
  academicYearId: string,
  studentId:      string,
  subjectId:      string,
) {
  const group = await loadGroupOrThrow(groupId)
  await ensureSubjectInGroup(groupId, subjectId)
  await ensureStudentInClass(studentId, group.classId, academicYearId)
  await ensurePickCapacity(group, studentId, academicYearId, subjectId)

  await prisma.subjectEnrollment.upsert({
    where:  { studentId_subjectId_academicYearId: { studentId, subjectId, academicYearId } },
    update: {},
    create: { studentId, subjectId, academicYearId, groupId },
  })
  await syncRoutineMirror(groupId, subjectId, academicYearId)
  revalidatePath("/academics/subjects")
}

export async function unenrollStudent(
  groupId:        string,
  academicYearId: string,
  studentId:      string,
  subjectId:      string,
) {
  await prisma.subjectEnrollment.deleteMany({
    where: { groupId, academicYearId, studentId, subjectId },
  })
  await syncRoutineMirror(groupId, subjectId, academicYearId)
  revalidatePath("/academics/subjects")
}

export async function bulkEnroll(
  groupId:        string,
  academicYearId: string,
  studentIds:     string[],
  subjectId:      string,
) {
  if (studentIds.length === 0) return { added: 0 }
  const group = await loadGroupOrThrow(groupId)
  await ensureSubjectInGroup(groupId, subjectId)

  // Filter to students actually in this class for this year.
  const valid = await prisma.student.findMany({
    where:  { id: { in: studentIds }, classId: group.classId, academicYearId },
    select: { id: true },
  })
  const validIds = valid.map(s => s.id)

  // For OPTIONAL_PICK, drop students who'd exceed the cap.
  let toEnroll = validIds
  if (group.kind === "OPTIONAL_PICK") {
    const existing = await prisma.subjectEnrollment.groupBy({
      by:    ["studentId"],
      where: {
        groupId,
        academicYearId,
        studentId: { in: validIds },
        subjectId: { not: subjectId },
      },
      _count: { studentId: true },
    })
    const overCapIds = new Set(
      existing.filter(g => g._count.studentId >= group.pickCount).map(g => g.studentId),
    )
    toEnroll = validIds.filter(id => !overCapIds.has(id))
  }

  if (toEnroll.length === 0) return { added: 0 }

  const result = await prisma.subjectEnrollment.createMany({
    data: toEnroll.map(studentId => ({ groupId, academicYearId, studentId, subjectId })),
    skipDuplicates: true,
  })
  await syncRoutineMirror(groupId, subjectId, academicYearId)
  revalidatePath("/academics/subjects")
  return { added: result.count }
}

/**
 * Enroll every student currently in the group's class (and year) who has NO
 * enrollment yet in this group into `subjectId`. Skips students already at pick cap.
 */
export async function fillRemaining(
  groupId:        string,
  academicYearId: string,
  subjectId:      string,
) {
  const group = await loadGroupOrThrow(groupId)
  await ensureSubjectInGroup(groupId, subjectId)

  const [classStudents, alreadyEnrolled] = await Promise.all([
    prisma.student.findMany({
      where:  { classId: group.classId, academicYearId, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.subjectEnrollment.findMany({
      where:  { groupId, academicYearId },
      select: { studentId: true },
    }),
  ])

  // For OPTIONAL_PICK with pickCount > 1, "remaining" means students with no
  // enrollment in this group at all (the common case). pickCount = 1 makes this
  // equivalent.
  const enrolledIds = new Set(alreadyEnrolled.map(e => e.studentId))
  const targetIds   = classStudents.map(s => s.id).filter(id => !enrolledIds.has(id))

  if (targetIds.length === 0) return { added: 0 }

  const result = await prisma.subjectEnrollment.createMany({
    data: targetIds.map(studentId => ({ groupId, academicYearId, studentId, subjectId })),
    skipDuplicates: true,
  })
  await syncRoutineMirror(groupId, subjectId, academicYearId)
  revalidatePath("/academics/subjects")
  return { added: result.count }
}

// ──────────────────────────────────────────────────────────────────────────────
// Year-carry
// ──────────────────────────────────────────────────────────────────────────────

async function assertYearOrder(sourceYearId: string, targetYearId: string) {
  const [src, tgt] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: sourceYearId }, select: { startDateBS: true } }),
    prisma.academicYear.findUnique({ where: { id: targetYearId }, select: { startDateBS: true } }),
  ])
  if (!src || !tgt) throw new Error("Academic year not found")
  if (src.startDateBS >= tgt.startDateBS) {
    throw new Error("Source year must precede the target year")
  }
}

async function filterByPassed(
  sourceYearId: string,
  studentSubjectPairs: { studentId: string; subjectId: string }[],
) {
  if (studentSubjectPairs.length === 0) return studentSubjectPairs
  // A student "passed" a subject in the source year if any SubjectEvaluationResult
  // for that (student, subject) inside an Evaluation of the source year has status
  // != FAIL/ABSENT/INCOMPLETE.
  const studentIds = [...new Set(studentSubjectPairs.map(p => p.studentId))]
  const subjectIds = [...new Set(studentSubjectPairs.map(p => p.subjectId))]
  const results = await prisma.subjectEvaluationResult.findMany({
    where: {
      studentId:         { in: studentIds },
      subjectEvaluation: { subjectId: { in: subjectIds }, evaluation: { academicYearId: sourceYearId } },
    },
    select: {
      studentId:         true,
      status:            true,
      subjectEvaluation: { select: { subjectId: true } },
    },
  })
  const passed = new Set<string>()
  for (const r of results) {
    if (r.status === "PASS") passed.add(`${r.studentId}::${r.subjectEvaluation.subjectId}`)
  }
  return studentSubjectPairs.filter(p => passed.has(`${p.studentId}::${p.subjectId}`))
}


/**
 * Cross-grade promotion: copy from a source group (Class 9) into a target group
 * (Class 10) for the target year. Only includes students whose current
 * `classId` matches the target group's class — i.e. who got promoted.
 *
 * Subject identity is preserved by name (case-insensitive) — Class 10's
 * "Computer" inherits cohort from Class 9's "Computer" group. If no
 * same-named subject exists in the target group, those source enrollments
 * are dropped silently.
 */
export async function promoteCohortFromGradePredecessor(
  targetGroupId:        string,
  sourceGroupId:        string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
  opts: { passedOnly?: boolean } = {},
) {
  if (sourceGroupId === targetGroupId) throw new Error("Source and target groups must differ")
  await assertYearOrder(sourceAcademicYearId, targetAcademicYearId)

  const [target, source] = await Promise.all([
    prisma.subjectGroup.findUnique({
      where:   { id: targetGroupId },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } } },
      },
    }),
    prisma.subjectGroup.findUnique({
      where:   { id: sourceGroupId },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } } },
      },
    }),
  ])
  if (!target || !source) throw new Error("Group not found")

  // Map source subject ID → target subject ID by name.
  const targetByName = new Map<string, string>()
  for (const s of target.subjects) {
    targetByName.set(s.subject.name.toLowerCase(), s.subject.id)
  }
  const subjectIdMap = new Map<string, string>() // sourceSubjectId → targetSubjectId
  for (const s of source.subjects) {
    const tgtId = targetByName.get(s.subject.name.toLowerCase())
    if (tgtId) subjectIdMap.set(s.subject.id, tgtId)
  }
  if (subjectIdMap.size === 0) return { added: 0 }

  const sourceEnrollments = await prisma.subjectEnrollment.findMany({
    where:  { groupId: sourceGroupId, academicYearId: sourceAcademicYearId },
    select: { studentId: true, subjectId: true },
  })

  // Students who are now in the target class.
  const studentIds = sourceEnrollments.map(e => e.studentId)
  const promoted = await prisma.student.findMany({
    where:  { id: { in: studentIds }, classId: target.classId, academicYearId: targetAcademicYearId },
    select: { id: true },
  })
  const promotedIds = new Set(promoted.map(s => s.id))

  let pairs = sourceEnrollments
    .filter(e => promotedIds.has(e.studentId) && subjectIdMap.has(e.subjectId))
    .map(e => ({ studentId: e.studentId, subjectId: subjectIdMap.get(e.subjectId)! }))

  if (opts.passedOnly) {
    // Pass check is against the SOURCE subject (the one they actually sat).
    const passedPairs = await filterByPassed(
      sourceAcademicYearId,
      sourceEnrollments
        .filter(e => promotedIds.has(e.studentId) && subjectIdMap.has(e.subjectId))
        .map(e => ({ studentId: e.studentId, subjectId: e.subjectId })),
    )
    const allowed = new Set(passedPairs.map(p => `${p.studentId}::${p.subjectId}`))
    pairs = sourceEnrollments
      .filter(e => allowed.has(`${e.studentId}::${e.subjectId}`))
      .map(e => ({ studentId: e.studentId, subjectId: subjectIdMap.get(e.subjectId)! }))
  }

  if (pairs.length === 0) return { added: 0 }

  const result = await prisma.subjectEnrollment.createMany({
    data: pairs.map(p => ({
      groupId:        targetGroupId,
      academicYearId: targetAcademicYearId,
      studentId:      p.studentId,
      subjectId:      p.subjectId,
    })),
    skipDuplicates: true,
  })
  await syncAllSubjectsInGroup(targetGroupId, targetAcademicYearId)
  revalidatePath("/academics/subjects")
  return { added: result.count }
}
