"use server"

import { prisma } from "@/lib/prisma"
import { resolveExamMarksBatch } from "@/lib/exam-marks"
import { buildEnrollmentMap } from "@/lib/subject-enrollment"

/** Natural sort for class names so "Class 2" comes before "Class 10". */
const CLASS_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

// ──────────────────────────────────────────────────────────────────────────────
// Grading helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Default NEB-style 9-band grading when a school has no custom scale. */
const DEFAULT_GRADING: GradeBand[] = [
  { grade: "A+", gpa: 4.0, minPercent: 90 },
  { grade: "A",  gpa: 3.6, minPercent: 80 },
  { grade: "B+", gpa: 3.2, minPercent: 70 },
  { grade: "B",  gpa: 2.8, minPercent: 60 },
  { grade: "C+", gpa: 2.4, minPercent: 50 },
  { grade: "C",  gpa: 2.0, minPercent: 40 },
  { grade: "D",  gpa: 1.6, minPercent: 30 },
  { grade: "E",  gpa: 1.2, minPercent: 20 },
  { grade: "NG", gpa: 0,   minPercent: 0  },
]
const DEFAULT_PASS_PERCENT = 35

interface GradeBand { grade: string; gpa: number; minPercent: number }
interface SchoolGrading { passPercent: number; scale: GradeBand[] }

function readGrading(json: unknown): SchoolGrading {
  if (json && typeof json === "object" && "scale" in json) {
    const j = json as { passPercent?: number; scale?: GradeBand[] }
    return {
      passPercent: typeof j.passPercent === "number" ? j.passPercent : DEFAULT_PASS_PERCENT,
      scale:       Array.isArray(j.scale) && j.scale.length > 0 ? j.scale : DEFAULT_GRADING,
    }
  }
  return { passPercent: DEFAULT_PASS_PERCENT, scale: DEFAULT_GRADING }
}

function gradeFor(percent: number, scale: GradeBand[]): GradeBand {
  for (const b of scale) {
    if (percent >= b.minPercent) return b
  }
  return scale[scale.length - 1]
}

// ──────────────────────────────────────────────────────────────────────────────
// Exam-wide report summary
// ──────────────────────────────────────────────────────────────────────────────

export interface ClassReportRow {
  classId:        string
  className:      string
  facultyName:    string | null
  studentCount:   number
  paperCount:     number               // # subjects in this class for this exam
  totalScoresExpected: number          // students × paperCount
  totalScoresEntered:  number
  passCount:      number
  failCount:      number
  notGradedCount: number
  averagePercent: number | null
}

export interface ExamReportOverview {
  examName:       string
  classRows:      ClassReportRow[]
  totalStudents:  number
  totalPapers:    number               // distinct papers in the exam
  scoresEntered:  number
  scoresExpected: number
}

export async function getExamReportOverview(
  examId:   string,
  schoolId: string,
): Promise<ExamReportOverview | null> {
  const exam = await prisma.exam.findFirst({
    where:  { id: examId, schoolId },
    select: { id: true, name: true, academicYearId: true },
  })
  if (!exam) return null

  // Classes that sit this exam
  const examClasses = await prisma.examClass.findMany({
    where:  { examId },
    select: {
      class: {
        select: {
          id: true, name: true,
          faculty: { select: { name: true } },
          students: {
            where:  { status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
    },
  })

  // Targets — define which (class, subject) each paper covers
  const targets = await prisma.examPaperTarget.findMany({
    where:  { paper: { examId, schoolId } },
    select: {
      classId:   true,
      subjectId: true,
      paper: { select: { id: true } },
    },
  })

  // Resolve full+pass marks per subject from EvaluationComponent/legacy fallback
  const allSubjectIds = [...new Set(targets.map(t => t.subjectId))]
  const [marksBySubject, enrolledBySubject] = await Promise.all([
    resolveExamMarksBatch(examId, allSubjectIds, schoolId),
    buildEnrollmentMap(allSubjectIds, exam.academicYearId),
  ])

  // classId → array of { paperId, subjectId, fullMarks, passMarks }
  type ClassTarget = { paperId: string; subjectId: string; fullMarks: number; passMarks: number }
  const targetsByClass = new Map<string, ClassTarget[]>()
  for (const t of targets) {
    if (!targetsByClass.has(t.classId)) targetsByClass.set(t.classId, [])
    const resolved = marksBySubject.get(t.subjectId)
    targetsByClass.get(t.classId)!.push({
      paperId:   t.paper.id,
      subjectId: t.subjectId,
      fullMarks: resolved?.fullMarks ?? 100,
      passMarks: resolved?.passMarks ?? 35,
    })
  }

  // All scores for this exam — indexed by studentId → subjectId
  const scores = await prisma.terminalExamScore.findMany({
    where:  { examId },
    select: { studentId: true, subjectId: true, rawScore: true, isAbsent: true },
  })
  const scoreByStu = new Map<string, Map<string, { raw: number | null; absent: boolean }>>()
  for (const s of scores) {
    if (!scoreByStu.has(s.studentId)) scoreByStu.set(s.studentId, new Map())
    scoreByStu.get(s.studentId)!.set(s.subjectId, { raw: s.rawScore, absent: s.isAbsent })
  }

  // Grading is school-wide; one lookup
  const schoolGrading = await prisma.school.findUnique({
    where: { id: schoolId }, select: { gradingSettings: true },
  })
  const grading = readGrading(schoolGrading?.gradingSettings)

  const totalPapers = new Set(targets.map(t => t.paper.id)).size

  const classRows: ClassReportRow[] = []
  let totalStudents  = 0
  let scoresEntered  = 0
  let scoresExpected = 0

  for (const ec of examClasses) {
    const c = ec.class
    const subjects = targetsByClass.get(c.id) ?? []
    const studentCount = c.students.length

    let entered    = 0
    let expected   = 0          // per-student aware (only enrolled subjects count)
    let pass       = 0
    let fail       = 0
    let notGraded  = 0
    let sumPercent = 0
    let graded     = 0

    for (const stu of c.students) {
      const stuScores = scoreByStu.get(stu.id) ?? new Map()
      let stuExpected    = 0
      let papersSeen     = 0
      let papersFailing  = 0
      let papersAbsent   = 0
      let obtained       = 0
      let maxObtainable  = 0

      for (const subj of subjects) {
        // Real enrollment: REGULAR uses class roster, OPTIONAL/EXTRA use SubjectEnrollment.
        const enrolledStudents = enrolledBySubject.get(subj.subjectId)
        if (enrolledStudents && !enrolledStudents.has(stu.id)) continue
        stuExpected++
        const sc = stuScores.get(subj.subjectId)
        if (sc) {
          papersSeen++
          entered++
          maxObtainable += subj.fullMarks
          if (sc.absent || sc.raw == null) { papersAbsent++; continue }
          obtained += sc.raw
          // Grading-band pass/fail: percent-based via school's passPercent,
          // plus an NG check for grades that map to Not Graded.
          const pctOnSubj = subj.fullMarks > 0 ? (sc.raw / subj.fullMarks) * 100 : 0
          const subjGrade = gradeFor(pctOnSubj, grading.scale).grade
          if (pctOnSubj < grading.passPercent || subjGrade === "NG") papersFailing++
        }
      }

      expected += stuExpected

      // Student is "graded" when they have a row for every subject they're
      // taking. Otherwise we can't compute pass/fail yet.
      const fullyEntered = stuExpected > 0 && papersSeen === stuExpected
      if (!fullyEntered) { notGraded++; continue }

      if (papersAbsent > 0 || papersFailing > 0) fail++
      else                                       pass++

      if (maxObtainable > 0) {
        sumPercent += (obtained / maxObtainable) * 100
        graded++
      }
    }

    scoresEntered  += entered
    scoresExpected += expected
    totalStudents  += studentCount

    classRows.push({
      classId:             c.id,
      className:           c.name,
      facultyName:         c.faculty?.name ?? null,
      studentCount,
      paperCount:          subjects.length,
      totalScoresExpected: expected,
      totalScoresEntered:  entered,
      passCount:           pass,
      failCount:           fail,
      notGradedCount:      notGraded,
      averagePercent:      graded > 0 ? sumPercent / graded : null,
    })
  }

  return {
    examName:       exam.name,
    classRows:      classRows.sort((a, b) => CLASS_COLLATOR.compare(a.className, b.className)),
    totalStudents,
    totalPapers,
    scoresEntered,
    scoresExpected,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-class mark sheet
// ──────────────────────────────────────────────────────────────────────────────

export interface MarkSheetSubject {
  subjectId:    string
  subjectName:  string
  subjectCode:  string
  fullMarks:    number
  passMarks:    number
  /** # of (active) students who have a score row (raw or absent). */
  enteredCount: number
  /** Total active students in the class — same for every subject. */
  studentCount: number
}

export interface MarkSheetCell {
  raw:       number | null
  isAbsent:  boolean
  isFail:    boolean
  /** True when this student didn't take this subject (e.g. it's an optional
   *  subject they didn't opt into). Inferred from absence of a score row when
   *  other students in the class do have rows for the same subject. */
  optedOut:  boolean
}

export interface MarkSheetStudent {
  studentId:      string
  admissionNo:    string
  rollNumber:     string | null
  fullName:       string
  avatarUrl:      string | null
  cells:          Record<string, MarkSheetCell>   // subjectId → cell
  total:          number    // maxObtainable across all subjects
  obtained:       number    // sum of non-absent rawScore
  percent:        number
  grade:          string
  gpa:            number
  status:         "PASS" | "FAIL" | "NOT_GRADED" | "ABSENT"
  failedSubjects: number
}

export interface ClassMarkSheet {
  examName:    string
  className:   string
  facultyName: string | null
  passPercent: number
  schoolName:  string
  schoolLogo:  string | null
  schoolAddress: string | null
  subjects:    MarkSheetSubject[]
  students:    MarkSheetStudent[]
}

export async function getClassMarkSheet(
  examId:   string,
  classId:  string,
  schoolId: string,
): Promise<ClassMarkSheet | null> {
  const [school, exam, klass] = await Promise.all([
    prisma.school.findUnique({
      where:  { id: schoolId },
      select: {
        gradingSettings: true,
        name: true, logoUrl: true, address: true,
      },
    }),
    prisma.exam.findFirst({
      where:  { id: examId, schoolId },
      select: { id: true, name: true, academicYearId: true },
    }),
    prisma.class.findFirst({
      where:  { id: classId, schoolId },
      select: {
        id: true, name: true,
        faculty: { select: { name: true } },
        students: {
          where:   { status: "ACTIVE" },
          orderBy: [{ rollNumber: "asc" }, { admissionNo: "asc" }],
          select:  {
            id: true, admissionNo: true, rollNumber: true,
            user: { select: { fullName: true, avatarUrl: true } },
          },
        },
      },
    }),
  ])
  if (!exam || !klass) return null

  const grading = readGrading(school?.gradingSettings)

  // Papers targeting this class
  const targets = await prisma.examPaperTarget.findMany({
    where:  { classId, paper: { examId, schoolId } },
    select: {
      subjectId: true,
      subject: { select: { name: true, code: true } },
    },
  })

  const subjectIds = targets.map(t => t.subjectId)
  const [marksBySubject, enrolledBySubject] = await Promise.all([
    resolveExamMarksBatch(examId, subjectIds, schoolId),
    buildEnrollmentMap(subjectIds, exam.academicYearId),
  ])

  const studentIds = klass.students.map(s => s.id)
  const studentIdSet = new Set(studentIds)
  const scores = studentIds.length === 0 ? [] : await prisma.terminalExamScore.findMany({
    where:  { examId, studentId: { in: studentIds } },
    select: { studentId: true, subjectId: true, rawScore: true, isAbsent: true },
  })
  const byStudent = new Map<string, Map<string, { raw: number | null; absent: boolean }>>()
  const enteredBySubject = new Map<string, number>()
  for (const s of scores) {
    if (!studentIdSet.has(s.studentId)) continue
    if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, new Map())
    byStudent.get(s.studentId)!.set(s.subjectId, { raw: s.rawScore, absent: s.isAbsent })
    enteredBySubject.set(s.subjectId, (enteredBySubject.get(s.subjectId) ?? 0) + 1)
  }

  const subjects: MarkSheetSubject[] = targets.map(t => {
    const m = marksBySubject.get(t.subjectId)
    // For the per-subject header, "studentCount" = enrolled-this-class count
    // (intersect class students with enrolled set, so optional subjects show
    // their real cohort size).
    const enrolledSet = enrolledBySubject.get(t.subjectId) ?? new Set<string>()
    const enrolledInThisClass = studentIds.filter(id => enrolledSet.has(id)).length
    return {
      subjectId:    t.subjectId,
      subjectName:  t.subject.name,
      subjectCode:  t.subject.code,
      fullMarks:    m?.fullMarks ?? 100,
      passMarks:    m?.passMarks ?? 35,
      enteredCount: enteredBySubject.get(t.subjectId) ?? 0,
      studentCount: enrolledInThisClass,
    }
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName))

  const students: MarkSheetStudent[] = klass.students.map(s => {
    const cells: Record<string, MarkSheetCell> = {}
    let obtained         = 0
    let stuExpected      = 0     // # subjects this student is actually taking
    let papersGraded     = 0
    let papersAbsent     = 0
    let failedSubjects   = 0
    let stuTotalFullMark = 0

    for (const subj of subjects) {
      // Real enrollment: not in this subject's enrollment set → opted out.
      const enrolled = enrolledBySubject.get(subj.subjectId)?.has(s.id) ?? false
      if (!enrolled) {
        cells[subj.subjectId] = { raw: null, isAbsent: false, isFail: false, optedOut: true }
        continue
      }

      const sc = byStudent.get(s.id)?.get(subj.subjectId)
      if (!sc) {
        // Pending entry — subject still counts toward expected for this student.
        cells[subj.subjectId] = { raw: null, isAbsent: false, isFail: false, optedOut: false }
        stuExpected++
        stuTotalFullMark += subj.fullMarks
        continue
      }

      stuExpected++
      stuTotalFullMark += subj.fullMarks
      papersGraded++
      // Grading-band pass/fail: percent below passPercent OR grade=NG OR absent.
      let isFail = sc.absent || sc.raw == null
      if (!isFail && sc.raw != null) {
        const pct = subj.fullMarks > 0 ? (sc.raw / subj.fullMarks) * 100 : 0
        const subjGrade = gradeFor(pct, grading.scale).grade
        if (pct < grading.passPercent || subjGrade === "NG") isFail = true
      }
      cells[subj.subjectId] = { raw: sc.raw, isAbsent: sc.absent, isFail, optedOut: false }
      if (sc.absent || sc.raw == null) papersAbsent++
      else                              obtained += sc.raw
      if (isFail) failedSubjects++
    }

    const allGraded = stuExpected > 0 && papersGraded === stuExpected
    const percent = stuTotalFullMark > 0 ? (obtained / stuTotalFullMark) * 100 : 0
    const band = gradeFor(percent, grading.scale)

    let status: MarkSheetStudent["status"] = "NOT_GRADED"
    if (allGraded) {
      if (papersAbsent === stuExpected)       status = "ABSENT"
      else if (failedSubjects > 0)            status = "FAIL"
      else if (percent < grading.passPercent) status = "FAIL"
      else                                    status = "PASS"
    }

    return {
      studentId:      s.id,
      admissionNo:    s.admissionNo,
      rollNumber:     s.rollNumber,
      fullName:       s.user.fullName,
      avatarUrl:      s.user.avatarUrl,
      cells,
      total:          stuTotalFullMark,
      obtained,
      percent,
      grade:          band.grade,
      gpa:            band.gpa,
      status,
      failedSubjects,
    }
  })

  return {
    examName:      exam.name,
    className:     klass.name,
    facultyName:   klass.faculty?.name ?? null,
    passPercent:   grading.passPercent,
    schoolName:    school?.name ?? "",
    schoolLogo:    school?.logoUrl ?? null,
    schoolAddress: school?.address ?? null,
    subjects,
    students,
  }
}
