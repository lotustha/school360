"use server"

import { prisma } from "@/lib/prisma"
import { gateLmsPermission } from "@/lib/lms-guard"
import { countPublishedLessons } from "./progress-core"

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export interface CourseAnalytics {
  course: { id: string; title: string }
  totals: {
    enrolled: number
    completed: number
    avgProgress: number
    activeLast7d: number
    totalLessons: number
  }
  progressBuckets: { label: string; count: number }[]
  students: {
    studentId: string
    name: string
    className: string
    progress: number
    lessonsDone: number
    assignmentsSubmitted: number
    avgQuizScore: number | null
    lastAccess: string | null
    completed: boolean
  }[]
  assignments: { id: string; title: string; submitted: number; graded: number; avgMarks: number | null; totalMarks: number }[]
  quizzes: { id: string; title: string; attempts: number; avgScore: number | null; passed: number; totalMarks: number }[]
  liveClasses: { id: string; title: string; attended: number; scheduledAtBS: string }[]
}

export async function getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
  const session = await gateLmsPermission("lms:analytics:view")
  const schoolId = session.user.schoolId!

  const course = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true, title: true } })
  if (!course) throw new Error("Course not found")

  const [enrollments, totalLessons, completionsByStudent, assignments, quizzes, liveClasses] = await Promise.all([
    prisma.lMSEnrollment.findMany({
      where:   { courseId },
      include: { student: { select: { id: true, user: { select: { fullName: true } }, class: { select: { name: true } } } } },
    }),
    countPublishedLessons(courseId),
    prisma.lessonCompletion.groupBy({
      by: ["studentId"],
      where: { lesson: { isPublished: true, module: { courseId, isPublished: true } } },
      _count: { _all: true },
    }),
    prisma.assignment.findMany({
      where:   { courseId, schoolId },
      include: { submissions: { select: { studentId: true, marks: true, status: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.quiz.findMany({
      where:   { courseId, schoolId },
      include: { attempts: { where: { status: { in: ["SUBMITTED", "EXPIRED"] } }, select: { studentId: true, score: true, isPassed: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.liveClass.findMany({
      where:   { courseId, schoolId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { scheduledAt: "desc" },
    }),
  ])

  const lessonsDone = new Map(completionsByStudent.map(c => [c.studentId, c._count._all]))

  // Per-student assignment submission counts.
  const subByStudent = new Map<string, number>()
  for (const a of assignments) for (const s of a.submissions) subByStudent.set(s.studentId, (subByStudent.get(s.studentId) ?? 0) + 1)

  // Per-student average quiz score (best attempt per quiz, averaged).
  const quizBest = new Map<string, Map<string, number>>() // studentId -> quizId -> best score
  for (const q of quizzes) {
    for (const at of q.attempts) {
      if (at.score == null) continue
      const inner = quizBest.get(at.studentId) ?? new Map()
      inner.set(q.id, Math.max(inner.get(q.id) ?? 0, at.score))
      quizBest.set(at.studentId, inner)
    }
  }
  function avgQuiz(studentId: string): number | null {
    const inner = quizBest.get(studentId)
    if (!inner || inner.size === 0) return null
    const vals = [...inner.values()]
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  const now = Date.now()
  const buckets = [
    { label: "Not started", lo: 0, hi: 0, count: 0 },
    { label: "1–25%", lo: 1, hi: 25, count: 0 },
    { label: "26–50%", lo: 26, hi: 50, count: 0 },
    { label: "51–75%", lo: 51, hi: 75, count: 0 },
    { label: "76–99%", lo: 76, hi: 99, count: 0 },
    { label: "Complete", lo: 100, hi: 100, count: 0 },
  ]
  let activeLast7d = 0
  let completed = 0
  let progressSum = 0

  const students = enrollments.map(e => {
    const p = e.progress
    progressSum += p
    if (e.completedAt) completed++
    if (e.lastAccess && now - e.lastAccess.getTime() < SEVEN_DAYS) activeLast7d++
    const b = buckets.find(b => p >= b.lo && p <= b.hi)
    if (b) b.count++
    return {
      studentId:            e.studentId,
      name:                 e.student.user.fullName,
      className:            e.student.class.name,
      progress:             p,
      lessonsDone:          lessonsDone.get(e.studentId) ?? 0,
      assignmentsSubmitted: subByStudent.get(e.studentId) ?? 0,
      avgQuizScore:         avgQuiz(e.studentId),
      lastAccess:           e.lastAccess?.toISOString() ?? null,
      completed:            !!e.completedAt,
    }
  }).sort((a, b) => b.progress - a.progress)

  return {
    course,
    totals: {
      enrolled:     enrollments.length,
      completed,
      avgProgress:  enrollments.length ? Math.round(progressSum / enrollments.length) : 0,
      activeLast7d,
      totalLessons,
    },
    progressBuckets: buckets.map(b => ({ label: b.label, count: b.count })),
    students,
    assignments: assignments.map(a => {
      const graded = a.submissions.filter(s => s.status === "GRADED" || s.status === "RETURNED")
      const marks = graded.map(s => s.marks).filter((m): m is number => m != null)
      return {
        id: a.id, title: a.title,
        submitted: a.submissions.length,
        graded: graded.length,
        avgMarks: marks.length ? Math.round(marks.reduce((x, y) => x + y, 0) / marks.length) : null,
        totalMarks: a.totalMarks,
      }
    }),
    quizzes: quizzes.map(q => {
      const scores = q.attempts.map(a => a.score).filter((s): s is number => s != null)
      return {
        id: q.id, title: q.title,
        attempts: q.attempts.length,
        avgScore: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
        passed: q.attempts.filter(a => a.isPassed).length,
        totalMarks: q.totalMarks,
      }
    }),
    liveClasses: liveClasses.map(lc => ({ id: lc.id, title: lc.title, attended: lc._count.attendances, scheduledAtBS: lc.scheduledAtBS })),
  }
}
