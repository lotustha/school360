import { prisma } from "@/lib/prisma"
import { resolveGradingSettings } from "@/lib/grading-config"

export type ExamMarksSource = "EVALUATION" | "PAPER_OVERRIDE" | "DEFAULT"

export interface ResolvedExamMarks {
  fullMarks:   number
  passMarks:   number
  passPercent: number
  source:      ExamMarksSource
}

/**
 * Resolve the full + pass marks for a (exam, subject) pair using a single rule:
 *
 *   1. EvaluationComponent.sourceMaxMarks when an EvaluationComponent links this
 *      exam to this subject (source=DERIVED_FROM_EXAM, sourceExamId=examId).
 *      This is the configured-in-Evaluation source-of-truth.
 *   2. ExamPaper.fullMarks override when set (legacy / standalone exam path).
 *   3. Default to 100.
 *
 * passMarks is always derived from school.gradingSettings.passPercent so the
 * pass threshold is consistent across the system — never read from
 * ExamPaper.passMarks anymore.
 *
 * See Full_Marks_Unification_Plan.md §3.
 */
export async function resolveExamMarks(
  examId:    string,
  subjectId: string,
  schoolId:  string,
): Promise<ResolvedExamMarks> {
  const [school, components, paperTarget] = await Promise.all([
    prisma.school.findUnique({
      where:  { id: schoolId },
      select: { gradingSettings: true },
    }),
    prisma.evaluationComponent.findMany({
      where: {
        source:            "DERIVED_FROM_EXAM",
        sourceExamId:      examId,
        subjectEvaluation: { subjectId },
      },
      select: { sourceMaxMarks: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.examPaperTarget.findFirst({
      where:  { subjectId, paper: { examId, schoolId } },
      select: { paper: { select: { fullMarks: true } } },
    }),
  ])

  const grading = resolveGradingSettings(school?.gradingSettings ?? null)
  const passPercent = grading.passPercent

  // Step 1: Evaluation-linked component wins. If multiple components have
  // different sourceMaxMarks (mis-config), take the largest — a paper can't
  // be smaller than what any consumer thinks it is.
  const maxFromEval = components.reduce<number | null>((acc, c) => {
    const m = c.sourceMaxMarks
    if (m == null) return acc
    return acc === null || m > acc ? m : acc
  }, null)
  if (maxFromEval != null && maxFromEval > 0) {
    return {
      fullMarks:   maxFromEval,
      passMarks:   Math.ceil((maxFromEval * passPercent) / 100),
      passPercent,
      source:      "EVALUATION",
    }
  }

  // Step 2: ExamPaper.fullMarks fallback
  const fromPaper = paperTarget?.paper.fullMarks
  if (fromPaper != null && fromPaper > 0) {
    return {
      fullMarks:   fromPaper,
      passMarks:   Math.ceil((fromPaper * passPercent) / 100),
      passPercent,
      source:      "PAPER_OVERRIDE",
    }
  }

  // Step 3: Default
  const fullMarks = 100
  return {
    fullMarks,
    passMarks:   Math.ceil((fullMarks * passPercent) / 100),
    passPercent,
    source:      "DEFAULT",
  }
}

/**
 * Batched resolver for the report path: resolves marks for many subjects in
 * one exam without N+1 queries. Returns a map subjectId → ResolvedExamMarks.
 */
export async function resolveExamMarksBatch(
  examId:     string,
  subjectIds: string[],
  schoolId:   string,
): Promise<Map<string, ResolvedExamMarks>> {
  const out = new Map<string, ResolvedExamMarks>()
  if (subjectIds.length === 0) return out

  const [school, components, paperTargets] = await Promise.all([
    prisma.school.findUnique({
      where:  { id: schoolId },
      select: { gradingSettings: true },
    }),
    prisma.evaluationComponent.findMany({
      where: {
        source:            "DERIVED_FROM_EXAM",
        sourceExamId:      examId,
        subjectEvaluation: { subjectId: { in: subjectIds } },
      },
      select: {
        sourceMaxMarks:    true,
        createdAt:         true,
        subjectEvaluation: { select: { subjectId: true } },
      },
    }),
    prisma.examPaperTarget.findMany({
      where:  { subjectId: { in: subjectIds }, paper: { examId, schoolId } },
      select: { subjectId: true, paper: { select: { fullMarks: true } } },
    }),
  ])

  const grading = resolveGradingSettings(school?.gradingSettings ?? null)
  const passPercent = grading.passPercent

  // Group EvaluationComponent rows by subjectId, take max sourceMaxMarks per subject
  const maxBySubject = new Map<string, number>()
  for (const c of components) {
    const sid = c.subjectEvaluation.subjectId
    const m = c.sourceMaxMarks
    if (m == null) continue
    const prev = maxBySubject.get(sid)
    if (prev === undefined || m > prev) maxBySubject.set(sid, m)
  }

  const paperFullBySubject = new Map<string, number | null>()
  for (const t of paperTargets) {
    paperFullBySubject.set(t.subjectId, t.paper.fullMarks ?? null)
  }

  for (const sid of subjectIds) {
    const evalMax = maxBySubject.get(sid)
    if (evalMax != null && evalMax > 0) {
      out.set(sid, {
        fullMarks:   evalMax,
        passMarks:   Math.ceil((evalMax * passPercent) / 100),
        passPercent,
        source:      "EVALUATION",
      })
      continue
    }
    const paperMax = paperFullBySubject.get(sid)
    if (paperMax != null && paperMax > 0) {
      out.set(sid, {
        fullMarks:   paperMax,
        passMarks:   Math.ceil((paperMax * passPercent) / 100),
        passPercent,
        source:      "PAPER_OVERRIDE",
      })
      continue
    }
    const fullMarks = 100
    out.set(sid, {
      fullMarks,
      passMarks:   Math.ceil((fullMarks * passPercent) / 100),
      passPercent,
      source:      "DEFAULT",
    })
  }

  return out
}
