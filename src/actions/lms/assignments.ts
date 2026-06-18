"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsRead, gateLmsPermission, gateLmsLearner } from "@/lib/lms-guard"
import { toBS, formatBS } from "@/lib/nepali-date"

export type SubmissionStatus = "SUBMITTED" | "GRADED" | "RETURNED" | "RESUBMIT"

interface FileRef { name: string; url: string; size?: number }

function safeBS(date: Date | null): string | null {
  if (!date) return null
  try { return formatBS(toBS(date)) } catch { return null }
}

function asFileRefs(v: unknown): FileRef[] {
  if (!Array.isArray(v)) return []
  return v.filter((f): f is FileRef => !!f && typeof (f as FileRef).url === "string")
}

// ─── Reads (manage side) ──────────────────────────────────────────────────────

export interface AssignmentRow {
  id: string
  title: string
  description: string | null
  dueDate: string
  dueDateBS: string | null
  totalMarks: number
  passMarks: number
  allowLate: boolean
  latePenaltyPct: number
  subjectName: string
  submissionCount: number
  gradedCount: number
  enrolledCount: number
}

export async function listCourseAssignments(courseId: string): Promise<AssignmentRow[]> {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!

  const course = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!course) throw new Error("Course not found")

  const [assignments, enrolledCount] = await Promise.all([
    prisma.assignment.findMany({
      where: { courseId, schoolId },
      include: {
        subject: { select: { name: true } },
        _count:  { select: { submissions: true } },
        submissions: { where: { status: { in: ["GRADED", "RETURNED"] } }, select: { id: true } },
      },
      orderBy: { dueDate: "desc" },
    }),
    prisma.lMSEnrollment.count({ where: { courseId } }),
  ])

  return assignments.map(a => ({
    id:              a.id,
    title:           a.title,
    description:     a.description,
    dueDate:         a.dueDate.toISOString(),
    dueDateBS:       a.dueDateBS ?? safeBS(a.dueDate),
    totalMarks:      a.totalMarks,
    passMarks:       a.passMarks,
    allowLate:       a.allowLate,
    latePenaltyPct:  a.latePenaltyPct,
    subjectName:     a.subject.name,
    submissionCount: a._count.submissions,
    gradedCount:     a.submissions.length,
    enrolledCount,
  }))
}

/** Assignment + every enrolled student with their submission (for grading). */
export async function getAssignmentForGrading(assignmentId: string) {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!

  const assignment = await prisma.assignment.findFirst({
    where:   { id: assignmentId, schoolId },
    include: { subject: { select: { name: true } }, course: { select: { id: true, title: true } } },
  })
  if (!assignment || !assignment.courseId) throw new Error("Assignment not found")

  const enrollments = await prisma.lMSEnrollment.findMany({
    where: { courseId: assignment.courseId },
    include: {
      student: {
        select: {
          id: true, rollNumber: true,
          user:    { select: { fullName: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: [{ student: { class: { name: "asc" } } }, { student: { rollNumber: "asc" } }],
  })

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
  })
  const subByStudent = new Map(submissions.map(s => [s.studentId, s]))

  const rows = enrollments.map(e => {
    const sub = subByStudent.get(e.studentId)
    return {
      studentId:   e.studentId,
      name:        e.student.user.fullName,
      rollNumber:  e.student.rollNumber,
      className:   e.student.class.name,
      sectionName: e.student.section?.name ?? null,
      submission: sub ? {
        id:          sub.id,
        submittedAt: sub.submittedAt.toISOString(),
        isLate:      sub.isLate,
        status:      sub.status as SubmissionStatus,
        marks:       sub.marks,
        feedback:    sub.feedback,
        note:        sub.note,
        files:       asFileRefs(sub.fileUrls),
        gradedAt:    sub.gradedAt?.toISOString() ?? null,
      } : null,
    }
  })

  return {
    assignment: {
      id:             assignment.id,
      title:          assignment.title,
      description:    assignment.description,
      dueDate:        assignment.dueDate.toISOString(),
      dueDateBS:      assignment.dueDateBS ?? safeBS(assignment.dueDate),
      totalMarks:     assignment.totalMarks,
      passMarks:      assignment.passMarks,
      allowLate:      assignment.allowLate,
      latePenaltyPct: assignment.latePenaltyPct,
      subjectName:    assignment.subject.name,
      courseId:       assignment.courseId,
      courseTitle:    assignment.course?.title ?? "",
      attachments:    asFileRefs(assignment.attachments),
    },
    rows,
  }
}

// ─── Writes (manage) ──────────────────────────────────────────────────────────

const fileRefSchema = z.object({
  name: z.string().min(1).max(300),
  url:  z.string().url().max(1000),
  size: z.number().int().nonnegative().optional(),
})

const createSchema = z.object({
  courseId:       z.string().min(1),
  subjectId:      z.string().min(1, "Pick a subject"),
  title:          z.string().min(1, "Title is required").max(200),
  description:    z.string().max(5000).nullable().optional(),
  dueDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
  totalMarks:     z.number().positive().max(1000).default(100),
  passMarks:      z.number().nonnegative().max(1000).default(40),
  allowLate:      z.boolean().default(false),
  latePenaltyPct: z.number().min(0).max(100).default(0),
  attachments:    z.array(fileRefSchema).default([]),
})

const updateSchema = createSchema.partial().omit({ courseId: true }).extend({ id: z.string().min(1) })

function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59`)
  if (isNaN(d.getTime())) throw new Error("Invalid due date")
  return d
}

export async function createAssignment(input: z.infer<typeof createSchema>) {
  const session = await gateLmsPermission("lms:assignments:manage")
  const data = createSchema.parse(input)
  const schoolId = session.user.schoolId!

  const course = await prisma.lMSCourse.findFirst({
    where: { id: data.courseId, schoolId }, select: { id: true, instructorId: true },
  })
  if (!course) throw new Error("Course not found")

  // Assignment requires class + subject; derive class from the chosen subject.
  const subject = await prisma.subject.findFirst({
    where: { id: data.subjectId, schoolId }, select: { id: true, classId: true },
  })
  if (!subject) throw new Error("Subject not found")

  if (data.passMarks > data.totalMarks) throw new Error("Pass marks cannot exceed total marks")

  const due = endOfDay(data.dueDate)
  const assignment = await prisma.assignment.create({
    data: {
      schoolId,
      courseId:       data.courseId,
      classId:        subject.classId,
      subjectId:      subject.id,
      teacherId:      course.instructorId,
      title:          data.title.trim(),
      description:    data.description?.trim() || null,
      dueDate:        due,
      dueDateBS:      safeBS(due),
      totalMarks:     data.totalMarks,
      passMarks:      data.passMarks,
      allowLate:      data.allowLate,
      latePenaltyPct: data.latePenaltyPct,
      attachments:    data.attachments.length ? data.attachments : undefined,
    },
  })

  revalidatePath(`/lms/courses/${data.courseId}/assignments`)
  return { id: assignment.id }
}

export async function updateAssignment(input: z.infer<typeof updateSchema>) {
  const session = await gateLmsPermission("lms:assignments:manage")
  const data = updateSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.assignment.findFirst({
    where: { id: data.id, schoolId }, select: { id: true, courseId: true, totalMarks: true },
  })
  if (!existing) throw new Error("Assignment not found")

  let classId: string | undefined
  if (data.subjectId) {
    const subject = await prisma.subject.findFirst({ where: { id: data.subjectId, schoolId }, select: { classId: true } })
    if (!subject) throw new Error("Subject not found")
    classId = subject.classId
  }

  const total = data.totalMarks ?? existing.totalMarks
  if (data.passMarks !== undefined && data.passMarks > total) throw new Error("Pass marks cannot exceed total marks")

  const due = data.dueDate ? endOfDay(data.dueDate) : undefined

  await prisma.assignment.update({
    where: { id: data.id },
    data: {
      ...(data.title          !== undefined && { title: data.title.trim() }),
      ...(data.description    !== undefined && { description: data.description?.trim() || null }),
      ...(data.subjectId      !== undefined && { subjectId: data.subjectId, classId }),
      ...(due                 !== undefined && { dueDate: due, dueDateBS: safeBS(due) }),
      ...(data.totalMarks     !== undefined && { totalMarks: data.totalMarks }),
      ...(data.passMarks      !== undefined && { passMarks: data.passMarks }),
      ...(data.allowLate      !== undefined && { allowLate: data.allowLate }),
      ...(data.latePenaltyPct !== undefined && { latePenaltyPct: data.latePenaltyPct }),
      ...(data.attachments    !== undefined && { attachments: data.attachments.length ? data.attachments : undefined }),
    },
  })

  revalidatePath(`/lms/courses/${existing.courseId}/assignments`)
  revalidatePath(`/lms/courses/${existing.courseId}/assignments/${data.id}`)
  return { ok: true }
}

export async function deleteAssignment(id: string) {
  const session = await gateLmsPermission("lms:assignments:manage")
  const existing = await prisma.assignment.findFirst({
    where: { id, schoolId: session.user.schoolId! }, select: { id: true, courseId: true },
  })
  if (!existing) throw new Error("Assignment not found")

  await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: id } })
  await prisma.assignment.delete({ where: { id } })

  revalidatePath(`/lms/courses/${existing.courseId}/assignments`)
  return { ok: true }
}

// ─── Grading ──────────────────────────────────────────────────────────────────

const gradeSchema = z.object({
  submissionId: z.string().min(1),
  marks:        z.number().nonnegative().max(1000),
  feedback:     z.string().max(5000).nullable().optional(),
  status:       z.enum(["GRADED", "RETURNED", "RESUBMIT"]).default("GRADED"),
})

export async function gradeSubmission(input: z.infer<typeof gradeSchema>) {
  const session = await gateLmsPermission("lms:assignments:grade")
  const data = gradeSchema.parse(input)
  const schoolId = session.user.schoolId!

  const sub = await prisma.assignmentSubmission.findFirst({
    where:   { id: data.submissionId, assignment: { schoolId } },
    include: { assignment: { select: { id: true, courseId: true, totalMarks: true } } },
  })
  if (!sub) throw new Error("Submission not found")
  if (data.marks > sub.assignment.totalMarks) throw new Error("Marks exceed the assignment total")

  await prisma.assignmentSubmission.update({
    where: { id: data.submissionId },
    data: {
      marks:      data.marks,
      feedback:   data.feedback?.trim() || null,
      status:     data.status,
      gradedById: session.user.id,
      gradedAt:   new Date(),
    },
  })

  revalidatePath(`/lms/courses/${sub.assignment.courseId}/assignments/${sub.assignment.id}`)
  return { ok: true }
}

// ─── Student side ─────────────────────────────────────────────────────────────

export async function getMyAssignments(courseId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!

  const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId, studentId }, select: { id: true } })
  if (!enrolled) throw new Error("FORBIDDEN")

  const assignments = await prisma.assignment.findMany({
    where:   { courseId, schoolId },
    include: { submissions: { where: { studentId } } },
    orderBy: { dueDate: "asc" },
  })

  const now = Date.now()
  return assignments.map(a => {
    const sub = a.submissions[0]
    return {
      id:             a.id,
      title:          a.title,
      description:    a.description,
      dueDate:        a.dueDate.toISOString(),
      dueDateBS:      a.dueDateBS ?? safeBS(a.dueDate),
      totalMarks:     a.totalMarks,
      passMarks:      a.passMarks,
      allowLate:      a.allowLate,
      isPastDue:      a.dueDate.getTime() < now,
      attachments:    asFileRefs(a.attachments),
      maxFileSize:    a.maxFileSize,
      allowedTypes:   a.allowedTypes,
      submission: sub ? {
        id:          sub.id,
        submittedAt: sub.submittedAt.toISOString(),
        isLate:      sub.isLate,
        status:      sub.status as SubmissionStatus,
        marks:       sub.marks,
        feedback:    sub.feedback,
        note:        sub.note,
        files:       asFileRefs(sub.fileUrls),
      } : null,
    }
  })
}

const submitSchema = z.object({
  assignmentId: z.string().min(1),
  note:         z.string().max(2000).nullable().optional(),
  files:        z.array(fileRefSchema).default([]),
})

export async function submitAssignment(input: z.infer<typeof submitSchema>) {
  const { studentId, session } = await gateLmsLearner()
  const data = submitSchema.parse(input)
  const schoolId = session.user.schoolId!

  const assignment = await prisma.assignment.findFirst({
    where:  { id: data.assignmentId, schoolId },
    select: { id: true, courseId: true, dueDate: true, allowLate: true },
  })
  if (!assignment || !assignment.courseId) throw new Error("Assignment not found")

  const enrolled = await prisma.lMSEnrollment.findFirst({
    where: { courseId: assignment.courseId, studentId }, select: { id: true },
  })
  if (!enrolled) throw new Error("FORBIDDEN")

  if (data.files.length === 0 && !data.note?.trim()) {
    throw new Error("Attach a file or add a note before submitting")
  }

  const isLate = Date.now() > assignment.dueDate.getTime()
  if (isLate && !assignment.allowLate) throw new Error("This assignment is past due and late submissions are not allowed")

  await prisma.assignmentSubmission.upsert({
    where:  { assignmentId_studentId: { assignmentId: data.assignmentId, studentId } },
    update: {
      submittedAt: new Date(),
      fileUrls:    data.files.length ? data.files : undefined,
      note:        data.note?.trim() || null,
      isLate,
      status:      "SUBMITTED",
      // Clear any prior grade on resubmission.
      marks:       null,
      gradedAt:    null,
    },
    create: {
      assignmentId: data.assignmentId,
      studentId,
      fileUrls:     data.files.length ? data.files : undefined,
      note:         data.note?.trim() || null,
      isLate,
      status:       "SUBMITTED",
    },
  })

  revalidatePath(`/lms/learn/${assignment.courseId}/assignments`)
  return { ok: true, isLate }
}
