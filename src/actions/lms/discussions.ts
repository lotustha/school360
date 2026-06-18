"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSchoolSession, hasPermission } from "@/lib/permissions"
import { requireModule } from "@/lib/modules"

export type ThreadType = "DISCUSSION" | "QUESTION" | "ANNOUNCEMENT"
const THREAD_TYPES = ["DISCUSSION", "QUESTION", "ANNOUNCEMENT"] as const

interface Participant {
  session: Awaited<ReturnType<typeof getSchoolSession>>
  schoolId: string
  userId: string
  isStaff: boolean
  studentId: string | null
  canModerate: boolean
}

/**
 * A course participant is either staff with LMS access OR a student enrolled in
 * the course. Both can read threads and post replies. Announcements and
 * moderation are gated further.
 */
async function gateCourseParticipant(courseId: string): Promise<Participant> {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  await requireModule(schoolId, "ONLINE_LEARNING")

  const course = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!course) throw new Error("Course not found")

  const isStaff = (await hasPermission(session, "lms:view")) || (await hasPermission(session, "lms:manage"))
  let studentId: string | null = null
  if (!isStaff) {
    const student = await prisma.student.findFirst({ where: { userId: session.user.id, schoolId }, select: { id: true } })
    if (student) {
      const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId, studentId: student.id }, select: { id: true } })
      if (enrolled) studentId = student.id
    }
    if (!studentId) throw new Error("FORBIDDEN")
  }

  const canModerate = await hasPermission(session, "lms:discussions:moderate")
  return { session, schoolId, userId: session.user.id, isStaff, studentId, canModerate }
}

/** Resolve a thread to its course while enforcing participation. */
async function gateThread(threadId: string) {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  const thread = await prisma.discussionThread.findFirst({
    where:  { id: threadId, schoolId },
    select: { id: true, courseId: true, authorId: true, isLocked: true },
  })
  if (!thread) throw new Error("Thread not found")
  const p = await gateCourseParticipant(thread.courseId)
  return { thread, p }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listThreads(courseId: string) {
  const p = await gateCourseParticipant(courseId)
  const threads = await prisma.discussionThread.findMany({
    where:   { courseId, schoolId: p.schoolId },
    include: {
      author:  { select: { fullName: true, role: true } },
      replies: { select: { id: true, createdAt: true, isAnswer: true } },
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  })

  return {
    canModerate: p.canModerate,
    isStaff: p.isStaff,
    threads: threads.map(t => {
      const last = t.replies.reduce<Date>((m, r) => r.createdAt > m ? r.createdAt : m, t.createdAt)
      return {
        id:          t.id,
        title:       t.title,
        type:        t.type as ThreadType,
        isPinned:    t.isPinned,
        isLocked:    t.isLocked,
        authorName:  t.author.fullName,
        views:       t.views,
        replyCount:  t.replies.length,
        hasAnswer:   t.replies.some(r => r.isAnswer),
        lastActivity: last.toISOString(),
        createdAt:   t.createdAt.toISOString(),
      }
    }),
  }
}

export async function getThread(threadId: string) {
  const { thread, p } = await gateThread(threadId)

  // Count a view (best-effort, fire and continue).
  await prisma.discussionThread.update({ where: { id: thread.id }, data: { views: { increment: 1 } } })

  const full = await prisma.discussionThread.findUnique({
    where:   { id: thread.id },
    include: {
      author:  { select: { id: true, fullName: true, role: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      },
    },
  })
  if (!full) throw new Error("Thread not found")

  return {
    canModerate: p.canModerate,
    currentUserId: p.userId,
    thread: {
      id:        full.id,
      courseId:  full.courseId,
      title:     full.title,
      body:      full.body,
      type:      full.type as ThreadType,
      isPinned:  full.isPinned,
      isLocked:  full.isLocked,
      authorId:  full.authorId,
      authorName: full.author.fullName,
      authorRole: full.author.role,
      views:     full.views,
      createdAt: full.createdAt.toISOString(),
    },
    replies: full.replies.map(r => ({
      id:         r.id,
      body:       r.body,
      parentId:   r.parentId,
      isAnswer:   r.isAnswer,
      authorId:   r.authorId,
      authorName: r.author.fullName,
      authorRole: r.author.role,
      createdAt:  r.createdAt.toISOString(),
    })),
  }
}

// ─── Threads ──────────────────────────────────────────────────────────────────

const createThreadSchema = z.object({
  courseId: z.string().min(1),
  title:    z.string().min(1, "Title is required").max(200),
  body:     z.string().min(1, "Body is required").max(10_000),
  type:     z.enum(THREAD_TYPES).default("DISCUSSION"),
})

export async function createThread(input: z.infer<typeof createThreadSchema>) {
  const data = createThreadSchema.parse(input)
  const p = await gateCourseParticipant(data.courseId)

  // Only staff/moderators may post announcements.
  const type = data.type === "ANNOUNCEMENT" && !p.isStaff && !p.canModerate ? "DISCUSSION" : data.type

  const thread = await prisma.discussionThread.create({
    data: {
      schoolId: p.schoolId,
      courseId: data.courseId,
      title:    data.title.trim(),
      body:     data.body.trim(),
      type,
      authorId: p.userId,
    },
  })
  revalidatePath(`/lms/courses/${data.courseId}/discussions`)
  revalidatePath(`/lms/learn/${data.courseId}/discussions`)
  return { id: thread.id }
}

export async function togglePinThread(threadId: string, isPinned: boolean) {
  const { thread, p } = await gateThread(threadId)
  if (!p.canModerate) throw new Error("FORBIDDEN")
  await prisma.discussionThread.update({ where: { id: thread.id }, data: { isPinned } })
  revalidatePath(`/lms/courses/${thread.courseId}/discussions`)
  revalidatePath(`/lms/learn/${thread.courseId}/discussions`)
  return { ok: true }
}

export async function toggleLockThread(threadId: string, isLocked: boolean) {
  const { thread, p } = await gateThread(threadId)
  if (!p.canModerate) throw new Error("FORBIDDEN")
  await prisma.discussionThread.update({ where: { id: thread.id }, data: { isLocked } })
  revalidatePath(`/lms/courses/${thread.courseId}/discussions`)
  return { ok: true }
}

export async function deleteThread(threadId: string) {
  const { thread, p } = await gateThread(threadId)
  if (!p.canModerate && thread.authorId !== p.userId) throw new Error("FORBIDDEN")
  await prisma.discussionThread.delete({ where: { id: thread.id } }) // replies cascade
  revalidatePath(`/lms/courses/${thread.courseId}/discussions`)
  revalidatePath(`/lms/learn/${thread.courseId}/discussions`)
  return { ok: true, courseId: thread.courseId }
}

// ─── Replies ──────────────────────────────────────────────────────────────────

const replySchema = z.object({
  threadId: z.string().min(1),
  body:     z.string().min(1, "Reply cannot be empty").max(10_000),
  parentId: z.string().min(1).nullable().optional(),
})

export async function createReply(input: z.infer<typeof replySchema>) {
  const data = replySchema.parse(input)
  const { thread, p } = await gateThread(data.threadId)
  if (thread.isLocked && !p.canModerate) throw new Error("This thread is locked")

  if (data.parentId) {
    const parent = await prisma.discussionReply.findFirst({ where: { id: data.parentId, threadId: thread.id }, select: { id: true } })
    if (!parent) throw new Error("Parent reply not found")
  }

  await prisma.discussionReply.create({
    data: { threadId: thread.id, authorId: p.userId, body: data.body.trim(), parentId: data.parentId ?? null },
  })
  // Bump thread updatedAt for "last activity" ordering.
  await prisma.discussionThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } })

  revalidatePath(`/lms/courses/${thread.courseId}/discussions/${thread.id}`)
  revalidatePath(`/lms/learn/${thread.courseId}/discussions/${thread.id}`)
  return { ok: true }
}

export async function markAnswer(replyId: string, isAnswer: boolean) {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  const reply = await prisma.discussionReply.findFirst({
    where:  { id: replyId, thread: { schoolId } },
    select: { id: true, threadId: true, thread: { select: { courseId: true, authorId: true } } },
  })
  if (!reply) throw new Error("Reply not found")
  const p = await gateCourseParticipant(reply.thread.courseId)
  // Thread author or a moderator can accept an answer.
  if (!p.canModerate && reply.thread.authorId !== p.userId) throw new Error("FORBIDDEN")

  await prisma.discussionReply.update({ where: { id: replyId }, data: { isAnswer } })
  revalidatePath(`/lms/courses/${reply.thread.courseId}/discussions/${reply.threadId}`)
  revalidatePath(`/lms/learn/${reply.thread.courseId}/discussions/${reply.threadId}`)
  return { ok: true }
}

export async function deleteReply(replyId: string) {
  const session = await getSchoolSession()
  const schoolId = session.user.schoolId!
  const reply = await prisma.discussionReply.findFirst({
    where:  { id: replyId, thread: { schoolId } },
    select: { id: true, authorId: true, threadId: true, thread: { select: { courseId: true } } },
  })
  if (!reply) throw new Error("Reply not found")
  const p = await gateCourseParticipant(reply.thread.courseId)
  if (!p.canModerate && reply.authorId !== p.userId) throw new Error("FORBIDDEN")

  await prisma.discussionReply.delete({ where: { id: replyId } })
  revalidatePath(`/lms/courses/${reply.thread.courseId}/discussions/${reply.threadId}`)
  revalidatePath(`/lms/learn/${reply.thread.courseId}/discussions/${reply.threadId}`)
  return { ok: true }
}
