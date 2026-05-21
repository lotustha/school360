"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  calculateAttendanceMarks,
  DEFAULT_ATTENDANCE_BANDS,
  type AttendanceBand,
} from "@/lib/evaluation-frameworks"
import {
  resolveGradingSettings,
  type GradeRow,
} from "@/lib/grading-config"
import { isPillarPass } from "@/lib/format-marks"
import { resolveCreditHourSplit } from "@/lib/credit-hours"
import { toBS } from "@/lib/nepali-date"
import { resolveGradeFromPercent as _resolveGradeFromPercent, gradePart, mapGpaToGrade } from "@/lib/grade-compute"
import { buildEnrollmentMap } from "@/lib/subject-enrollment"

// ─── Bulk attendance computation (ported from removed marks.ts) ─────────────

export async function computeBulkAttendanceMarks(args: {
  studentIds: string[]   // Student.id
  schoolId:   string
  fromBS:     string
  toBS:       string
  maxMarks:   number
  bands?:     AttendanceBand[]
}): Promise<Record<string, number>> {
  const records = await prisma.attendance.findMany({
    where: {
      schoolId:  args.schoolId,
      studentId: { in: args.studentIds },
      dateBS:    { gte: args.fromBS, lte: args.toBS },
    },
    select: { studentId: true, status: true },
  })

  const grouped: Record<string, { total: number; present: number }> = {}
  for (const sid of args.studentIds) grouped[sid] = { total: 0, present: 0 }
  for (const r of records) {
    if (!grouped[r.studentId]) continue
    grouped[r.studentId].total += 1
    if (r.status === "PRESENT" || r.status === "LATE") grouped[r.studentId].present += 1
  }

  const bands = args.bands ?? DEFAULT_ATTENDANCE_BANDS
  const out: Record<string, number> = {}
  for (const [sid, { total, present }] of Object.entries(grouped)) {
    out[sid] = calculateAttendanceMarks(present, total, bands, args.maxMarks).marks
  }
  return out
}

// ─── Grade resolution ───────────────────────────────────────────────────────

function resolveGradeFromPercent(percent: number, scale: GradeRow[]): { grade: string; gpa: number } {
  const row = _resolveGradeFromPercent(percent, scale)
  return { grade: row.grade, gpa: row.gpa }
}

// ─── Compute a single SubjectEvaluationResult ───────────────────────────────

export async function computeSubjectEvaluationResult(args: {
  subjectEvaluationId: string
  studentId:           string   // Student.id
}) {
  const se = await prisma.subjectEvaluation.findUnique({
    where: { id: args.subjectEvaluationId },
    include: {
      components: {
        include: { sourceExam: { select: { id: true, name: true } } },
        orderBy: [{ part: "asc" }, { orderIndex: "asc" }],
      },
      evaluation: { select: { schoolId: true, classId: true, academicYearId: true } },
      subject:    { select: { id: true, creditHours: true, internalCreditHours: true, externalCreditHours: true } },
    },
  })
  if (!se) throw new Error("SubjectEvaluation not found")

  // Per-year CH override (NEB weightages can change year over year). Reads
  // from SubjectAcademicYearStatus; falls back to Subject.creditHours pro-rated
  // by max-marks ratio inside resolveCreditHourSplit.
  const yearConfig = await prisma.subjectAcademicYearStatus.findUnique({
    where: {
      subjectId_academicYearId: {
        subjectId:      se.subject.id,
        academicYearId: se.evaluation.academicYearId,
      },
    },
    select: { creditHours: true, internalCreditHours: true, externalCreditHours: true },
  })

  // School grading scale (normalized — fills in NEB defaults for any missing fields)
  const school = await prisma.school.findUnique({
    where:  { id: se.evaluation.schoolId },
    select: { gradingSettings: true },
  })
  const settings = resolveGradingSettings(school?.gradingSettings)
  const scale    = settings.scale

  // Walk components, compute each one's score for this student
  let internalObtained = 0
  let externalObtained = 0
  let internalFull     = 0
  let externalFull     = 0
  let anyAbsent        = false

  for (const c of se.components) {
    if (c.part === "INTERNAL") internalFull += c.maxMarks
    else                       externalFull += c.maxMarks

    let score = 0

    if (c.source === "MANUAL") {
      const mark = await prisma.evaluationComponentMark.findUnique({
        where: { componentId_studentId: { componentId: c.id, studentId: args.studentId } },
      })
      if (mark?.isAbsent) { anyAbsent = true; score = 0 }
      else                 score = mark?.score ?? 0
    }
    else if (c.source === "ATTENDANCE") {
      // Check for teacher override first
      const override = await prisma.evaluationComponentMark.findUnique({
        where: { componentId_studentId: { componentId: c.id, studentId: args.studentId } },
      })
      if (override?.isOverride) {
        if (override.isAbsent) { anyAbsent = true; score = 0 }
        else                    score = override.score ?? 0
      } else {
        // Auto-compute from attendance records
        const fromBS = c.attendanceFromDate ? toBS(c.attendanceFromDate) : "2080-01-01"
        const toBSStr = c.attendanceToDate   ? toBS(c.attendanceToDate)   : "2099-12-30"
        const map = await computeBulkAttendanceMarks({
          studentIds: [args.studentId],
          schoolId:   se.evaluation.schoolId,
          fromBS,
          toBS:       toBSStr,
          maxMarks:   c.maxMarks,
        })
        score = map[args.studentId] ?? 0
      }
    }
    else if (c.source === "DERIVED_FROM_EXAM" && c.sourceExamId && c.sourceMaxMarks && c.sourceMaxMarks > 0) {
      const raw = await prisma.terminalExamScore.findUnique({
        where: {
          examId_studentId_subjectId: {
            examId:    c.sourceExamId,
            studentId: args.studentId,
            subjectId: se.subject.id,
          },
        },
      })
      if (raw?.isAbsent) { anyAbsent = true; score = 0 }
      else if (raw?.rawScore != null) {
        score = (raw.rawScore / c.sourceMaxMarks) * c.maxMarks
      }
    }

    if (c.part === "INTERNAL") internalObtained += score
    else                       externalObtained += score
  }

  const totalObtained = internalObtained + externalObtained
  const totalFull     = internalFull + externalFull
  const percentage    = totalFull > 0 ? (totalObtained / totalFull) * 100 : 0

  // NEB: BOTH pillars must independently clear their own threshold.
  // - Internal/Practical: ≥ settings.internalPassPercent (default 40)
  // - External/Theory:    ≥ settings.externalPassPercent (default 35)
  // The grace policy rounds the obtained mark before comparing.
  const internalPass = isPillarPass(
    internalObtained, internalFull,
    settings.internalPassPercent, settings.passMarkGracePolicy,
  )
  const externalPass = isPillarPass(
    externalObtained, externalFull,
    settings.externalPassPercent, settings.passMarkGracePolicy,
  )

  let status: string =
    totalFull === 0                          ? "INCOMPLETE" :
    anyAbsent && totalObtained === 0          ? "ABSENT"      :
    (!internalPass || !externalPass)          ? "FAIL"        : "PASS"

  // NEB subject GP is credit-hour-weighted across the two pillars, NOT derived
  // from total percentage. When CH split is unavailable (creditHours unset
  // and no year config), fall back to percentage-based grade as before.
  const inPart  = gradePart(internalObtained, internalFull, scale)
  const exPart  = gradePart(externalObtained, externalFull, scale)
  const split   = resolveCreditHourSplit(
    {
      creditHours:         se.subject.creditHours,
      internalCreditHours: se.subject.internalCreditHours,
      externalCreditHours: se.subject.externalCreditHours,
    },
    yearConfig,
    internalFull, externalFull,
  )
  let grade: string
  let gpa:   number
  if (split.total > 0) {
    gpa   = (inPart.gpa * split.internal + exPart.gpa * split.external) / split.total
    grade = mapGpaToGrade(gpa, scale).grade
  } else {
    const fb = resolveGradeFromPercent(percentage, scale)
    grade = fb.grade
    gpa   = fb.gpa
  }
  // If either pillar's per-part grade is NG, the subject fails — pillar
  // thresholds may be below the NG cutoff in some grading scales, so we have to
  // double-check the bands too.
  if (status === "PASS" && (inPart.grade === "NG" || exPart.grade === "NG" || grade === "NG")) {
    status = "FAIL"
  }
  // NEB convention: failing students get NG regardless of computed GP.
  if (status === "FAIL" || status === "ABSENT") {
    grade = "NG"
    gpa   = 0
  }

  return prisma.subjectEvaluationResult.upsert({
    where: {
      subjectEvaluationId_studentId: {
        subjectEvaluationId: args.subjectEvaluationId,
        studentId:           args.studentId,
      },
    },
    create: {
      subjectEvaluationId: args.subjectEvaluationId,
      studentId:           args.studentId,
      internalObtained:    round2(internalObtained),
      externalObtained:    round2(externalObtained),
      totalObtained:       round2(totalObtained),
      totalFull,
      percentage:          round2(percentage),
      grade,
      gpa:                 round2(gpa),
      status,
    },
    update: {
      internalObtained: round2(internalObtained),
      externalObtained: round2(externalObtained),
      totalObtained:    round2(totalObtained),
      totalFull,
      percentage:       round2(percentage),
      grade,
      gpa:              round2(gpa),
      status,
      computedAt:       new Date(),
    },
  })
}

// ─── Bulk: recompute all students for one SubjectEvaluation ────────────────

export async function bulkComputeSubjectEvaluation(subjectEvaluationId: string) {
  // The SubjectEvaluation's subject is per-class, so its students are that class's students.
  const se = await prisma.subjectEvaluation.findUnique({
    where:  { id: subjectEvaluationId },
    select: { subject: { select: { classId: true } } },
  })
  if (!se) throw new Error("SubjectEvaluation not found")

  const students = await prisma.student.findMany({
    where:  { classId: se.subject.classId, status: "ACTIVE" },
    select: { id: true },
  })

  for (const s of students) {
    await computeSubjectEvaluationResult({ subjectEvaluationId, studentId: s.id })
  }
  revalidatePath(`/academics/evaluations`)
  return { recomputed: students.length }
}

// ─── Bulk: recompute everything for an Evaluation ──────────────────────────

export async function bulkComputeEvaluation(evaluationId: string) {
  const subjects = await prisma.subjectEvaluation.findMany({
    where:  { evaluationId },
    select: { id: true },
  })
  let total = 0
  for (const s of subjects) {
    const res = await bulkComputeSubjectEvaluation(s.id)
    total += res.recomputed
  }
  revalidatePath(`/academics/evaluations/${evaluationId}`)
  return { recomputed: total, subjects: subjects.length }
}

// ─── Get results for the detail page ───────────────────────────────────────

export async function getSubjectEvaluationResults(subjectEvaluationId: string) {
  return prisma.subjectEvaluationResult.findMany({
    where:   { subjectEvaluationId },
    include: { student: { include: { user: { select: { fullName: true } } } } },
    orderBy: [{ totalObtained: "desc" }, { student: { admissionNo: "asc" } }],
  })
}

// ─── Ledger: per-class marks register across all evaluations in a year ─────

export type LedgerCell = {
  totalObtained:    number
  totalFull:        number
  percentage:       number
  grade:            string | null
  gpa:              number | null
  status:           string   // PASS | FAIL | ABSENT | INCOMPLETE
  /** Per-part rollups so the ledger can render IN / EX / FGL letters or marks. */
  internalObtained: number
  internalMax:      number
  externalObtained: number
  externalMax:      number
  internalGrade:    string | null
  externalGrade:    string | null
}

export type LedgerSubject = {
  subjectEvaluationId: string
  subjectId:           string
  subjectName:         string
  subjectCode:         string
  subjectType:         "REGULAR" | "OPTIONAL" | "EXTRA"
  internalMax:         number
  externalMax:         number
  fullMarks:           number
}

export type LedgerEvaluation = {
  id:             string
  name:           string
  sequenceNumber: number
  isFinal:        boolean
  subjects:       LedgerSubject[]
}

export type LedgerStudent = {
  id:           string
  admissionNo:  string
  rollNumber:   string | null
  symbolNumber: string | null
  fullName:     string
  sectionName:  string | null
  /** Weighted GPA across all subjects this student has results for (null if none). */
  gpa:          number | null
}

export type ClassLedger = {
  className:    string
  yearName:     string
  students:     LedgerStudent[]
  evaluations:  LedgerEvaluation[]
  /** map keyed by `${studentId}::${subjectEvaluationId}` → cell. Sparse — missing keys mean no result row. */
  cells:        Record<string, LedgerCell>
  /** map keyed by `${studentId}::${subjectId}` → true when the student opted out
   *  of that OPTIONAL subject. Empty entries mean the student is enrolled. */
  optedOut:     Record<string, boolean>
  /** map keyed by studentId → true when the student failed any GPA-counted
   *  pillar within the scope set by `gradingSettings.aggregateNGScope`. Used
   *  to render "NG" in place of the aggregate GPA. */
  anyFail:      Record<string, boolean>
}

export async function getClassLedger(args: {
  schoolId:       string
  classId:        string
  academicYearId: string
}): Promise<ClassLedger> {
  const [cls, year, school, students, evaluations] = await Promise.all([
    prisma.class.findFirst({
      where:  { id: args.classId, schoolId: args.schoolId },
      select: { id: true, name: true },
    }),
    prisma.academicYear.findFirst({
      where:  { id: args.academicYearId, schoolId: args.schoolId },
      select: { id: true, name: true },
    }),
    prisma.school.findUnique({
      where:  { id: args.schoolId },
      select: { gradingSettings: true },
    }),
    prisma.student.findMany({
      where: { schoolId: args.schoolId, classId: args.classId, status: "ACTIVE" },
      include: {
        user:    { select: { fullName: true } },
        section: { select: { name: true } },
      },
      orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
    }),
    prisma.evaluation.findMany({
      where: {
        schoolId:       args.schoolId,
        academicYearId: args.academicYearId,
        evaluationClasses: { some: { classId: args.classId } },
      },
      include: {
        subjectEvaluations: {
          where:   { subject: { classId: args.classId } },
          include: {
            subject: { select: { id: true, name: true, code: true, type: true, creditHours: true, internalCreditHours: true, externalCreditHours: true } },
            results: true,
          },
          orderBy: { subject: { name: "asc" } },
        },
      },
      orderBy: { sequenceNumber: "asc" },
    }),
  ])

  if (!cls)  throw new Error("Class not found")
  if (!year) throw new Error("Academic year not found")

  // Per-(student, subject) opt-out map — derived from SubjectEnrollment.
  // REGULAR subjects are never opted out (every class student is implicitly
  // enrolled). OPTIONAL/EXTRA in a SubjectGroup are opted out for any student
  // NOT in the SubjectEnrollment set for this year.
  const subjectIdsThisYear = Array.from(new Set(
    evaluations.flatMap(ev => ev.subjectEvaluations.map(se => se.subjectId)),
  ))
  const enrollmentMap = await buildEnrollmentMap(subjectIdsThisYear, args.academicYearId)
  const subjectTypeById = new Map<string, "REGULAR" | "OPTIONAL" | "EXTRA">()
  for (const ev of evaluations) {
    for (const se of ev.subjectEvaluations) {
      subjectTypeById.set(se.subjectId, se.subject.type)
    }
  }
  const optedOut: Record<string, boolean> = {}
  for (const subjectId of subjectIdsThisYear) {
    if (subjectTypeById.get(subjectId) === "REGULAR") continue
    const enrolledSet = enrollmentMap.get(subjectId)
    if (!enrolledSet) continue   // no map entry → fall back to permissive
    for (const stu of students) {
      if (!enrolledSet.has(stu.id)) {
        optedOut[`${stu.id}::${subjectId}`] = true
      }
    }
  }
  const yearConfigRows = subjectIdsThisYear.length > 0
    ? await prisma.subjectAcademicYearStatus.findMany({
        where: {
          subjectId:      { in: subjectIdsThisYear },
          academicYearId: args.academicYearId,
        },
        select: {
          subjectId:           true,
          creditHours:         true,
          internalCreditHours: true,
          externalCreditHours: true,
        },
      })
    : []
  const yearConfigBySubject = new Map(yearConfigRows.map(r => [r.subjectId, r]))

  // School grading scale (used to derive per-part letters in each ledger cell)
  const settings = resolveGradingSettings(school?.gradingSettings)
  const scale    = settings.scale

  // Determine which evaluation IDs count toward the per-student aggregate NG.
  // Default 'allEvaluations': any pillar failure anywhere → student.gpa = null + NG badge.
  const sortedEvaluations = [...evaluations].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  const latestEvaluationId = sortedEvaluations.length > 0
    ? sortedEvaluations[sortedEvaluations.length - 1].id
    : null
  const evaluationCountsForNG = (evalId: string, isFinal: boolean): boolean => {
    switch (settings.aggregateNGScope) {
      case "isFinalOnly": return isFinal
      case "latestOnly":  return evalId === latestEvaluationId
      case "allEvaluations":
      default:            return true
    }
  }

  const ledgerEvaluations: LedgerEvaluation[] = evaluations.map(ev => ({
    id:             ev.id,
    name:           ev.name,
    sequenceNumber: ev.sequenceNumber,
    isFinal:        ev.isFinal,
    subjects: ev.subjectEvaluations.map(se => ({
      subjectEvaluationId: se.id,
      subjectId:           se.subjectId,
      subjectName:         se.subject.name,
      subjectCode:         se.subject.code,
      subjectType:         se.subject.type,
      internalMax:         se.internalMax,
      externalMax:         se.externalMax,
      fullMarks:           se.internalMax + se.externalMax,
    })),
  }))

  // Map subjectEvaluationId → (internalMax, externalMax) so we can compute per-part
  // grades on the fly. Result rows store *aggregated* internal/external obtained.
  const seMaxById = new Map<string, { internalMax: number; externalMax: number }>()
  for (const ev of evaluations) {
    for (const se of ev.subjectEvaluations) {
      seMaxById.set(se.id, { internalMax: se.internalMax, externalMax: se.externalMax })
    }
  }

  const cells: Record<string, LedgerCell> = {}
  // Per-student CH-weighted GPA accumulator (NEB).
  //   weightedGp = Σ (cellGpa × subjectCH)
  //   chWeight   = Σ subjectCH
  //   aggregate  = weightedGp / chWeight
  // The same subject appears in multiple evaluations — each contributes its
  // own CH worth of weight, so the result averages across evaluations.
  const studentGpWeighted = new Map<string, number>()
  const studentChWeight   = new Map<string, number>()
  // Per-student NG flag: true if any GPA-counted pillar failed within the
  // configured aggregate scope.
  const studentAnyFail    = new Map<string, boolean>()

  for (const ev of evaluations) {
    const inNGScope = evaluationCountsForNG(ev.id, ev.isFinal)
    for (const se of ev.subjectEvaluations) {
      const maxes = seMaxById.get(se.id) ?? { internalMax: 0, externalMax: 0 }
      const subjType = se.subject.type
      const yearCfg  = yearConfigBySubject.get(se.subjectId) ?? null
      const split    = resolveCreditHourSplit(
        {
          creditHours:         se.subject.creditHours,
          internalCreditHours: se.subject.internalCreditHours,
          externalCreditHours: se.subject.externalCreditHours,
        },
        yearCfg,
        maxes.internalMax, maxes.externalMax,
      )
      const subjectCh = split.total
      for (const r of se.results) {
        const internalPart = gradePart(r.internalObtained, maxes.internalMax, scale)
        const externalPart = gradePart(r.externalObtained, maxes.externalMax, scale)
        cells[`${r.studentId}::${se.id}`] = {
          totalObtained:    r.totalObtained,
          totalFull:        r.totalFull,
          percentage:       r.percentage,
          grade:            r.grade,
          gpa:              r.gpa,
          status:           r.status,
          internalObtained: r.internalObtained,
          internalMax:      maxes.internalMax,
          externalObtained: r.externalObtained,
          externalMax:      maxes.externalMax,
          internalGrade:    maxes.internalMax > 0 ? internalPart.grade : null,
          externalGrade:    maxes.externalMax > 0 ? externalPart.grade : null,
        }
        // GPA contribution rules:
        //   - EXTRA subjects are excluded.
        //   - OPTIONAL subjects opted out by this student are excluded.
        const optedOutKey = `${r.studentId}::${se.subjectId}`
        const skipGpa = subjType === "EXTRA"
          || (subjType === "OPTIONAL" && optedOut[optedOutKey])
        if (!skipGpa && typeof r.gpa === "number" && subjectCh > 0) {
          studentGpWeighted.set(r.studentId, (studentGpWeighted.get(r.studentId) ?? 0) + r.gpa * subjectCh)
          studentChWeight  .set(r.studentId, (studentChWeight  .get(r.studentId) ?? 0) + subjectCh)
        }
        // Mark aggregate NG when a GPA-counted subject failed inside the scope.
        // Also trip on a stored NG grade so the ledger is correct even when the
        // result row pre-dates the latest compute-status fix (no need to wait
        // for a full Recompute Results pass).
        if (
          inNGScope && !skipGpa &&
          (r.status === "FAIL" || r.status === "ABSENT" || r.grade === "NG")
        ) {
          studentAnyFail.set(r.studentId, true)
        }
      }
    }
  }

  const anyFail: Record<string, boolean> = {}
  for (const [sid, v] of studentAnyFail) if (v) anyFail[sid] = true

  return {
    className:   cls.name,
    yearName:    year.name,
    students:    students.map(s => {
      const wgp    = studentGpWeighted.get(s.id) ?? 0
      const wgh    = studentChWeight  .get(s.id) ?? 0
      const failed = anyFail[s.id] === true
      return {
        id:           s.id,
        admissionNo:  s.admissionNo,
        rollNumber:   s.rollNumber,
        symbolNumber: s.symbolNumber,
        fullName:     s.user.fullName,
        sectionName:  s.section?.name ?? null,
        // CH-weighted aggregate. null when the student has no results OR was
        // flagged NG in scope. Consumers should display "NG" when
        // `anyFail[s.id]` is true and the student has results; "—" otherwise.
        gpa:          failed ? null : (wgh > 0 ? round2(wgp / wgh) : null),
      }
    }),
    evaluations: ledgerEvaluations,
    cells,
    optedOut,
    anyFail,
  }
}

// ─── Ledger: per-student academic record across the year ──────────────────

export type StudentLedgerCell = LedgerCell

export type StudentLedgerSubject = {
  subjectId:    string
  subjectName:  string
  subjectCode:  string
  /** keyed by evaluationId */
  byEvaluation: Record<string, StudentLedgerCell>
  /** rollup across all evaluations the student has results for */
  yearObtained: number
  yearFull:     number
  yearPercent:  number | null
}

export type StudentLedger = {
  student: {
    id:           string
    admissionNo:  string
    rollNumber:   string | null
    fullName:     string
    sectionName:  string | null
    className:    string
    photoUrl:     string | null
    symbolNumber: string | null
  }
  yearName:    string
  evaluations: { id: string; name: string; sequenceNumber: number; isFinal: boolean }[]
  subjects:    StudentLedgerSubject[]
  /** Cumulative across all evaluations */
  totalObtained: number
  totalFull:     number
  yearPercent:   number | null
  /** True when this student failed any GPA-counted pillar in the configured
   *  aggregateNGScope. Consumers should render "NG" instead of any GPA value. */
  anyFail:       boolean
}

export async function getStudentLedger(args: {
  schoolId:       string
  studentId:      string
  academicYearId: string
}): Promise<StudentLedger> {
  const student = await prisma.student.findFirst({
    where:  { id: args.studentId, schoolId: args.schoolId },
    include: {
      user:    { select: { fullName: true, avatarUrl: true } },
      class:   { select: { id: true, name: true } },
      section: { select: { name: true } },
    },
  })
  if (!student) throw new Error("Student not found")

  const [year, school, evaluations] = await Promise.all([
    prisma.academicYear.findFirst({
      where:  { id: args.academicYearId, schoolId: args.schoolId },
      select: { name: true },
    }),
    prisma.school.findUnique({
      where:  { id: args.schoolId },
      select: { gradingSettings: true },
    }),
    prisma.evaluation.findMany({
      where: {
        schoolId:       args.schoolId,
        academicYearId: args.academicYearId,
        evaluationClasses: { some: { classId: student.classId } },
      },
      include: {
        subjectEvaluations: {
          where:   { subject: { classId: student.classId } },
          include: {
            subject: { select: { id: true, name: true, code: true } },
            results: { where: { studentId: args.studentId } },
          },
          orderBy: { subject: { name: "asc" } },
        },
      },
      orderBy: { sequenceNumber: "asc" },
    }),
  ])
  if (!year) throw new Error("Academic year not found")

  const sl_settings = resolveGradingSettings(school?.gradingSettings)
  const sl_scale    = sl_settings.scale

  // Determine scope for the anyFail flag.
  const sl_sorted          = [...evaluations].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  const sl_latestEvalId    = sl_sorted.length > 0 ? sl_sorted[sl_sorted.length - 1].id : null
  const sl_inNGScope       = (evalId: string, isFinal: boolean): boolean => {
    switch (sl_settings.aggregateNGScope) {
      case "isFinalOnly": return isFinal
      case "latestOnly":  return evalId === sl_latestEvalId
      case "allEvaluations":
      default:            return true
    }
  }
  let anyFail = false

  // Group by subjectId across evaluations
  const subjectMap = new Map<string, StudentLedgerSubject>()
  for (const ev of evaluations) {
    const inScope = sl_inNGScope(ev.id, ev.isFinal)
    for (const se of ev.subjectEvaluations) {
      const sId = se.subjectId
      let row = subjectMap.get(sId)
      if (!row) {
        row = {
          subjectId:    sId,
          subjectName:  se.subject.name,
          subjectCode:  se.subject.code,
          byEvaluation: {},
          yearObtained: 0,
          yearFull:     0,
          yearPercent:  null,
        }
        subjectMap.set(sId, row)
      }
      const r = se.results[0]
      if (r) {
        const internalPart = gradePart(r.internalObtained, se.internalMax, sl_scale)
        const externalPart = gradePart(r.externalObtained, se.externalMax, sl_scale)
        row.byEvaluation[ev.id] = {
          totalObtained:    r.totalObtained,
          totalFull:        r.totalFull,
          percentage:       r.percentage,
          grade:            r.grade,
          gpa:              r.gpa,
          status:           r.status,
          internalObtained: r.internalObtained,
          internalMax:      se.internalMax,
          externalObtained: r.externalObtained,
          externalMax:      se.externalMax,
          internalGrade:    se.internalMax > 0 ? internalPart.grade : null,
          externalGrade:    se.externalMax > 0 ? externalPart.grade : null,
        }
        row.yearObtained += r.totalObtained
        row.yearFull     += r.totalFull
        if (inScope && (r.status === "FAIL" || r.status === "ABSENT")) {
          anyFail = true
        }
      }
    }
  }
  for (const row of subjectMap.values()) {
    row.yearPercent = row.yearFull > 0 ? Math.round((row.yearObtained / row.yearFull) * 10000) / 100 : null
  }

  const subjects = [...subjectMap.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName))
  const totalObtained = subjects.reduce((s, r) => s + r.yearObtained, 0)
  const totalFull     = subjects.reduce((s, r) => s + r.yearFull, 0)
  const yearPercent   = totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000) / 100 : null

  return {
    student: {
      id:           student.id,
      admissionNo:  student.admissionNo,
      rollNumber:   student.rollNumber,
      fullName:     student.user.fullName,
      sectionName:  student.section?.name ?? null,
      className:    student.class.name,
      photoUrl:     student.user.avatarUrl,
      symbolNumber: student.symbolNumber,
    },
    yearName:    year.name,
    evaluations: evaluations.map(e => ({
      id:             e.id,
      name:           e.name,
      sequenceNumber: e.sequenceNumber,
      isFinal:        e.isFinal,
    })),
    subjects,
    totalObtained: round2(totalObtained),
    totalFull,
    yearPercent,
    anyFail,
  }
}

// ─── Transcript: NEB-style gradesheet for a single (student × evaluation) ─

export type TranscriptSubjectRow = {
  subjectId:        string
  subjectName:      string
  subjectCode:      string
  subjectType:      "REGULAR" | "OPTIONAL" | "EXTRA"
  creditHours:      number | null
  fullMarks:        number
  passMarks:        number
  obtainedMarks:    number
  grade:            string | null
  gpa:              number | null
  status:           string   // PASS | FAIL | ABSENT | INCOMPLETE
  remarks:          string | null

  // ── Per-part split for the Final-evaluation template ───────────────────
  internalMax:      number
  externalMax:      number
  internalObtained: number
  externalObtained: number
  /** Credit hour shares between theory (TH) and internal (IN), pro-rated by max-mark weights. */
  chTh:             number | null
  chIn:             number | null
  /** Letter grade + GP for each part (null when that part has no max). */
  thGrade:          string | null
  thGpa:            number | null
  inGrade:          string | null
  inGpa:            number | null
}

export type Transcript = {
  school: {
    name:    string
    address: string | null
    phone:   string | null
    logoUrl: string | null
  }
  student: {
    id:           string
    fullName:     string
    fullNameNepali: string | null
    admissionNo:  string
    rollNumber:   string | null
    symbolNumber: string | null
    className:    string
    sectionName:  string | null
    dobBS:        string | null
    photoUrl:     string | null
  }
  evaluation: {
    id:             string
    name:           string
    sequenceNumber: number
    isFinal:        boolean
    yearName:       string
    publishAt:      Date | null
  }
  subjects:       TranscriptSubjectRow[]
  totalFull:      number
  totalObtained:  number
  percentage:     number | null
  overallGrade:   string | null
  overallGpa:     number | null
  result:         "PASS" | "FAIL" | "INCOMPLETE"
  gradingScale:   GradeRow[]
  passPercent:    number
}

export async function getStudentTranscript(args: {
  schoolId:     string
  studentId:    string
  evaluationId: string
}): Promise<Transcript> {
  const [school, student, evaluation] = await Promise.all([
    prisma.school.findUnique({
      where:  { id: args.schoolId },
      select: { name: true, address: true, phone: true, logoUrl: true, gradingSettings: true },
    }),
    prisma.student.findFirst({
      where:  { id: args.studentId, schoolId: args.schoolId },
      include: {
        user:    { select: { fullName: true, avatarUrl: true } },
        class:   { select: { id: true, name: true } },
        section: { select: { name: true } },
      },
    }),
    prisma.evaluation.findFirst({
      where:  { id: args.evaluationId, schoolId: args.schoolId },
      select: {
        id:             true,
        name:           true,
        sequenceNumber: true,
        isFinal:        true,
        publishAt:      true,
        academicYearId: true,
        academicYear:   { select: { name: true } },
      },
    }),
  ])
  if (!school)     throw new Error("School not found")
  if (!student)    throw new Error("Student not found")
  if (!evaluation) throw new Error("Evaluation not found")

  // Subject evaluations scoped to this student's class only.
  const subjectEvaluations = await prisma.subjectEvaluation.findMany({
    where: {
      evaluationId: args.evaluationId,
      subject:      { classId: student.class.id },
    },
    include: {
      subject: { select: { id: true, name: true, code: true, creditHours: true, internalCreditHours: true, externalCreditHours: true, type: true } },
      results: { where: { studentId: args.studentId } },
    },
    orderBy: { subject: { name: "asc" } },
  })

  // Per-year credit-hour config for every subject on the transcript, batched.
  const yearConfigRows = await prisma.subjectAcademicYearStatus.findMany({
    where: {
      subjectId:      { in: subjectEvaluations.map(se => se.subjectId) },
      academicYearId: evaluation.academicYearId,
    },
    select: {
      subjectId:           true,
      creditHours:         true,
      internalCreditHours: true,
      externalCreditHours: true,
    },
  })
  const yearConfigBySubject = new Map(yearConfigRows.map(r => [r.subjectId, r]))

  // Resolve real enrollment via SubjectEnrollment (mirrors getClassLedger).
  // OPTIONAL/EXTRA subjects the student didn't enroll in are dropped from the
  // transcript entirely so the gradesheet only shows what the student actually
  // takes. REGULAR subjects are always considered enrolled.
  const enrollmentMap = await buildEnrollmentMap(
    subjectEvaluations.map(se => se.subjectId),
    evaluation.academicYearId,
  )
  const optedOutSet = new Set<string>()
  for (const se of subjectEvaluations) {
    if (se.subject.type === "REGULAR") continue
    const enrolled = enrollmentMap.get(se.subjectId)
    if (enrolled && !enrolled.has(args.studentId)) optedOutSet.add(se.subjectId)
  }

  const settings     = resolveGradingSettings(school.gradingSettings)
  const gradingScale = settings.scale
  const passPercent  = settings.passPercent

  // Drop OPTIONAL subjects the student didn't pick — they shouldn't appear on
  // the gradesheet at all (not in the main table, not in Extra Subjects).
  const enrolledSubjectEvaluations = subjectEvaluations.filter(se =>
    !(se.subject.type === "OPTIONAL" && optedOutSet.has(se.subjectId)),
  )

  const subjects: TranscriptSubjectRow[] = enrolledSubjectEvaluations.map(se => {
    const r            = se.results[0]
    const fullMarks    = se.internalMax + se.externalMax
    const passMarks    = Math.ceil((fullMarks * passPercent) / 100)
    const internalObt  = r?.internalObtained ?? 0
    const externalObt  = r?.externalObtained ?? 0
    const internalPart = gradePart(internalObt, se.internalMax, gradingScale)
    const externalPart = gradePart(externalObt, se.externalMax, gradingScale)
    // CH split between TH (external) and IN (internal). Uses per-year config
    // when present, falls back to Subject.creditHours pro-rated by max-marks.
    const yearCfg = yearConfigBySubject.get(se.subjectId) ?? null
    const split   = resolveCreditHourSplit(
      {
        creditHours:         se.subject.creditHours,
        internalCreditHours: se.subject.internalCreditHours,
        externalCreditHours: se.subject.externalCreditHours,
      },
      yearCfg,
      se.internalMax, se.externalMax,
    )
    const chIn    = split.total > 0 ? split.internal : null
    const chTh    = split.total > 0 ? split.external : null
    const ch      = split.total > 0 ? split.total    : se.subject.creditHours
    return {
      subjectId:    se.subjectId,
      subjectName:  se.subject.name,
      subjectCode:  se.subject.code,
      subjectType:  se.subject.type,
      creditHours:  ch,
      fullMarks,
      passMarks,
      obtainedMarks: r?.totalObtained ?? 0,
      grade:        r?.grade ?? null,
      gpa:          r?.gpa ?? null,
      status:       r?.status ?? "INCOMPLETE",
      remarks:      r?.remarks ?? null,
      internalMax:      se.internalMax,
      externalMax:      se.externalMax,
      internalObtained: internalObt,
      externalObtained: externalObt,
      chTh,
      chIn,
      thGrade:  se.externalMax > 0 ? externalPart.grade : null,
      thGpa:    se.externalMax > 0 ? externalPart.gpa   : null,
      inGrade:  se.internalMax > 0 ? internalPart.grade : null,
      inGpa:    se.internalMax > 0 ? internalPart.gpa   : null,
    }
  })

  // GPA rollup excludes EXTRA subjects. OPTIONAL opt-outs are already removed
  // from `subjects` above.
  const gpaSubjects = subjects.filter(r => r.subjectType !== "EXTRA")
  const totalFull     = gpaSubjects.reduce((s, r) => s + r.fullMarks, 0)
  const totalObtained = gpaSubjects.reduce((s, r) => s + r.obtainedMarks, 0)
  const percentage    = totalFull > 0 ? Math.round((totalObtained / totalFull) * 10000) / 100 : null

  // NEB annual GPA: credit-hour-weighted across gpa-eligible subjects.
  //   annualGpa = Σ (subjectGPA × subjectCH) / Σ subjectCH
  // Falls back to percentage-based grade when no subject has CH configured.
  let totalChWeight  = 0
  let totalGpWeighted = 0
  for (const r of gpaSubjects) {
    const subjectCh = (r.chIn ?? 0) + (r.chTh ?? 0)
    if (r.gpa !== null && subjectCh > 0) {
      totalGpWeighted += r.gpa * subjectCh
      totalChWeight   += subjectCh
    }
  }
  const weightedGpa = totalChWeight > 0
    ? round2(totalGpWeighted / totalChWeight)
    : null
  const weightedGrade = weightedGpa !== null
    ? mapGpaToGrade(weightedGpa, gradingScale).grade
    : (percentage !== null ? resolveGradeFromPercent(percentage, gradingScale).grade : null)

  const hasIncomplete = gpaSubjects.some(r => r.status === "INCOMPLETE")
  // Trip on stored "NG" grade too — covers result rows that pre-date the
  // status-NG fix (status may say PASS while the grade letter is NG).
  const anyFail       = gpaSubjects.some(r =>
    r.status === "FAIL" || r.status === "ABSENT" || r.grade === "NG"
  )
  const result: "PASS" | "FAIL" | "INCOMPLETE" =
    hasIncomplete ? "INCOMPLETE" :
    anyFail       ? "FAIL"       : "PASS"

  // NEB: failing any pillar in any subject → overall NG. INCOMPLETE (marks not
  // entered) is distinct and renders as "—" / Pending in the transcript view.
  const overallGrade =
    result === "FAIL"    ? "NG"
  : result === "PASS"    ? weightedGrade
  :                        null
  const overallGpa =
    result === "PASS"    ? weightedGpa : null

  return {
    school: {
      name:    school.name,
      address: school.address,
      phone:   school.phone,
      logoUrl: school.logoUrl,
    },
    student: {
      id:             student.id,
      fullName:       student.user.fullName,
      fullNameNepali: student.fullNameNepali,
      admissionNo:    student.admissionNo,
      rollNumber:     student.rollNumber,
      symbolNumber:   student.symbolNumber,
      className:      student.class.name,
      sectionName:    student.section?.name ?? null,
      dobBS:          student.dobBS,
      photoUrl:       student.user.avatarUrl,
    },
    evaluation: {
      id:             evaluation.id,
      name:           evaluation.name,
      sequenceNumber: evaluation.sequenceNumber,
      isFinal:        evaluation.isFinal,
      yearName:       evaluation.academicYear.name,
      publishAt:      evaluation.publishAt,
    },
    subjects,
    totalFull,
    totalObtained: round2(totalObtained),
    percentage,
    overallGrade,
    overallGpa,
    result,
    gradingScale,
    passPercent,
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
