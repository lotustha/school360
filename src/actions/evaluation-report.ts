"use server"

import { prisma } from "@/lib/prisma"
import { resolveGradingSettings, type GradeRow } from "@/lib/grading-config"
import { resolveCreditHourSplit } from "@/lib/credit-hours"
import { gradePart, mapGpaToGrade } from "@/lib/grade-compute"
import { buildEnrollmentMap } from "@/lib/subject-enrollment"
import { toBS } from "@/lib/nepali-date"

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export interface ReportRollup {
  totalStudents:   number  // ACTIVE students in covered classes
  appeared:        number  // students with ≥1 graded/absent/incomplete subject
  pass:            number
  fail:            number
  incomplete:      number
  absent:          number
  passPct:         number  // pass / (pass + fail) — Incomplete excluded
  failPct:         number
  avgGpa:          number | null
  avgPercent:      number | null
  highest:         { studentId: string; fullName: string; gpa: number } | null
  lowest:          { studentId: string; fullName: string; gpa: number } | null
}

export interface FailBuckets {
  zero:     number
  one:      number
  two:      number
  three:    number
  fourPlus: number
}

export interface GradeDistRow {
  grade:    string
  count:    number
  pct:      number
}

export interface GpaHistogramRow {
  bucket:   "0-1" | "1-2" | "2-2.5" | "2.5-3" | "3-3.5" | "3.5-4"
  count:    number
}

export interface SubjectRollup {
  subjectId:        string
  subjectName:      string
  subjectCode:      string | null
  subjectType:      "REGULAR" | "OPTIONAL" | "EXTRA"
  classId:          string
  className:        string
  studentsTaken:    number
  avgObtained:      number | null
  avgPercent:       number | null
  avgGpa:           number | null
  passCount:        number
  failCount:        number
  absentCount:      number
  passRate:         number
  gradeDist:        Record<string, number>
}

export interface StudentRollupRow {
  studentId:    string
  fullName:     string
  classId:      string
  className:    string
  rollNumber:   string | null
  gpa:          number | null
  grade:        string | null  // overall letter; "NG" when failed
  percentage:   number | null
  result:       "PASS" | "FAIL" | "INCOMPLETE" | "ABSENT"
  failCount:    number
  failedSubjects: { subjectId: string; subjectName: string; obtained: number; full: number }[]
}

export interface ClassReport {
  classId:    string
  className:  string
  rollup:     ReportRollup
  subjects:   SubjectRollup[]
  top3:       StudentRollupRow[]
  bottom3:    StudentRollupRow[]
}

export interface EvaluationReport {
  school: {
    name:    string
    address: string | null
    phone:   string | null
    logoUrl: string | null
  }
  evaluation: {
    id:             string
    name:           string
    description:    string | null
    sequenceNumber: number
    isFinal:        boolean
    isLocked:       boolean
    publishAt:      Date | null
    publishAtBS:    string | null
    yearName:       string
  }
  scope: {
    classIds:      string[]
    classes:       { id: string; name: string }[]
  }
  rollup:         ReportRollup
  failBuckets:    FailBuckets
  gradeDist:      GradeDistRow[]
  gpaHistogram:   GpaHistogramRow[]
  subjects:       SubjectRollup[]
  byClass:        ClassReport[]
  rollOfHonour:   StudentRollupRow[]   // top 10 across all scoped classes
  singleFailers:  StudentRollupRow[]   // students with exactly 1 failed subject
  twoFailers:     StudentRollupRow[]   // students with exactly 2 failed subjects
  gradingScale:   GradeRow[]
  generatedAt:    Date
}

// ──────────────────────────────────────────────────────────────────────────────
// Server action
// ──────────────────────────────────────────────────────────────────────────────

export async function getEvaluationReport(args: {
  schoolId:     string
  evaluationId: string
  classIds?:    string[]
}): Promise<EvaluationReport | null> {
  const [school, evaluation] = await Promise.all([
    prisma.school.findUnique({
      where:  { id: args.schoolId },
      select: { name: true, address: true, phone: true, logoUrl: true, gradingSettings: true },
    }),
    prisma.evaluation.findFirst({
      where:  { id: args.evaluationId, schoolId: args.schoolId },
      include: {
        academicYear:      { select: { name: true } },
        evaluationClasses: {
          include: { class: { select: { id: true, name: true } } },
        },
        subjectEvaluations: {
          include: {
            subject: {
              select: {
                id: true, name: true, code: true, type: true, classId: true,
                creditHours: true, internalCreditHours: true, externalCreditHours: true,
                class: { select: { name: true } },
              },
            },
            results: {
              where: { student: { status: "ACTIVE" } },
              include: {
                student: {
                  select: {
                    id: true, classId: true, rollNumber: true,
                    user: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])
  if (!school || !evaluation) return null

  const settings = resolveGradingSettings(school.gradingSettings)
  const scale    = settings.scale

  const evalClassIds   = evaluation.evaluationClasses.map(ec => ec.class.id)
  const scopedClassIds = args.classIds && args.classIds.length > 0
    ? evalClassIds.filter(cid => args.classIds!.includes(cid))
    : evalClassIds
  const scopedClassSet = new Set(scopedClassIds)
  const classes        = evaluation.evaluationClasses
    .map(ec => ec.class)
    .filter(c => scopedClassSet.has(c.id))
  const classNameById  = new Map(classes.map(c => [c.id, c.name]))

  const yearConfigRows = await prisma.subjectAcademicYearStatus.findMany({
    where: {
      subjectId:      { in: evaluation.subjectEvaluations.map(se => se.subjectId) },
      academicYearId: evaluation.academicYearId,
    },
    select: { subjectId: true, creditHours: true, internalCreditHours: true, externalCreditHours: true },
  })
  const yearCfgBySubject = new Map(yearConfigRows.map(r => [r.subjectId, r]))

  const enrollmentMap = await buildEnrollmentMap(
    evaluation.subjectEvaluations.map(se => se.subjectId),
    evaluation.academicYearId,
  )

  const activeStudents = scopedClassIds.length === 0 ? [] : await prisma.student.findMany({
    where:  { schoolId: args.schoolId, classId: { in: scopedClassIds }, status: "ACTIVE" },
    select: {
      id: true, classId: true, rollNumber: true,
      user: { select: { fullName: true } },
    },
  })

  // ───────────────────────────────────────────────────────────────────────
  // Per-student accumulators
  // ───────────────────────────────────────────────────────────────────────
  const studentGpWeighted = new Map<string, number>()
  const studentChWeight   = new Map<string, number>()
  const studentFailCount  = new Map<string, number>()
  const studentAnyAbsent  = new Map<string, boolean>()
  const studentAnyIncomp  = new Map<string, boolean>()
  const studentObtained   = new Map<string, number>()
  const studentFullMarks  = new Map<string, number>()
  const studentFailed     = new Map<string, { subjectId: string; subjectName: string; obtained: number; full: number }[]>()

  // ───────────────────────────────────────────────────────────────────────
  // Per-subject accumulators (per (class, subject) tuple → keyed by se.id)
  // ───────────────────────────────────────────────────────────────────────
  type SubjectAcc = {
    subjectId:   string
    subjectName: string
    subjectCode: string | null
    subjectType: "REGULAR" | "OPTIONAL" | "EXTRA"
    classId:     string
    className:   string
    obtainedSum: number
    fullSum:     number
    gpaSum:      number
    gpaCount:    number
    studentsTaken: number
    pass:        number
    fail:        number
    absent:      number
    gradeDist:   Record<string, number>
  }
  const subjectAcc = new Map<string, SubjectAcc>()

  for (const se of evaluation.subjectEvaluations) {
    if (!scopedClassSet.has(se.subject.classId)) continue

    const subjType = se.subject.type as SubjectAcc["subjectType"]
    const yearCfg  = yearCfgBySubject.get(se.subjectId) ?? null
    const split    = resolveCreditHourSplit(
      {
        creditHours:         se.subject.creditHours,
        internalCreditHours: se.subject.internalCreditHours,
        externalCreditHours: se.subject.externalCreditHours,
      },
      yearCfg,
      se.internalMax, se.externalMax,
    )
    const subjectCh = split.total
    const fullMarks = se.internalMax + se.externalMax

    const eligible = enrollmentMap.get(se.subjectId) ?? null
    const acc: SubjectAcc = {
      subjectId:    se.subjectId,
      subjectName:  se.subject.name,
      subjectCode:  se.subject.code,
      subjectType:  subjType,
      classId:      se.subject.classId,
      className:    se.subject.class.name,
      obtainedSum:  0,
      fullSum:      0,
      gpaSum:       0,
      gpaCount:     0,
      studentsTaken: 0,
      pass:         0,
      fail:         0,
      absent:       0,
      gradeDist:    {},
    }
    subjectAcc.set(se.id, acc)

    for (const r of se.results) {
      if (!scopedClassSet.has(r.student.classId)) continue
      if (subjType !== "REGULAR" && eligible && !eligible.has(r.studentId)) continue

      acc.studentsTaken++
      acc.obtainedSum += r.totalObtained ?? 0
      acc.fullSum     += fullMarks

      const isFail       = r.status === "FAIL" || r.grade === "NG"
      const isAbsent     = r.status === "ABSENT"
      const isIncomplete = r.status === "INCOMPLETE"

      if (isFail || isAbsent) acc.fail++
      else if (!isIncomplete) acc.pass++
      if (isAbsent) acc.absent++

      const letter = r.grade ?? (r.totalObtained != null ? gradePart(r.totalObtained, fullMarks, scale).grade : "—")
      acc.gradeDist[letter] = (acc.gradeDist[letter] ?? 0) + 1

      if (typeof r.gpa === "number" && r.status === "PASS" && r.grade !== "NG") {
        acc.gpaSum   += r.gpa
        acc.gpaCount++
      }

      // ── Per-student
      const gpaContrib = subjType !== "EXTRA"
      if (gpaContrib && typeof r.gpa === "number" && subjectCh > 0 && !isFail && !isAbsent && !isIncomplete) {
        studentGpWeighted.set(r.studentId, (studentGpWeighted.get(r.studentId) ?? 0) + r.gpa * subjectCh)
        studentChWeight  .set(r.studentId, (studentChWeight  .get(r.studentId) ?? 0) + subjectCh)
      }
      if (gpaContrib && isAbsent) studentAnyAbsent.set(r.studentId, true)
      if (gpaContrib && isIncomplete) studentAnyIncomp.set(r.studentId, true)
      if (gpaContrib && (isFail || isAbsent)) {
        studentFailCount.set(r.studentId, (studentFailCount.get(r.studentId) ?? 0) + 1)
        const arr = studentFailed.get(r.studentId) ?? []
        arr.push({
          subjectId:   se.subjectId,
          subjectName: se.subject.name,
          obtained:    r.totalObtained ?? 0,
          full:        fullMarks,
        })
        studentFailed.set(r.studentId, arr)
      }
      if (gpaContrib) {
        studentObtained.set(r.studentId, (studentObtained.get(r.studentId) ?? 0) + (r.totalObtained ?? 0))
        studentFullMarks.set(r.studentId, (studentFullMarks.get(r.studentId) ?? 0) + fullMarks)
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Per-student summary
  // ───────────────────────────────────────────────────────────────────────

  const studentSummaries: StudentRollupRow[] = activeStudents.map(s => {
    const wgp        = studentGpWeighted.get(s.id) ?? 0
    const ch         = studentChWeight  .get(s.id) ?? 0
    const failed     = studentFailCount .get(s.id) ?? 0
    const incomplete = studentAnyIncomp .get(s.id) === true
    const absent     = studentAnyAbsent .get(s.id) === true
    const obtained   = studentObtained  .get(s.id) ?? 0
    const fullMarks  = studentFullMarks .get(s.id) ?? 0
    const gpa        = (!incomplete && !absent && failed === 0 && ch > 0)
      ? Math.round((wgp / ch) * 100) / 100
      : null
    const percent    = fullMarks > 0
      ? Math.round((obtained / fullMarks) * 10000) / 100
      : null

    const result: StudentRollupRow["result"] =
      incomplete ? "INCOMPLETE" :
      absent     ? "ABSENT" :
      failed > 0 ? "FAIL" :
                   "PASS"

    const grade =
      result === "FAIL" || result === "ABSENT" ? "NG" :
      result === "PASS" && gpa !== null        ? mapGpaToGrade(gpa, scale).grade :
                                                  null

    return {
      studentId:      s.id,
      fullName:       s.user.fullName,
      classId:        s.classId,
      className:      classNameById.get(s.classId) ?? "",
      rollNumber:     s.rollNumber,
      gpa,
      grade,
      percentage:     percent,
      result,
      failCount:      failed,
      failedSubjects: studentFailed.get(s.id) ?? [],
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // Rollup helper (reused for whole-evaluation and per-class)
  // ───────────────────────────────────────────────────────────────────────

  function rollupFor(students: StudentRollupRow[]): ReportRollup {
    let pass = 0, fail = 0, incomplete = 0, absent = 0, appeared = 0
    let gpaSum = 0, gpaCount = 0
    let pctSum = 0, pctCount = 0
    let highest: ReportRollup["highest"] = null
    let lowest:  ReportRollup["lowest"]  = null
    for (const s of students) {
      const appearedFlag = s.result !== "PASS"
        ? true  // FAIL/ABSENT/INCOMPLETE all imply appeared in some form
        : s.gpa !== null
      if (appearedFlag) appeared++
      if (s.result === "PASS")       pass++
      else if (s.result === "FAIL")  fail++
      else if (s.result === "INCOMPLETE") incomplete++
      else if (s.result === "ABSENT")     { fail++; absent++ }

      if (s.gpa !== null) {
        gpaSum += s.gpa
        gpaCount++
        if (!highest || s.gpa > highest.gpa) highest = { studentId: s.studentId, fullName: s.fullName, gpa: s.gpa }
        if (!lowest  || s.gpa < lowest.gpa ) lowest  = { studentId: s.studentId, fullName: s.fullName, gpa: s.gpa }
      }
      if (s.percentage !== null) {
        pctSum += s.percentage
        pctCount++
      }
    }
    const denomPF = pass + fail
    return {
      totalStudents: students.length,
      appeared,
      pass, fail, incomplete, absent,
      passPct:    denomPF > 0 ? Math.round((pass / denomPF) * 100) : 0,
      failPct:    denomPF > 0 ? Math.round((fail / denomPF) * 100) : 0,
      avgGpa:     gpaCount > 0 ? Math.round((gpaSum / gpaCount) * 100) / 100 : null,
      avgPercent: pctCount > 0 ? Math.round((pctSum / pctCount) * 100) / 100 : null,
      highest,
      lowest,
    }
  }

  const rollup = rollupFor(studentSummaries)

  // ───────────────────────────────────────────────────────────────────────
  // Aggregate buckets
  // ───────────────────────────────────────────────────────────────────────

  const failBuckets: FailBuckets = { zero: 0, one: 0, two: 0, three: 0, fourPlus: 0 }
  const overallGradeDist = new Map<string, number>()
  const gpaHistogramMap: Record<GpaHistogramRow["bucket"], number> = {
    "0-1": 0, "1-2": 0, "2-2.5": 0, "2.5-3": 0, "3-3.5": 0, "3.5-4": 0,
  }

  for (const s of studentSummaries) {
    if (s.result === "INCOMPLETE") continue
    // Fail buckets — only students who appeared and not incomplete.
    if      (s.failCount === 0) failBuckets.zero++
    else if (s.failCount === 1) failBuckets.one++
    else if (s.failCount === 2) failBuckets.two++
    else if (s.failCount === 3) failBuckets.three++
    else                        failBuckets.fourPlus++

    // Grade dist
    const letter = s.grade ?? "—"
    overallGradeDist.set(letter, (overallGradeDist.get(letter) ?? 0) + 1)

    // GPA histogram (only successful students)
    if (s.gpa !== null) {
      const g = s.gpa
      if      (g < 1)    gpaHistogramMap["0-1"]++
      else if (g < 2)    gpaHistogramMap["1-2"]++
      else if (g < 2.5)  gpaHistogramMap["2-2.5"]++
      else if (g < 3)    gpaHistogramMap["2.5-3"]++
      else if (g < 3.5)  gpaHistogramMap["3-3.5"]++
      else               gpaHistogramMap["3.5-4"]++
    }
  }

  const knownGrades = new Set(scale.map(s => s.grade))
  const gradeDist: GradeDistRow[] = scale.map(s => {
    const count = overallGradeDist.get(s.grade) ?? 0
    return { grade: s.grade, count, pct: rollup.appeared > 0 ? Math.round((count / rollup.appeared) * 100) : 0 }
  })
  for (const [g, count] of overallGradeDist) {
    if (knownGrades.has(g)) continue
    gradeDist.push({ grade: g, count, pct: rollup.appeared > 0 ? Math.round((count / rollup.appeared) * 100) : 0 })
  }

  const gpaHistogram: GpaHistogramRow[] = (
    ["0-1", "1-2", "2-2.5", "2.5-3", "3-3.5", "3.5-4"] as GpaHistogramRow["bucket"][]
  ).map(b => ({ bucket: b, count: gpaHistogramMap[b] }))

  // ───────────────────────────────────────────────────────────────────────
  // Subjects table — finalize
  // ───────────────────────────────────────────────────────────────────────

  const subjects: SubjectRollup[] = [...subjectAcc.values()]
    .map(a => {
      const denomPF = a.pass + a.fail
      return {
        subjectId:    a.subjectId,
        subjectName:  a.subjectName,
        subjectCode:  a.subjectCode,
        subjectType:  a.subjectType,
        classId:      a.classId,
        className:    a.className,
        studentsTaken: a.studentsTaken,
        avgObtained:  a.studentsTaken > 0 ? Math.round((a.obtainedSum / a.studentsTaken) * 100) / 100 : null,
        avgPercent:   a.fullSum > 0 ? Math.round((a.obtainedSum / a.fullSum) * 10000) / 100 : null,
        avgGpa:       a.gpaCount > 0 ? Math.round((a.gpaSum / a.gpaCount) * 100) / 100 : null,
        passCount:    a.pass,
        failCount:    a.fail,
        absentCount:  a.absent,
        passRate:     denomPF > 0 ? Math.round((a.pass / denomPF) * 100) : 0,
        gradeDist:    a.gradeDist,
      }
    })
    .sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className)
      return a.subjectName.localeCompare(b.subjectName)
    })

  // ───────────────────────────────────────────────────────────────────────
  // Per-class blocks
  // ───────────────────────────────────────────────────────────────────────

  const byClass: ClassReport[] = scopedClassIds.map(cid => {
    const className = classNameById.get(cid) ?? ""
    const classStudents = studentSummaries.filter(s => s.classId === cid)
    const classSubjects = subjects.filter(s => s.classId === cid)
    const classRollup   = rollupFor(classStudents)
    const ranked        = [...classStudents]
      .filter(s => s.gpa !== null)
      .sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0))
    return {
      classId:    cid,
      className,
      rollup:     classRollup,
      subjects:   classSubjects,
      top3:       ranked.slice(0, 3),
      bottom3:    ranked.slice(-3).reverse(),
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // Roll of honour (top 10) + failer lists
  // ───────────────────────────────────────────────────────────────────────

  const rollOfHonour = [...studentSummaries]
    .filter(s => s.gpa !== null)
    .sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0))
    .slice(0, 10)

  const singleFailers = studentSummaries
    .filter(s => s.failCount === 1)
    .sort((a, b) => a.className.localeCompare(b.className) || a.fullName.localeCompare(b.fullName))
  const twoFailers = studentSummaries
    .filter(s => s.failCount === 2)
    .sort((a, b) => a.className.localeCompare(b.className) || a.fullName.localeCompare(b.fullName))

  return {
    school: {
      name:    school.name,
      address: school.address,
      phone:   school.phone,
      logoUrl: school.logoUrl,
    },
    evaluation: {
      id:             evaluation.id,
      name:           evaluation.name,
      description:    evaluation.description,
      sequenceNumber: evaluation.sequenceNumber,
      isFinal:        evaluation.isFinal,
      isLocked:       evaluation.isLocked,
      publishAt:      evaluation.publishAt,
      publishAtBS:    evaluation.publishAt ? safeToBS(evaluation.publishAt) : null,
      yearName:       evaluation.academicYear.name,
    },
    scope: {
      classIds: scopedClassIds,
      classes,
    },
    rollup,
    failBuckets,
    gradeDist,
    gpaHistogram,
    subjects,
    byClass,
    rollOfHonour,
    singleFailers,
    twoFailers,
    gradingScale: scale,
    generatedAt:  new Date(),
  }
}

function safeToBS(d: Date): string | null {
  try { return toBS(d) } catch { return null }
}
