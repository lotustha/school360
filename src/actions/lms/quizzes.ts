"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { gateLmsRead, gateLmsPermission, gateLmsLearner } from "@/lib/lms-guard"

export type QuestionType = "MCQ" | "MULTI_SELECT" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY"
const QUESTION_TYPES = ["MCQ", "MULTI_SELECT", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const

interface Option { id: string; text: string; isCorrect: boolean }

function asOptions(v: unknown): Option[] {
  if (!Array.isArray(v)) return []
  return v.filter((o): o is Option => !!o && typeof (o as Option).id === "string")
}

// Answer as stored on the attempt.
interface StoredAnswer {
  questionId: string
  selectedOptions: string[]
  textAnswer: string | null
  marks: number
  isCorrect: boolean | null // null = needs manual grading (essay)
}

// ─── Manage: quiz CRUD ────────────────────────────────────────────────────────

const quizManage = () => gateLmsPermission("lms:quizzes:manage")

async function assertCourse(schoolId: string, courseId: string) {
  const c = await prisma.lMSCourse.findFirst({ where: { id: courseId, schoolId }, select: { id: true } })
  if (!c) throw new Error("Course not found")
}

async function loadQuiz(schoolId: string, quizId: string) {
  const q = await prisma.quiz.findFirst({ where: { id: quizId, schoolId }, select: { id: true, courseId: true } })
  if (!q) throw new Error("Quiz not found")
  return q
}

export interface QuizRow {
  id: string
  title: string
  description: string | null
  timeLimitMin: number | null
  totalMarks: number
  passMarks: number
  maxAttempts: number
  startAt: string | null
  endAt: string | null
  questionCount: number
  attemptCount: number
  enrolledCount: number
  isOpen: boolean
}

export async function listCourseQuizzes(courseId: string): Promise<QuizRow[]> {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, courseId)

  const [quizzes, enrolledCount] = await Promise.all([
    prisma.quiz.findMany({
      where:   { courseId, schoolId },
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lMSEnrollment.count({ where: { courseId } }),
  ])

  const now = Date.now()
  return quizzes.map(q => ({
    id:            q.id,
    title:         q.title,
    description:   q.description,
    timeLimitMin:  q.timeLimitMin,
    totalMarks:    q.totalMarks,
    passMarks:     q.passMarks,
    maxAttempts:   q.maxAttempts,
    startAt:       q.startAt?.toISOString() ?? null,
    endAt:         q.endAt?.toISOString() ?? null,
    questionCount: q._count.questions,
    attemptCount:  q._count.attempts,
    enrolledCount,
    isOpen: (!q.startAt || q.startAt.getTime() <= now) && (!q.endAt || q.endAt.getTime() >= now),
  }))
}

/** Full quiz + questions WITH answers — manage only. */
export async function getQuizEditor(quizId: string) {
  const session = await quizManage()
  const quiz = await prisma.quiz.findFirst({
    where:   { id: quizId, schoolId: session.user.schoolId! },
    include: { questions: { orderBy: { order: "asc" } } },
  })
  if (!quiz) throw new Error("Quiz not found")
  return {
    ...quiz,
    startAt: quiz.startAt?.toISOString() ?? null,
    endAt:   quiz.endAt?.toISOString() ?? null,
    questions: quiz.questions.map(q => ({ ...q, options: asOptions(q.options) })),
  }
}

const createQuizSchema = z.object({
  courseId:     z.string().min(1),
  title:        z.string().min(1, "Title is required").max(200),
  description:  z.string().max(2000).nullable().optional(),
  timeLimitMin: z.number().int().positive().max(600).nullable().optional(),
  passMarks:    z.number().nonnegative().default(0),
  maxAttempts:  z.number().int().positive().max(20).default(1),
  shuffleQ:     z.boolean().default(false),
  shuffleOpts:  z.boolean().default(false),
  showResult:   z.boolean().default(true),
  showAnswers:  z.boolean().default(false),
  startAt:      z.string().datetime().nullable().optional(),
  endAt:        z.string().datetime().nullable().optional(),
})

const updateQuizSchema = createQuizSchema.partial().omit({ courseId: true }).extend({ id: z.string().min(1) })

export async function createQuiz(input: z.infer<typeof createQuizSchema>) {
  const session = await quizManage()
  const data = createQuizSchema.parse(input)
  const schoolId = session.user.schoolId!
  await assertCourse(schoolId, data.courseId)

  const quiz = await prisma.quiz.create({
    data: {
      schoolId,
      courseId:     data.courseId,
      title:        data.title.trim(),
      description:  data.description?.trim() || null,
      timeLimitMin: data.timeLimitMin ?? null,
      totalMarks:   0, // recomputed from questions
      passMarks:    data.passMarks,
      maxAttempts:  data.maxAttempts,
      shuffleQ:     data.shuffleQ,
      shuffleOpts:  data.shuffleOpts,
      showResult:   data.showResult,
      showAnswers:  data.showAnswers,
      startAt:      data.startAt ? new Date(data.startAt) : null,
      endAt:        data.endAt ? new Date(data.endAt) : null,
      createdById:  session.user.id,
    },
  })
  revalidatePath(`/lms/courses/${data.courseId}/quizzes`)
  return { id: quiz.id }
}

export async function updateQuiz(input: z.infer<typeof updateQuizSchema>) {
  const session = await quizManage()
  const data = updateQuizSchema.parse(input)
  const quiz = await loadQuiz(session.user.schoolId!, data.id)

  await prisma.quiz.update({
    where: { id: data.id },
    data: {
      ...(data.title        !== undefined && { title: data.title.trim() }),
      ...(data.description  !== undefined && { description: data.description?.trim() || null }),
      ...(data.timeLimitMin !== undefined && { timeLimitMin: data.timeLimitMin ?? null }),
      ...(data.passMarks    !== undefined && { passMarks: data.passMarks }),
      ...(data.maxAttempts  !== undefined && { maxAttempts: data.maxAttempts }),
      ...(data.shuffleQ     !== undefined && { shuffleQ: data.shuffleQ }),
      ...(data.shuffleOpts  !== undefined && { shuffleOpts: data.shuffleOpts }),
      ...(data.showResult   !== undefined && { showResult: data.showResult }),
      ...(data.showAnswers  !== undefined && { showAnswers: data.showAnswers }),
      ...(data.startAt      !== undefined && { startAt: data.startAt ? new Date(data.startAt) : null }),
      ...(data.endAt        !== undefined && { endAt: data.endAt ? new Date(data.endAt) : null }),
    },
  })
  revalidatePath(`/lms/courses/${quiz.courseId}/quizzes`)
  revalidatePath(`/lms/courses/${quiz.courseId}/quizzes/${data.id}`)
  return { ok: true }
}

export async function deleteQuiz(id: string) {
  const session = await quizManage()
  const quiz = await loadQuiz(session.user.schoolId!, id)
  await prisma.quiz.delete({ where: { id } }) // questions + attempts cascade
  revalidatePath(`/lms/courses/${quiz.courseId}/quizzes`)
  return { ok: true }
}

// ─── Manage: question CRUD ────────────────────────────────────────────────────

const optionSchema = z.object({
  id:        z.string().min(1),
  text:      z.string().min(1).max(1000),
  isCorrect: z.boolean(),
})

const questionSchema = z.object({
  quizId:        z.string().min(1),
  type:          z.enum(QUESTION_TYPES),
  questionText:  z.string().min(1, "Question text is required").max(5000),
  imageUrl:      z.string().url().max(1000).nullable().optional(),
  options:       z.array(optionSchema).default([]),
  correctAnswer: z.string().max(2000).nullable().optional(),
  marks:         z.number().positive().max(100).default(1),
  negativeMarks: z.number().min(0).max(100).default(0),
  explanation:   z.string().max(2000).nullable().optional(),
})

const updateQuestionSchema = questionSchema.partial().omit({ quizId: true }).extend({ id: z.string().min(1) })

function validateQuestionShape(type: QuestionType, options: Option[], correctAnswer: string | null | undefined) {
  if (type === "MCQ") {
    if (options.length < 2) throw new Error("MCQ needs at least 2 options")
    if (options.filter(o => o.isCorrect).length !== 1) throw new Error("MCQ needs exactly one correct option")
  }
  if (type === "MULTI_SELECT") {
    if (options.length < 2) throw new Error("Multi-select needs at least 2 options")
    if (options.filter(o => o.isCorrect).length < 1) throw new Error("Mark at least one correct option")
  }
  if (type === "TRUE_FALSE") {
    if (correctAnswer !== "true" && correctAnswer !== "false") throw new Error("Select the correct answer (true/false)")
  }
  if (type === "SHORT_ANSWER") {
    if (!correctAnswer?.trim()) throw new Error("Provide the expected answer")
  }
}

async function recomputeTotalMarks(quizId: string) {
  const agg = await prisma.quizQuestion.aggregate({ where: { quizId }, _sum: { marks: true } })
  await prisma.quiz.update({ where: { id: quizId }, data: { totalMarks: agg._sum.marks ?? 0 } })
}

export async function addQuestion(input: z.infer<typeof questionSchema>) {
  const session = await quizManage()
  const data = questionSchema.parse(input)
  const quiz = await loadQuiz(session.user.schoolId!, data.quizId)
  validateQuestionShape(data.type, data.options, data.correctAnswer)

  const last = await prisma.quizQuestion.findFirst({ where: { quizId: data.quizId }, orderBy: { order: "desc" }, select: { order: true } })
  await prisma.quizQuestion.create({
    data: {
      quizId:        data.quizId,
      type:          data.type,
      questionText:  data.questionText.trim(),
      imageUrl:      data.imageUrl ?? null,
      options:       data.options.length ? data.options : undefined,
      correctAnswer: data.correctAnswer ?? null,
      marks:         data.marks,
      negativeMarks: data.negativeMarks,
      explanation:   data.explanation?.trim() || null,
      order:         (last?.order ?? 0) + 1,
    },
  })
  await recomputeTotalMarks(data.quizId)
  revalidatePath(`/lms/courses/${quiz.courseId}/quizzes/${data.quizId}`)
  return { ok: true }
}

export async function updateQuestion(input: z.infer<typeof updateQuestionSchema>) {
  const session = await quizManage()
  const data = updateQuestionSchema.parse(input)
  const schoolId = session.user.schoolId!

  const existing = await prisma.quizQuestion.findFirst({
    where:   { id: data.id, quiz: { schoolId } },
    include: { quiz: { select: { id: true, courseId: true } } },
  })
  if (!existing) throw new Error("Question not found")

  const type = (data.type ?? existing.type) as QuestionType
  const options = data.options ?? asOptions(existing.options)
  const correctAnswer = data.correctAnswer !== undefined ? data.correctAnswer : existing.correctAnswer
  validateQuestionShape(type, options, correctAnswer)

  await prisma.quizQuestion.update({
    where: { id: data.id },
    data: {
      ...(data.type          !== undefined && { type: data.type }),
      ...(data.questionText  !== undefined && { questionText: data.questionText.trim() }),
      ...(data.imageUrl      !== undefined && { imageUrl: data.imageUrl ?? null }),
      ...(data.options       !== undefined && { options: data.options.length ? data.options : undefined }),
      ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer ?? null }),
      ...(data.marks         !== undefined && { marks: data.marks }),
      ...(data.negativeMarks !== undefined && { negativeMarks: data.negativeMarks }),
      ...(data.explanation   !== undefined && { explanation: data.explanation?.trim() || null }),
    },
  })
  await recomputeTotalMarks(existing.quiz.id)
  revalidatePath(`/lms/courses/${existing.quiz.courseId}/quizzes/${existing.quiz.id}`)
  return { ok: true }
}

export async function deleteQuestion(id: string) {
  const session = await quizManage()
  const existing = await prisma.quizQuestion.findFirst({
    where:   { id, quiz: { schoolId: session.user.schoolId! } },
    include: { quiz: { select: { id: true, courseId: true } } },
  })
  if (!existing) throw new Error("Question not found")
  await prisma.quizQuestion.delete({ where: { id } })
  await recomputeTotalMarks(existing.quiz.id)
  revalidatePath(`/lms/courses/${existing.quiz.courseId}/quizzes/${existing.quiz.id}`)
  return { ok: true }
}

// ─── Manage: results ──────────────────────────────────────────────────────────

export async function getQuizResults(quizId: string) {
  const session = await gateLmsRead()
  const schoolId = session.user.schoolId!
  const quiz = await prisma.quiz.findFirst({
    where:   { id: quizId, schoolId },
    select:  { id: true, title: true, totalMarks: true, passMarks: true, courseId: true },
  })
  if (!quiz) throw new Error("Quiz not found")

  const attempts = await prisma.quizAttempt.findMany({
    where:   { quizId, status: { in: ["SUBMITTED", "EXPIRED"] } },
    include: { student: { select: { rollNumber: true, user: { select: { fullName: true } }, class: { select: { name: true } } } } },
    orderBy: [{ studentId: "asc" }, { attemptNo: "asc" }],
  })

  // Best attempt per student.
  const best = new Map<string, typeof attempts[number]>()
  for (const a of attempts) {
    const cur = best.get(a.studentId)
    if (!cur || (a.score ?? 0) > (cur.score ?? 0)) best.set(a.studentId, a)
  }

  return {
    quiz,
    rows: [...best.values()].map(a => ({
      attemptId:   a.id,
      name:        a.student.user.fullName,
      rollNumber:  a.student.rollNumber,
      className:   a.student.class.name,
      score:       a.score,
      isPassed:    a.isPassed,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      attemptNo:   a.attemptNo,
      timeTaken:   a.timeTaken,
    })),
  }
}

/** Manual score override (e.g. after grading essay questions). */
export async function gradeAttempt(attemptId: string, score: number) {
  const session = await quizManage()
  const attempt = await prisma.quizAttempt.findFirst({
    where:   { id: attemptId, quiz: { schoolId: session.user.schoolId! } },
    include: { quiz: { select: { id: true, courseId: true, passMarks: true } } },
  })
  if (!attempt) throw new Error("Attempt not found")
  await prisma.quizAttempt.update({
    where: { id: attemptId },
    data:  { score, isPassed: score >= attempt.quiz.passMarks },
  })
  revalidatePath(`/lms/courses/${attempt.quiz.courseId}/quizzes/${attempt.quiz.id}/results`)
  return { ok: true }
}

// ─── Student: take quiz ───────────────────────────────────────────────────────

/** Strip answer keys before sending questions to a learner. */
function sanitizeQuestion(q: { id: string; type: string; questionText: string; imageUrl: string | null; options: unknown; marks: number }) {
  return {
    id: q.id,
    type: q.type as QuestionType,
    questionText: q.questionText,
    imageUrl: q.imageUrl,
    marks: q.marks,
    options: asOptions(q.options).map(o => ({ id: o.id, text: o.text })), // no isCorrect
  }
}

export async function getMyQuizzes(courseId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!
  const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId, studentId }, select: { id: true } })
  if (!enrolled) throw new Error("FORBIDDEN")

  const quizzes = await prisma.quiz.findMany({
    where:   { courseId, schoolId },
    include: {
      _count:   { select: { questions: true } },
      attempts: { where: { studentId }, orderBy: { attemptNo: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = Date.now()
  return quizzes.map(q => {
    const submitted = q.attempts.filter(a => a.status !== "IN_PROGRESS")
    const inProgress = q.attempts.find(a => a.status === "IN_PROGRESS")
    const best = submitted.reduce<number | null>((m, a) => a.score == null ? m : m == null ? a.score : Math.max(m, a.score), null)
    return {
      id:            q.id,
      title:         q.title,
      description:   q.description,
      timeLimitMin:  q.timeLimitMin,
      totalMarks:    q.totalMarks,
      passMarks:     q.passMarks,
      maxAttempts:   q.maxAttempts,
      questionCount: q._count.questions,
      showResult:    q.showResult,
      isOpen:        (!q.startAt || q.startAt.getTime() <= now) && (!q.endAt || q.endAt.getTime() >= now),
      startAt:       q.startAt?.toISOString() ?? null,
      endAt:         q.endAt?.toISOString() ?? null,
      attemptsUsed:  submitted.length,
      bestScore:     best,
      inProgressId:  inProgress?.id ?? null,
    }
  })
}

export async function startQuizAttempt(quizId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!

  const quiz = await prisma.quiz.findFirst({
    where:   { id: quizId, schoolId },
    include: { questions: { orderBy: { order: "asc" } } },
  })
  if (!quiz || !quiz.courseId) throw new Error("Quiz not found")

  const enrolled = await prisma.lMSEnrollment.findFirst({ where: { courseId: quiz.courseId, studentId }, select: { id: true } })
  if (!enrolled) throw new Error("FORBIDDEN")

  const now = Date.now()
  if (quiz.startAt && quiz.startAt.getTime() > now) throw new Error("This quiz hasn't opened yet")
  if (quiz.endAt && quiz.endAt.getTime() < now) throw new Error("This quiz has closed")
  if (quiz.questions.length === 0) throw new Error("This quiz has no questions yet")

  const existing = await prisma.quizAttempt.findFirst({ where: { quizId, studentId }, orderBy: { attemptNo: "desc" } })
  if (existing?.status === "IN_PROGRESS") return { attemptId: existing.id }

  const used = await prisma.quizAttempt.count({ where: { quizId, studentId, status: { not: "IN_PROGRESS" } } })
  if (used >= quiz.maxAttempts) throw new Error("No attempts remaining")

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId, studentId,
      attemptNo: (existing?.attemptNo ?? 0) + 1,
      answers: [],
      status: "IN_PROGRESS",
    },
  })
  return { attemptId: attempt.id }
}

/** Active attempt + sanitized questions for the take-quiz screen. */
export async function getAttempt(attemptId: string) {
  const { studentId, session } = await gateLmsLearner()
  const schoolId = session.user.schoolId!

  const attempt = await prisma.quizAttempt.findFirst({
    where:   { id: attemptId, studentId, quiz: { schoolId } },
    include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
  })
  if (!attempt) throw new Error("Attempt not found")

  let questions = attempt.quiz.questions.map(sanitizeQuestion)
  if (attempt.quiz.shuffleQ) questions = shuffleBy(questions, attempt.id)
  if (attempt.quiz.shuffleOpts) {
    questions = questions.map(q => ({ ...q, options: shuffleBy(q.options, attempt.id + q.id) }))
  }

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      timeLimitMin: attempt.quiz.timeLimitMin,
    },
    quiz: {
      id: attempt.quiz.id,
      title: attempt.quiz.title,
      courseId: attempt.quiz.courseId,
      totalMarks: attempt.quiz.totalMarks,
    },
    questions,
  }
}

const submitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    selectedOptions: z.array(z.string()).default([]),
    textAnswer: z.string().max(20_000).nullable().optional(),
  })).default([]),
})

export async function submitQuizAttempt(input: z.infer<typeof submitSchema>) {
  const { studentId, session } = await gateLmsLearner()
  const data = submitSchema.parse(input)
  const schoolId = session.user.schoolId!

  const attempt = await prisma.quizAttempt.findFirst({
    where:   { id: data.attemptId, studentId, quiz: { schoolId } },
    include: { quiz: { include: { questions: true } } },
  })
  if (!attempt) throw new Error("Attempt not found")
  if (attempt.status !== "IN_PROGRESS") throw new Error("This attempt was already submitted")

  const answerMap = new Map(data.answers.map(a => [a.questionId, a]))
  const graded: StoredAnswer[] = []
  let score = 0
  let needsManual = false

  for (const q of attempt.quiz.questions) {
    const a = answerMap.get(q.id)
    const selected = a?.selectedOptions ?? []
    const text = a?.textAnswer ?? null
    const opts = asOptions(q.options)
    let marks = 0
    let isCorrect: boolean | null = false

    switch (q.type as QuestionType) {
      case "MCQ": {
        const correct = opts.find(o => o.isCorrect)
        isCorrect = selected.length === 1 && !!correct && selected[0] === correct.id
        marks = isCorrect ? q.marks : -q.negativeMarks
        break
      }
      case "MULTI_SELECT": {
        const correct = new Set(opts.filter(o => o.isCorrect).map(o => o.id))
        const sel = new Set(selected)
        isCorrect = correct.size === sel.size && [...correct].every(id => sel.has(id))
        marks = isCorrect ? q.marks : 0
        break
      }
      case "TRUE_FALSE": {
        isCorrect = !!text && text.toLowerCase() === (q.correctAnswer ?? "").toLowerCase()
        marks = isCorrect ? q.marks : -q.negativeMarks
        break
      }
      case "SHORT_ANSWER": {
        isCorrect = !!text && text.trim().toLowerCase() === (q.correctAnswer ?? "").trim().toLowerCase()
        marks = isCorrect ? q.marks : 0
        break
      }
      case "ESSAY": {
        isCorrect = null // manual
        marks = 0
        needsManual = true
        break
      }
    }

    score += marks
    graded.push({ questionId: q.id, selectedOptions: selected, textAnswer: text, marks, isCorrect })
  }

  score = Math.max(0, score)
  const timeTaken = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000)

  await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      answers: graded as unknown as object[],
      score,
      isPassed: score >= attempt.quiz.passMarks,
      status: "SUBMITTED",
      submittedAt: new Date(),
      timeTaken,
    },
  })

  revalidatePath(`/lms/learn/${attempt.quiz.courseId}/quizzes`)
  return {
    ok: true,
    score,
    totalMarks: attempt.quiz.totalMarks,
    isPassed: score >= attempt.quiz.passMarks,
    needsManual,
    showResult: attempt.quiz.showResult,
  }
}

// Deterministic shuffle keyed by a seed string (stable per attempt — no Math.random).
function shuffleBy<T>(arr: T[], seed: string): T[] {
  const out = [...arr]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
