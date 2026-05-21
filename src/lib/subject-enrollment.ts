import { prisma } from "@/lib/prisma"

/**
 * The single source of truth for "is student S enrolled in subject T for year Y".
 *
 *   REGULAR subject       → enrolled iff student is in the subject's class.
 *   OPTIONAL / EXTRA with no SubjectGroup → permissive fallback (same as REGULAR).
 *   OPTIONAL / EXTRA with a group         → enrolled iff SubjectEnrollment row exists.
 *
 * See Optional_Extra_Subjects_Plan.md §4 for the canonical rule.
 */
export async function isStudentEnrolledInSubject(
  studentId:      string,
  subjectId:      string,
  academicYearId: string,
): Promise<boolean> {
  const [subject, student, group] = await Promise.all([
    prisma.subject.findUnique({
      where:  { id: subjectId },
      select: { id: true, type: true, classId: true },
    }),
    prisma.student.findUnique({
      where:  { id: studentId },
      select: { classId: true },
    }),
    prisma.subjectGroupSubject.findUnique({
      where:  { subjectId },
      select: { groupId: true },
    }),
  ])
  if (!subject || !student) return false

  if (subject.type === "REGULAR" || !group) {
    return student.classId === subject.classId
  }

  const enrollment = await prisma.subjectEnrollment.findUnique({
    where: { studentId_subjectId_academicYearId: { studentId, subjectId, academicYearId } },
    select: { id: true },
  })
  return !!enrollment
}

/**
 * Batched version: returns the subset of `studentIds` that are enrolled in
 * `subjectId` for `academicYearId`. More efficient than calling
 * `isStudentEnrolledInSubject` in a loop.
 */
export async function filterEnrolledStudents(
  studentIds:     string[],
  subjectId:      string,
  academicYearId: string,
): Promise<string[]> {
  if (studentIds.length === 0) return []
  const [subject, group] = await Promise.all([
    prisma.subject.findUnique({
      where:  { id: subjectId },
      select: { type: true, classId: true },
    }),
    prisma.subjectGroupSubject.findUnique({
      where:  { subjectId },
      select: { groupId: true },
    }),
  ])
  if (!subject) return []

  if (subject.type === "REGULAR" || !group) {
    // Keep only students currently in the subject's class.
    const students = await prisma.student.findMany({
      where:  { id: { in: studentIds }, classId: subject.classId },
      select: { id: true },
    })
    return students.map(s => s.id)
  }

  const enrollments = await prisma.subjectEnrollment.findMany({
    where:  { studentId: { in: studentIds }, subjectId, academicYearId },
    select: { studentId: true },
  })
  return enrollments.map(e => e.studentId)
}

/**
 * Batched: resolves the enrolled student set for every (subjectId) in the input.
 * For REGULAR or unconfigured non-REGULAR subjects, returns the subject's class
 * roster (active students only). For OPTIONAL/EXTRA with a SubjectGroup, returns
 * the SubjectEnrollment rows for the given year.
 *
 * Returns a Map keyed by subjectId; missing keys mean "no eligible students".
 * Use this in report paths to avoid N+1 enrollment queries.
 */
export async function buildEnrollmentMap(
  subjectIds:     string[],
  academicYearId: string,
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  if (subjectIds.length === 0) return out

  const [subjects, groupLinks] = await Promise.all([
    prisma.subject.findMany({
      where:  { id: { in: subjectIds } },
      select: { id: true, type: true, classId: true },
    }),
    prisma.subjectGroupSubject.findMany({
      where:  { subjectId: { in: subjectIds } },
      select: { subjectId: true },
    }),
  ])
  const groupedSet = new Set(groupLinks.map(g => g.subjectId))

  // Bucket 1: non-grouped (REGULAR or unconfigured) → use class roster.
  const ungroupedSubjects = subjects.filter(s => s.type === "REGULAR" || !groupedSet.has(s.id))
  const classIds = [...new Set(ungroupedSubjects.map(s => s.classId))]
  const rosters = classIds.length === 0 ? [] : await prisma.student.findMany({
    where:  { classId: { in: classIds }, status: "ACTIVE" },
    select: { id: true, classId: true },
  })
  const rosterByClass = new Map<string, string[]>()
  for (const r of rosters) {
    if (!rosterByClass.has(r.classId)) rosterByClass.set(r.classId, [])
    rosterByClass.get(r.classId)!.push(r.id)
  }
  for (const s of ungroupedSubjects) {
    out.set(s.id, new Set(rosterByClass.get(s.classId) ?? []))
  }

  // Bucket 2: grouped → use SubjectEnrollment for the year.
  const groupedSubjectIds = subjects.filter(s => groupedSet.has(s.id)).map(s => s.id)
  if (groupedSubjectIds.length > 0) {
    const enrollments = await prisma.subjectEnrollment.findMany({
      where:  { subjectId: { in: groupedSubjectIds }, academicYearId },
      select: { subjectId: true, studentId: true },
    })
    for (const sid of groupedSubjectIds) out.set(sid, new Set())
    for (const e of enrollments) {
      out.get(e.subjectId)!.add(e.studentId)
    }
  }

  return out
}

/**
 * Returns every student enrolled in `subjectId` for `academicYearId` (rolling up
 * the rule above into one server call). For REGULAR (or unconfigured non-REGULAR)
 * subjects this returns every ACTIVE student in the subject's class.
 */
export async function listEnrolledStudentIds(
  subjectId:      string,
  academicYearId: string,
): Promise<string[]> {
  const [subject, group] = await Promise.all([
    prisma.subject.findUnique({
      where:  { id: subjectId },
      select: { type: true, classId: true },
    }),
    prisma.subjectGroupSubject.findUnique({
      where:  { subjectId },
      select: { groupId: true },
    }),
  ])
  if (!subject) return []

  if (subject.type === "REGULAR" || !group) {
    const students = await prisma.student.findMany({
      where:  { classId: subject.classId, status: "ACTIVE" },
      select: { id: true },
    })
    return students.map(s => s.id)
  }

  const enrollments = await prisma.subjectEnrollment.findMany({
    where:  { subjectId, academicYearId },
    select: { studentId: true },
  })
  return enrollments.map(e => e.studentId)
}
