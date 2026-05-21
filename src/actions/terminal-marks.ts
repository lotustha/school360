"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { filterEnrolledStudents, isStudentEnrolledInSubject } from "@/lib/subject-enrollment"

async function resolveExamYear(examId: string): Promise<string> {
  const exam = await prisma.exam.findUnique({
    where:  { id: examId },
    select: { academicYearId: true },
  })
  if (!exam) throw new Error("Exam not found")
  return exam.academicYearId
}

/**
 * Read raw Terminal Exam scores for one (exam × subject), optionally filtered
 * to a single class. Returns a map keyed by Student.id → { rawScore, isAbsent }.
 *
 * `classId` is optional — pass it (or empty) to fetch every student that has a
 * score, regardless of class. The marks grid keys lookups by student.id so an
 * over-broad fetch is fine (only the students the caller renders will be read).
 */
export async function getTerminalExamScores(args: {
  examId:     string
  classId?:   string         // optional; empty/missing = no class filter
  subjectId:  string
}): Promise<Record<string, { rawScore: number | null; isAbsent: boolean }>> {
  const cid = args.classId?.trim() || null
  const rows = await prisma.terminalExamScore.findMany({
    where: {
      examId:    args.examId,
      subjectId: args.subjectId,
      ...(cid ? { student: { classId: cid } } : {}),
    },
    select: { studentId: true, rawScore: true, isAbsent: true },
  })

  const map: Record<string, { rawScore: number | null; isAbsent: boolean }> = {}
  for (const r of rows) {
    map[r.studentId] = { rawScore: r.rawScore, isAbsent: r.isAbsent }
  }
  return map
}

/**
 * Upsert one Terminal Exam raw score. Same raw value is read by every DERIVED
 * EvaluationComponent that references this exam — so entering once propagates
 * to every Evaluation that uses this terminal exam.
 */
async function resolveEnteredById(enteredById: string): Promise<string> {
  if (enteredById) {
    const u = await prisma.user.findUnique({ where: { id: enteredById }, select: { id: true } })
    if (u) return u.id
  }
  // Stale session (DB was reset, JWT still has old User.id) — fall back to any
  // school admin so saves don't FK-violate. The user should re-authenticate.
  const fallback = await prisma.user.findFirst({
    where:  { role: { in: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  if (!fallback) {
    throw new Error("Session expired and no admin user available — please log out and back in.")
  }
  return fallback.id
}

export async function saveTerminalExamScore(args: {
  examId:      string
  studentId:   string    // Student.id
  subjectId:   string
  rawScore:    number | null
  isAbsent:    boolean
  enteredById: string    // User.id
}) {
  const academicYearId = await resolveExamYear(args.examId)
  const enrolled = await isStudentEnrolledInSubject(args.studentId, args.subjectId, academicYearId)
  if (!enrolled) {
    throw new Error("Student is not enrolled in this subject for the exam's academic year")
  }
  const enteredBy = await resolveEnteredById(args.enteredById)
  await prisma.terminalExamScore.upsert({
    where: {
      examId_studentId_subjectId: {
        examId:    args.examId,
        studentId: args.studentId,
        subjectId: args.subjectId,
      },
    },
    create: {
      examId:      args.examId,
      studentId:   args.studentId,
      subjectId:   args.subjectId,
      rawScore:    args.rawScore,
      isAbsent:    args.isAbsent,
      enteredById: enteredBy,
    },
    update: {
      rawScore:    args.rawScore,
      isAbsent:    args.isAbsent,
      enteredById: enteredBy,
    },
  })
  revalidatePath("/academics/evaluations")
}

/**
 * Bulk save terminal exam scores in one transaction.
 * Useful for saving an entire class's marks at once.
 */
export async function saveTerminalExamScoresBulk(args: {
  examId:      string
  subjectId:   string
  enteredById: string
  records: {
    studentId: string         // Student.id
    rawScore:  number | null
    isAbsent:  boolean
  }[]
}) {
  if (args.records.length === 0) return { saved: 0, skipped: 0 }

  // Filter out unenrolled students up-front. Caller decides whether the skipped
  // count is a hard error or a soft notice (typically a UI warning).
  const academicYearId = await resolveExamYear(args.examId)
  const enrolledIds = new Set(
    await filterEnrolledStudents(
      args.records.map(r => r.studentId),
      args.subjectId,
      academicYearId,
    ),
  )
  const accepted = args.records.filter(r => enrolledIds.has(r.studentId))
  const skipped  = args.records.length - accepted.length

  if (accepted.length === 0) {
    return { saved: 0, skipped }
  }

  const enteredBy = await resolveEnteredById(args.enteredById)
  await prisma.$transaction(
    accepted.map(r =>
      prisma.terminalExamScore.upsert({
        where: {
          examId_studentId_subjectId: {
            examId:    args.examId,
            studentId: r.studentId,
            subjectId: args.subjectId,
          },
        },
        create: {
          examId:      args.examId,
          studentId:   r.studentId,
          subjectId:   args.subjectId,
          rawScore:    r.rawScore,
          isAbsent:    r.isAbsent,
          enteredById: enteredBy,
        },
        update: {
          rawScore:    r.rawScore,
          isAbsent:    r.isAbsent,
          enteredById: enteredBy,
        },
      })
    )
  )
  revalidatePath("/academics/evaluations")
  return { saved: accepted.length, skipped }
}
