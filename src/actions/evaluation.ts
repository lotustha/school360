"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  DEFAULT_ATTENDANCE_BANDS,
  RUBRIC_TEMPLATES,
  calculateAttendanceMarks,
  type AttendanceBand,
} from "@/lib/evaluation-frameworks"
import type { RubricType, RatingScale } from "../../generated/prisma/client"

// ─── Attendance → Marks computation ──────────────────────────────────────────

/**
 * Compute attendance marks for a student over a date range.
 * Bands are configured per school (in framework config) — defaults if not provided.
 */
export async function computeAttendanceMarks(args: {
  studentId: string
  schoolId:  string
  fromBS:    string
  toBS:      string
  bands?:    AttendanceBand[]
  maxMarks?: number
}) {
  const records = await prisma.attendance.findMany({
    where: {
      schoolId:  args.schoolId,
      studentId: args.studentId,
      dateBS:    { gte: args.fromBS, lte: args.toBS },
    },
    select: { status: true },
  })

  const total   = records.length
  const present = records.filter(r => r.status === "PRESENT" || r.status === "LATE").length

  const result = calculateAttendanceMarks(
    present,
    total,
    args.bands    ?? DEFAULT_ATTENDANCE_BANDS,
    args.maxMarks ?? 2,
  )
  return { ...result, totalDays: total, presentCount: present }
}

// ─── Rubrics: template seeding + CRUD ────────────────────────────────────────

/** Seed the CDC-aligned rubric templates for a school. Idempotent on (schoolId, name). */
export async function seedRubricTemplates(schoolId: string) {
  for (const tpl of RUBRIC_TEMPLATES) {
    const exists = await prisma.rubric.findFirst({
      where: { schoolId, name: tpl.name, isTemplate: true },
    })
    if (exists) continue

    await prisma.rubric.create({
      data: {
        schoolId,
        name:        tpl.name,
        description: tpl.description,
        type:        tpl.type as RubricType,
        scale:       "POINT_4",
        totalMarks:  tpl.totalMarks,
        category:    tpl.category,
        isTemplate:  true,
        criteria: {
          create: tpl.criteria.map((c, idx) => ({
            name:        c.name,
            description: c.description ?? null,
            maxMarks:    c.maxMarks,
            order:       idx,
          })),
        },
      },
    })
  }
  revalidatePath("/academics/grading/rubrics")
}

export async function listRubrics(schoolId: string, opts?: { category?: string; subjectId?: string }) {
  return prisma.rubric.findMany({
    where: {
      schoolId,
      ...(opts?.category  && { category:  opts.category  }),
      ...(opts?.subjectId && { subjectId: opts.subjectId }),
    },
    include: { criteria: { orderBy: { order: "asc" } }, _count: { select: { evaluations: true } } },
    orderBy: [{ isTemplate: "desc" }, { category: "asc" }, { name: "asc" }],
  })
}

export async function getRubric(id: string) {
  return prisma.rubric.findUnique({
    where:   { id },
    include: { criteria: { orderBy: { order: "asc" } } },
  })
}

export async function createRubric(data: {
  schoolId:     string
  name:         string
  description?: string
  type:         RubricType
  scale?:       RatingScale
  category?:    string
  subjectId?:   string
  criteria:     { name: string; description?: string; maxMarks: number }[]
}) {
  const totalMarks = data.criteria.reduce((s, c) => s + c.maxMarks, 0)

  const rubric = await prisma.rubric.create({
    data: {
      schoolId:    data.schoolId,
      name:        data.name,
      description: data.description ?? null,
      type:        data.type,
      scale:       data.scale ?? "POINT_4",
      category:    data.category  ?? null,
      subjectId:   data.subjectId ?? null,
      totalMarks,
      criteria: {
        create: data.criteria.map((c, idx) => ({
          name:        c.name,
          description: c.description ?? null,
          maxMarks:    c.maxMarks,
          order:       idx,
        })),
      },
    },
    include: { criteria: true },
  })
  revalidatePath("/academics/grading/rubrics")
  return rubric
}

export async function updateRubric(id: string, data: {
  name?:        string
  description?: string
  type?:        RubricType
  scale?:       RatingScale
  category?:    string | null
  subjectId?:   string | null
  criteria?:    { id?: string; name: string; description?: string; maxMarks: number }[]
}) {
  await prisma.$transaction(async tx => {
    if (data.criteria) {
      // Merge strategy: preserve criterion IDs so RubricCriterionScore rows (cascaded on
      // criterion delete) survive an edit. Diff incoming against existing by id:
      //   - existing + has id in incoming → update in place
      //   - existing + missing from incoming → delete (its scores cascade — by design for removed criteria)
      //   - incoming without id → create new
      const existing = await tx.rubricCriterion.findMany({
        where: { rubricId: id },
        select: { id: true },
      })
      const existingIds = new Set(existing.map(c => c.id))
      const incomingIds = new Set(data.criteria.map(c => c.id).filter((x): x is string => Boolean(x)))

      const toDelete = [...existingIds].filter(eid => !incomingIds.has(eid))
      if (toDelete.length > 0) {
        await tx.rubricCriterion.deleteMany({ where: { id: { in: toDelete } } })
      }

      for (const [idx, c] of data.criteria.entries()) {
        if (c.id && existingIds.has(c.id)) {
          await tx.rubricCriterion.update({
            where: { id: c.id },
            data: {
              name:        c.name,
              description: c.description ?? null,
              maxMarks:    c.maxMarks,
              order:       idx,
            },
          })
        } else {
          await tx.rubricCriterion.create({
            data: {
              rubricId:    id,
              name:        c.name,
              description: c.description ?? null,
              maxMarks:    c.maxMarks,
              order:       idx,
            },
          })
        }
      }

      const totalMarks = data.criteria.reduce((s, c) => s + c.maxMarks, 0)
      await tx.rubric.update({
        where: { id },
        data: {
          ...(data.name        !== undefined && { name:        data.name        }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.type        !== undefined && { type:        data.type        }),
          ...(data.scale       !== undefined && { scale:       data.scale       }),
          ...(data.category    !== undefined && { category:    data.category    }),
          ...(data.subjectId   !== undefined && { subjectId:   data.subjectId   }),
          totalMarks,
        },
      })
    } else {
      await tx.rubric.update({
        where: { id },
        data: {
          ...(data.name        !== undefined && { name:        data.name        }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.type        !== undefined && { type:        data.type        }),
          ...(data.scale       !== undefined && { scale:       data.scale       }),
          ...(data.category    !== undefined && { category:    data.category    }),
          ...(data.subjectId   !== undefined && { subjectId:   data.subjectId   }),
        },
      })
    }
  })
  revalidatePath("/academics/grading/rubrics")
}

export async function deleteRubric(id: string) {
  await prisma.rubric.delete({ where: { id } })
  revalidatePath("/academics/grading/rubrics")
}

// ─── Rubric Evaluations (applying a rubric to a student) ─────────────────────

export async function saveRubricEvaluation(args: {
  rubricId:      string
  studentId:     string
  examId?:       string
  evaluatedById: string
  comments?:     string
  scores:        { criterionId: string; score: number }[]
}) {
  const totalScore = args.scores.reduce((s, x) => s + x.score, 0)

  // Upsert by (rubric, student, exam-or-null) — we treat null examId as a separate slot per the index.
  // Use findFirst → update/create pattern since composite unique with nullable in Postgres is partial.
  const existing = await prisma.rubricEvaluation.findFirst({
    where: {
      rubricId:  args.rubricId,
      studentId: args.studentId,
      examId:    args.examId ?? null,
    },
    select: { id: true },
  })

  if (existing) {
    await prisma.$transaction([
      prisma.rubricCriterionScore.deleteMany({ where: { evaluationId: existing.id } }),
      prisma.rubricEvaluation.update({
        where: { id: existing.id },
        data: {
          totalScore,
          comments:      args.comments ?? null,
          evaluatedById: args.evaluatedById,
          scores: {
            create: args.scores.map(s => ({ criterionId: s.criterionId, score: s.score })),
          },
        },
      }),
    ])
  } else {
    await prisma.rubricEvaluation.create({
      data: {
        rubricId:      args.rubricId,
        studentId:     args.studentId,
        examId:        args.examId ?? null,
        totalScore,
        comments:      args.comments ?? null,
        evaluatedById: args.evaluatedById,
        scores: {
          create: args.scores.map(s => ({ criterionId: s.criterionId, score: s.score })),
        },
      },
    })
  }

  revalidatePath("/academics/grading/rubrics")
}

export async function getRubricEvaluation(args: {
  rubricId:  string
  studentId: string
  examId?:   string
}) {
  return prisma.rubricEvaluation.findFirst({
    where: {
      rubricId:  args.rubricId,
      studentId: args.studentId,
      examId:    args.examId ?? null,
    },
    include: { scores: true },
  })
}

export async function getStudentRubricEvaluations(studentId: string, opts?: { examId?: string }) {
  return prisma.rubricEvaluation.findMany({
    where: {
      studentId,
      ...(opts?.examId && { examId: opts.examId }),
    },
    include: {
      rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
      scores: true,
    },
    orderBy: { evaluatedAt: "desc" },
  })
}
