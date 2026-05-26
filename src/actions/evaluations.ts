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
  // Combine class + faculty conditions in one `some` clause so the second spread
  // doesn't overwrite the first (both want to set `evaluationClasses`).
  const someClause: Record<string, unknown> = {}
  if (args.classId) someClause.classId = args.classId
  if (args.facultyId !== undefined) {
    someClause.class = args.facultyId === null ? { facultyId: null } : { facultyId: args.facultyId }
  }
  const hasSome = Object.keys(someClause).length > 0

  return prisma.evaluation.findMany({
    where: {
      schoolId: args.schoolId,
      ...(args.academicYearId   && { academicYearId: args.academicYearId }),
      ...(args.academicYearName && { academicYear: { name: args.academicYearName } }),
      ...(hasSome && { evaluationClasses: { some: someClause } }),
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
  /** Optional publish timestamp (ISO). When set, the evaluation is created already-published. */
  publishAt?:         string | null
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

  // Auto-create plan: when a DERIVED_FROM_EXAM component can't find a matching
  // terminal in this year, mint a placeholder Exam inside the same transaction
  // and link the component to it. Saves the teacher a trip to /academics/exams
  // just to create empty Term-1 / Term-2 / Final shells before grading works.
  type HintKey = "first" | "second" | "final" | "__self__"
  const hintNameMap: Record<HintKey, string> = {
    first:    "First Terminal Examination",
    second:   "Second Terminal Examination",
    final:    "Final Examination",
    __self__: data.name,
  }

  // Bucket the recipe by hint and pre-resolve which buckets already match an existing exam.
  const hintBuckets = new Map<HintKey, { matchedExamId: string | null }>()
  if (needsExams && recipe) {
    for (const c of recipe.components) {
      if (c.source !== "DERIVED_FROM_EXAM") continue
      const key: HintKey = c.examMatchHint ?? "__self__"
      if (hintBuckets.has(key)) continue
      const match = findExamByHint(c.examMatchHint, data.name, exams)
      hintBuckets.set(key, { matchedExamId: match?.id ?? null })
    }
  }

  // Academic-year scope: the new Exam must match the year's faculty. Same for
  // its assigned classes (Exam → faculty must equal selected classes' faculty,
  // or null for General).
  const ayForAuto = (needsExams && [...hintBuckets.values()].some(b => !b.matchedExamId))
    ? await prisma.academicYear.findFirst({
        where:  { id: data.academicYearId, schoolId: data.schoolId },
        select: { id: true, facultyId: true },
      })
    : null
  const autoClasses = (ayForAuto && data.classIds.length > 0)
    ? await prisma.class.findMany({
        where:  { id: { in: data.classIds }, schoolId: data.schoolId, facultyId: ayForAuto.facultyId },
        select: { id: true },
      })
    : []
  const autoClassIds = autoClasses.map(c => c.id)

  const ev = await prisma.$transaction(async tx => {
    const created = await tx.evaluation.create({
      data: {
        schoolId:       data.schoolId,
        academicYearId: data.academicYearId,
        name:           data.name,
        sequenceNumber: data.sequenceNumber,
        description:    data.description ?? null,
        isFinal,
        publishAt:      data.publishAt ? new Date(data.publishAt) : null,
      },
    })

    await tx.evaluationClass.createMany({
      data: data.classIds.map(classId => ({ evaluationId: created.id, classId })),
    })

    // Mint missing exams now so component seeding has ids to link to.
    if (needsExams && ayForAuto) {
      for (const [key, bucket] of hintBuckets) {
        if (bucket.matchedExamId) continue
        const newExam = await tx.exam.create({
          data: {
            schoolId:       data.schoolId,
            academicYearId: data.academicYearId,
            facultyId:      ayForAuto.facultyId,
            name:           hintNameMap[key],
          },
        })
        if (autoClassIds.length > 0) {
          await tx.examClass.createMany({
            data: autoClassIds.map(classId => ({ examId: newExam.id, classId })),
          })
        }
        bucket.matchedExamId = newExam.id
      }
    }

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
                  const linkedId = c.source === "DERIVED_FROM_EXAM"
                    ? hintBuckets.get(c.examMatchHint ?? "__self__")?.matchedExamId ?? null
                    : null
                  return {
                    part:           c.part,
                    label:          c.label,
                    maxMarks:       c.maxMarks,
                    orderIndex:     i,
                    source:         c.source,
                    sourceExamId:   linkedId,
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
  // If we may have auto-created Exams during seeding, refresh the exams listing too.
  if (needsExams) revalidatePath("/academics/exams")
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

// Clone an evaluation's schema (class set + SubjectEvaluations + components)
// into a new evaluation. Results / publishAt / isLocked are NOT carried over —
// the clone is a fresh draft you can reuse for the next sequence.
export async function cloneEvaluation(input: {
  schoolId:         string
  sourceId:         string
  newName:          string
  newSequenceNumber: number
  academicYearId?:  string  // defaults to source's year
  isFinal?:         boolean // defaults to source.isFinal
}): Promise<{ id: string }> {
  const src = await prisma.evaluation.findFirst({
    where: { id: input.sourceId, schoolId: input.schoolId },
    include: {
      evaluationClasses: { select: { classId: true } },
      subjectEvaluations: {
        include: { components: true },
      },
    },
  })
  if (!src) throw new Error("Source evaluation not found")

  const ay = await prisma.academicYear.findFirst({
    where:  { id: input.academicYearId ?? src.academicYearId, schoolId: input.schoolId },
    select: { id: true },
  })
  if (!ay) throw new Error("Target session not found")

  const created = await prisma.$transaction(async tx => {
    const ev = await tx.evaluation.create({
      data: {
        schoolId:       input.schoolId,
        academicYearId: ay.id,
        name:           input.newName,
        sequenceNumber: input.newSequenceNumber,
        description:    src.description,
        isFinal:        input.isFinal ?? src.isFinal,
      },
    })
    if (src.evaluationClasses.length > 0) {
      await tx.evaluationClass.createMany({
        data: src.evaluationClasses.map(c => ({ evaluationId: ev.id, classId: c.classId })),
      })
    }
    for (const se of src.subjectEvaluations) {
      await tx.subjectEvaluation.create({
        data: {
          evaluationId: ev.id,
          subjectId:    se.subjectId,
          internalMax:  se.internalMax,
          externalMax:  se.externalMax,
          orderIndex:   se.orderIndex,
          components: {
            create: se.components.map(c => ({
              part:           c.part,
              label:          c.label,
              maxMarks:       c.maxMarks,
              orderIndex:     c.orderIndex,
              source:         c.source,
              sourceExamId:   c.sourceExamId,
              sourceMaxMarks: c.sourceMaxMarks,
            })),
          },
        },
      })
    }
    return ev
  })
  revalidatePath("/academics/evaluations")
  return { id: created.id }
}

// Bulk publish/unpublish/lock/unlock. publishAt:"now" stamps Date.now();
// publishAt:"clear" sets null. Same shape for isLocked.
export async function bulkUpdateEvaluations(input: {
  schoolId:  string
  ids:       string[]
  publishAt?: "now" | "clear"
  isLocked?:  boolean
}): Promise<{ updated: number }> {
  if (input.ids.length === 0) return { updated: 0 }
  const owned = await prisma.evaluation.findMany({
    where:  { id: { in: input.ids }, schoolId: input.schoolId },
    select: { id: true },
  })
  if (owned.length === 0) return { updated: 0 }
  const ids = owned.map(o => o.id)
  const data: Record<string, unknown> = {}
  if (input.publishAt === "now")   data.publishAt = new Date()
  if (input.publishAt === "clear") data.publishAt = null
  if (input.isLocked !== undefined) data.isLocked = input.isLocked
  if (Object.keys(data).length === 0) return { updated: 0 }
  const res = await prisma.evaluation.updateMany({ where: { id: { in: ids } }, data })
  revalidatePath("/academics/evaluations")
  return { updated: res.count }
}

export async function bulkDeleteEvaluations(schoolId: string, ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 }
  const owned = await prisma.evaluation.findMany({
    where:  { id: { in: ids }, schoolId },
    select: { id: true },
  })
  if (owned.length === 0) return { deleted: 0 }
  const ownedIds = owned.map(o => o.id)
  const res = await prisma.evaluation.deleteMany({ where: { id: { in: ownedIds } } })
  revalidatePath("/academics/evaluations")
  return { deleted: res.count }
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
