"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { ComponentPart, ComponentSource } from "../../generated/prisma/client"
import {
  EVALUATION_BAND_RECIPES, findExamByHint,
  type BandKey,
} from "@/lib/evaluation-bands"

// ─── Evaluation CRUD ────────────────────────────────────────────────────────

export async function listEvaluations(args: {
  schoolId:        string
  classId?:        string
  academicYearId?: string
  /** Filter by AcademicYear.name (used when sessions are de-duped by name across faculties). */
  academicYearName?: string
  facultyId?:      string | null  // null = "none" (General); undefined = no filter
}) {
  // Faculty filter applies via the joined classes (EvaluationClass → Class.facultyId).
  // If faculty is set, only evaluations covering at least one class in that faculty match.
  const facultyClassFilter =
    args.facultyId === undefined ? undefined
    : args.facultyId === null     ? { facultyId: null }
    :                                { facultyId: args.facultyId }

  return prisma.evaluation.findMany({
    where: {
      schoolId: args.schoolId,
      ...(args.academicYearId   && { academicYearId: args.academicYearId }),
      ...(args.academicYearName && { academicYear: { name: args.academicYearName } }),
      ...(args.classId && { evaluationClasses: { some: { classId: args.classId } } }),
      ...(facultyClassFilter && {
        evaluationClasses: {
          some: { class: facultyClassFilter },
        },
      }),
    },
    include: {
      academicYear: { select: { id: true, name: true, isCurrent: true } },
      evaluationClasses: {
        include: {
          class: { select: { id: true, name: true, facultyId: true, faculty: { select: { id: true, name: true } } } },
        },
      },
      subjectEvaluations: {
        select: {
          id: true,
          _count: { select: { components: true, results: true } },
        },
      },
      _count: { select: { subjectEvaluations: true, evaluationClasses: true } },
    },
    orderBy: [{ academicYear: { name: "desc" } }, { sequenceNumber: "asc" }],
  })
}

export async function getEvaluation(id: string) {
  return prisma.evaluation.findUnique({
    where: { id },
    include: {
      academicYear: { select: { id: true, name: true } },
      evaluationClasses: {
        include: {
          class: { select: { id: true, name: true, facultyId: true } },
        },
      },
      subjectEvaluations: {
        include: {
          subject:    { select: { id: true, name: true, code: true, classId: true } },
          components: {
            orderBy: [{ part: "asc" }, { orderIndex: "asc" }],
            include: { sourceExam: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ orderIndex: "asc" }, { subject: { name: "asc" } }],
      },
    },
  })
}

export async function createEvaluation(data: {
  schoolId:           string
  classIds:           string[]   // multi-class — at least one required
  academicYearId:     string
  name:               string
  sequenceNumber:     number
  description?:       string
  isFinal?:           boolean
  autoSeedSubjects?:  boolean    // create SubjectEvaluations for every subject in every selected class
  /** Optional preset key to seed components per the band's recipe. Empty seed when omitted. */
  bandKey?:           BandKey
}) {
  if (!data.classIds || data.classIds.length === 0) {
    throw new Error("At least one class must be selected")
  }
  const isFinal = data.isFinal ?? false

  // Resolve the recipe ahead of the transaction (pure lookup).
  const recipeSet = data.bandKey ? EVALUATION_BAND_RECIPES[data.bandKey] : null
  const recipe    = recipeSet ? (isFinal ? recipeSet.final : recipeSet.interim) : null

  // Subjects per class — used only when auto-seeding.
  const subjects = data.autoSeedSubjects
    ? await prisma.subject.findMany({
        where:  { schoolId: data.schoolId, classId: { in: data.classIds } },
        select: { id: true, classId: true },
      })
    : []

  // Exams in the same academic year — used only when the recipe has DERIVED_FROM_EXAM components.
  const needsExams = recipe?.components.some(c => c.source === "DERIVED_FROM_EXAM") ?? false
  const exams      = needsExams
    ? await prisma.exam.findMany({
        where:  { schoolId: data.schoolId, academicYearId: data.academicYearId },
        select: { id: true, name: true },
      })
    : []

  const ev = await prisma.$transaction(async tx => {
    const created = await tx.evaluation.create({
      data: {
        schoolId:       data.schoolId,
        academicYearId: data.academicYearId,
        name:           data.name,
        sequenceNumber: data.sequenceNumber,
        description:    data.description ?? null,
        isFinal,
      },
    })

    await tx.evaluationClass.createMany({
      data: data.classIds.map(classId => ({ evaluationId: created.id, classId })),
    })

    if (data.autoSeedSubjects && subjects.length > 0) {
      if (recipe) {
        // Seed with the band's recipe — internalMax/externalMax + components.
        for (const s of subjects) {
          await tx.subjectEvaluation.create({
            data: {
              evaluationId: created.id,
              subjectId:    s.id,
              internalMax:  recipe.internalMax,
              externalMax:  recipe.externalMax,
              components: {
                create: recipe.components.map((c, i) => {
                  const link = c.source === "DERIVED_FROM_EXAM"
                    ? findExamByHint(c.examMatchHint, data.name, exams)
                    : null
                  return {
                    part:           c.part,
                    label:          c.label,
                    maxMarks:       c.maxMarks,
                    orderIndex:     i,
                    source:         c.source,
                    sourceExamId:   link?.id ?? null,
                    sourceMaxMarks: c.source === "DERIVED_FROM_EXAM" ? (c.sourceMaxMarks ?? 100) : null,
                  }
                }),
              },
            },
          })
        }
      } else {
        // No recipe — empty SubjectEvaluations (custom / ECD / no band).
        await tx.subjectEvaluation.createMany({
          data: subjects.map(s => ({
            evaluationId: created.id,
            subjectId:    s.id,
            internalMax:  0,
            externalMax:  0,
          })),
        })
      }
    }

    return created
  })

  revalidatePath("/academics/evaluations")
  return ev
}

export async function updateEvaluation(id: string, data: {
  name?:           string
  description?:    string | null
  sequenceNumber?: number
  isFinal?:        boolean
  isLocked?:       boolean
  publishAt?:      string | null
  classIds?:       string[]    // replace the EvaluationClass set
}) {
  await prisma.$transaction(async tx => {
    await tx.evaluation.update({
      where: { id },
      data: {
        ...(data.name           !== undefined && { name:           data.name }),
        ...(data.description    !== undefined && { description:    data.description }),
        ...(data.sequenceNumber !== undefined && { sequenceNumber: data.sequenceNumber }),
        ...(data.isFinal        !== undefined && { isFinal:        data.isFinal }),
        ...(data.isLocked       !== undefined && { isLocked:       data.isLocked }),
        ...(data.publishAt      !== undefined && { publishAt:      data.publishAt ? new Date(data.publishAt) : null }),
      },
    })

    if (data.classIds) {
      const existing = await tx.evaluationClass.findMany({
        where: { evaluationId: id },
        select: { classId: true },
      })
      const existingSet = new Set(existing.map(e => e.classId))
      const incomingSet = new Set(data.classIds)
      const toAdd       = [...incomingSet].filter(c => !existingSet.has(c))
      const toRemove    = [...existingSet].filter(c => !incomingSet.has(c))
      if (toRemove.length > 0) {
        await tx.evaluationClass.deleteMany({ where: { evaluationId: id, classId: { in: toRemove } } })
      }
      if (toAdd.length > 0) {
        await tx.evaluationClass.createMany({
          data: toAdd.map(classId => ({ evaluationId: id, classId })),
        })
      }
    }
  })
  revalidatePath("/academics/evaluations")
  revalidatePath(`/academics/evaluations/${id}`)
}

export async function deleteEvaluation(id: string) {
  await prisma.evaluation.delete({ where: { id } })
  revalidatePath("/academics/evaluations")
}

// ─── SubjectEvaluation ──────────────────────────────────────────────────────

export async function addSubjectToEvaluation(args: {
  evaluationId: string
  subjectId:    string
  internalMax?: number
  externalMax?: number
}) {
  // Append to the end — orderIndex = max(existing) + 1.
  const maxOrder = await prisma.subjectEvaluation.aggregate({
    where:  { evaluationId: args.evaluationId },
    _max:   { orderIndex: true },
  })
  const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1

  const se = await prisma.subjectEvaluation.create({
    data: {
      evaluationId: args.evaluationId,
      subjectId:    args.subjectId,
      internalMax:  args.internalMax ?? 0,
      externalMax:  args.externalMax ?? 0,
      orderIndex:   nextOrder,
    },
  })
  revalidatePath(`/academics/evaluations/${args.evaluationId}`)
  return se
}

/**
 * Persist subject-tab ordering after a drag-reorder. Re-numbers every passed
 * SubjectEvaluation by its position in the list; sequential 0..n. Single
 * transaction so the UI never sees a partial reorder.
 */
export async function reorderSubjectEvaluations(
  evaluationId: string,
  orderedIds:   string[],
) {
  if (orderedIds.length === 0) return
  // Scope check — every passed id must belong to this evaluation.
  const owned = await prisma.subjectEvaluation.findMany({
    where:  { id: { in: orderedIds }, evaluationId },
    select: { id: true },
  })
  if (owned.length !== orderedIds.length) {
    throw new Error("Reorder rejected — one or more SubjectEvaluations don't belong to this evaluation")
  }
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.subjectEvaluation.update({
        where: { id },
        data:  { orderIndex: idx },
      })
    ),
  )
  revalidatePath(`/academics/evaluations/${evaluationId}`)
}

export async function updateSubjectEvaluation(id: string, data: {
  internalMax?: number
  externalMax?: number
}) {
  const updated = await prisma.subjectEvaluation.update({
    where: { id },
    data: {
      ...(data.internalMax !== undefined && { internalMax: data.internalMax }),
      ...(data.externalMax !== undefined && { externalMax: data.externalMax }),
    },
  })
  revalidatePath(`/academics/evaluations/${updated.evaluationId}`)
}

export async function removeSubjectFromEvaluation(subjectEvaluationId: string) {
  const se = await prisma.subjectEvaluation.delete({
    where: { id: subjectEvaluationId },
    select: { evaluationId: true },
  })
  revalidatePath(`/academics/evaluations/${se.evaluationId}`)
}

// ─── Components: replace-by-id merge ────────────────────────────────────────

export type ComponentInput = {
  id?:               string
  part:              ComponentPart
  label:             string
  maxMarks:          number
  orderIndex:        number
  source:            ComponentSource
  sourceExamId?:     string | null
  sourceMaxMarks?:   number | null
  attendanceFromDate?: string | null   // ISO date
  attendanceToDate?:   string | null
}

export async function setEvaluationComponents(args: {
  subjectEvaluationId: string
  components:          ComponentInput[]
}) {
  await prisma.$transaction(async tx => {
    const existing = await tx.evaluationComponent.findMany({
      where:  { subjectEvaluationId: args.subjectEvaluationId },
      select: { id: true },
    })
    const existingIds = new Set(existing.map(c => c.id))
    const incomingIds = new Set(args.components.map(c => c.id).filter((x): x is string => Boolean(x)))

    // Delete components no longer in the incoming list (their EvaluationComponentMark rows cascade).
    const toDelete = [...existingIds].filter(eid => !incomingIds.has(eid))
    if (toDelete.length > 0) {
      await tx.evaluationComponent.deleteMany({ where: { id: { in: toDelete } } })
    }

    for (const c of args.components) {
      const payload = {
        part:               c.part,
        label:              c.label,
        maxMarks:           c.maxMarks,
        orderIndex:         c.orderIndex,
        source:             c.source,
        sourceExamId:       c.sourceExamId       ?? null,
        sourceMaxMarks:     c.sourceMaxMarks     ?? null,
        attendanceFromDate: c.attendanceFromDate ? new Date(c.attendanceFromDate) : null,
        attendanceToDate:   c.attendanceToDate   ? new Date(c.attendanceToDate)   : null,
      }
      if (c.id && existingIds.has(c.id)) {
        await tx.evaluationComponent.update({ where: { id: c.id }, data: payload })
      } else {
        await tx.evaluationComponent.create({
          data: { ...payload, subjectEvaluationId: args.subjectEvaluationId },
        })
      }
    }
  })

  const se = await prisma.subjectEvaluation.findUnique({
    where:  { id: args.subjectEvaluationId },
    select: { evaluationId: true },
  })
  if (se) revalidatePath(`/academics/evaluations/${se.evaluationId}`)
}

// ─── Manual / Attendance-override score persistence ─────────────────────────

export async function saveComponentMark(args: {
  componentId: string
  studentId:   string    // Student.id
  score:       number | null
  isAbsent:    boolean
  isOverride?: boolean
}) {
  await prisma.evaluationComponentMark.upsert({
    where: {
      componentId_studentId: {
        componentId: args.componentId,
        studentId:   args.studentId,
      },
    },
    create: {
      componentId: args.componentId,
      studentId:   args.studentId,
      score:       args.score,
      isAbsent:    args.isAbsent,
      isOverride:  args.isOverride ?? false,
    },
    update: {
      score:      args.score,
      isAbsent:   args.isAbsent,
      isOverride: args.isOverride ?? false,
    },
  })
}

export async function saveComponentMarksBulk(args: {
  componentId: string
  records: {
    studentId: string
    score:     number | null
    isAbsent:  boolean
    isOverride?: boolean
  }[]
}) {
  if (args.records.length === 0) return { saved: 0 }
  await prisma.$transaction(
    args.records.map(r =>
      prisma.evaluationComponentMark.upsert({
        where: {
          componentId_studentId: {
            componentId: args.componentId,
            studentId:   r.studentId,
          },
        },
        create: {
          componentId: args.componentId,
          studentId:   r.studentId,
          score:       r.score,
          isAbsent:    r.isAbsent,
          isOverride:  r.isOverride ?? false,
        },
        update: {
          score:      r.score,
          isAbsent:   r.isAbsent,
          isOverride: r.isOverride ?? false,
        },
      })
    )
  )
  return { saved: args.records.length }
}

// ─── Copy components from another SubjectEvaluation ─────────────────────────

/**
 * List candidate SubjectEvaluations to copy components from. Excludes the
 * current target. Includes only those with at least one component.
 */
export async function listCloneSources(args: {
  schoolId:               string
  excludeSubjectEvaluationId?: string
}) {
  const rows = await prisma.subjectEvaluation.findMany({
    where: {
      ...(args.excludeSubjectEvaluationId && { id: { not: args.excludeSubjectEvaluationId } }),
      evaluation: { schoolId: args.schoolId },
    },
    include: {
      subject:    { select: { id: true, name: true, code: true, class: { select: { name: true } } } },
      evaluation: { select: { id: true, name: true, sequenceNumber: true } },
      _count:     { select: { components: true } },
    },
    orderBy: [
      { evaluation: { sequenceNumber: "asc" } },
      { subject:    { name: "asc" } },
    ],
  })
  return rows
    .filter(r => r._count.components > 0)
    .map(r => ({
      id:                r.id,
      evaluationId:      r.evaluationId,
      evaluationName:    r.evaluation.name,
      sequenceNumber:    r.evaluation.sequenceNumber,
      subjectName:       r.subject.name,
      subjectCode:       r.subject.code,
      className:         r.subject.class.name,
      componentsCount:   r._count.components,
      internalMax:       r.internalMax,
      externalMax:       r.externalMax,
    }))
}

/**
 * Clone every component (and the internalMax/externalMax caps) from a source
 * SubjectEvaluation onto another. `mode` controls whether existing components
 * on the target are replaced or appended to.
 */
export async function cloneSubjectEvaluationComponents(args: {
  fromSubjectEvaluationId: string
  toSubjectEvaluationId:   string
  mode:                    "REPLACE" | "APPEND"
  copyCaps?:               boolean   // Also overwrite internalMax/externalMax on target (default: true when REPLACE)
}) {
  if (args.fromSubjectEvaluationId === args.toSubjectEvaluationId) {
    throw new Error("Source and destination must differ")
  }

  const [source, target] = await Promise.all([
    prisma.subjectEvaluation.findUnique({
      where:   { id: args.fromSubjectEvaluationId },
      include: { components: { orderBy: { orderIndex: "asc" } } },
    }),
    prisma.subjectEvaluation.findUnique({
      where:   { id: args.toSubjectEvaluationId },
      include: { _count: { select: { components: true } } },
    }),
  ])
  if (!source) throw new Error("Source SubjectEvaluation not found")
  if (!target) throw new Error("Target SubjectEvaluation not found")

  const copyCaps = args.copyCaps ?? (args.mode === "REPLACE")

  await prisma.$transaction(async tx => {
    if (args.mode === "REPLACE") {
      await tx.evaluationComponent.deleteMany({ where: { subjectEvaluationId: args.toSubjectEvaluationId } })
    }

    const baseOrder = args.mode === "APPEND" ? target._count.components : 0

    for (const [i, c] of source.components.entries()) {
      await tx.evaluationComponent.create({
        data: {
          subjectEvaluationId: args.toSubjectEvaluationId,
          part:                c.part,
          label:               c.label,
          maxMarks:            c.maxMarks,
          orderIndex:          baseOrder + i,
          source:              c.source,
          sourceExamId:        c.sourceExamId,
          sourceMaxMarks:      c.sourceMaxMarks,
          attendanceFromDate:  c.attendanceFromDate,
          attendanceToDate:    c.attendanceToDate,
        },
      })
    }

    if (copyCaps) {
      await tx.subjectEvaluation.update({
        where: { id: args.toSubjectEvaluationId },
        data:  { internalMax: source.internalMax, externalMax: source.externalMax },
      })
    }
  })

  revalidatePath("/academics/evaluations")
  return { copied: source.components.length, mode: args.mode }
}

export async function getComponentMarks(componentId: string) {
  const rows = await prisma.evaluationComponentMark.findMany({
    where:  { componentId },
    select: { studentId: true, score: true, isAbsent: true, isOverride: true },
  })
  const map: Record<string, { score: number | null; isAbsent: boolean; isOverride: boolean }> = {}
  for (const r of rows) map[r.studentId] = { score: r.score, isAbsent: r.isAbsent, isOverride: r.isOverride }
  return map
}
