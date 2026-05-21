import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ClipboardCheck, ArrowLeft, GraduationCap, Hash, BookOpen, Lock, Eye } from "lucide-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getEvaluation, listCloneSources } from "@/actions/evaluations"
import { buildEnrollmentMap } from "@/lib/subject-enrollment"
import { resolveGradingSettings } from "@/lib/grading-config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EvaluationDetailClient } from "./evaluation-detail-client"
import { ClassSwitcher } from "./class-switcher"

export const metadata: Metadata = { title: "Evaluation" }

type SP = { classId?: string }

export default async function EvaluationDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string; id: string }>
  searchParams: Promise<SP>
}) {
  const { domain, id } = await params
  const sp             = await searchParams
  const [school, session] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain } }),
    getServerSession(authOptions),
  ])
  if (!school) notFound()

  const grading = resolveGradingSettings(school.gradingSettings)
  const outlierThresholds = {
    cellMaxPct:        grading.markEntryOutlierCellMaxPct,
    vsOwnAvgRatio:     grading.markEntryOutlierVsOwnAvgRatio,
    missingFillRate:   grading.markEntryMissingFillRate,
  }

  const evaluation = await getEvaluation(id)
  if (!evaluation || evaluation.schoolId !== school.id) notFound()

  const memberClasses = evaluation.evaluationClasses.map(ec => ec.class)
  if (memberClasses.length === 0) {
    // Edge case: legacy single-class row not yet backfilled. Fall back to nothing visible.
    return (
      <div className="space-y-5">
        <Header evaluation={evaluation} memberClasses={[]} />
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No classes linked to this evaluation</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Edit the evaluation from the list and pick at least one class.
          </p>
        </div>
      </div>
    )
  }

  // Active class — from URL or default to first member.
  const requested  = sp.classId ?? memberClasses[0].id
  const activeClassId = memberClasses.find(c => c.id === requested)?.id ?? memberClasses[0].id

  const [allSubjectsInClass, allExams, students, cloneSources, allYearsRaw] = await Promise.all([
    prisma.subject.findMany({
      where:   { schoolId: school.id, classId: activeClassId },
      select:  { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.exam.findMany({
      where:   { schoolId: school.id, academicYearId: evaluation.academicYearId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where:   { schoolId: school.id, classId: activeClassId, status: "ACTIVE" },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: [{ rollNumber: "asc" }, { admissionNo: "asc" }],
    }),
    listCloneSources({ schoolId: school.id }),
    prisma.academicYear.findMany({
      where:  { schoolId: school.id },
      select: { id: true, name: true, isCurrent: true, startDateBS: true },
      orderBy: { startDateBS: "desc" },
    }),
  ])

  // Subject evaluations scoped to the active class (via subject.classId)
  const scopedSubjectEvaluations = evaluation.subjectEvaluations.filter(
    se => se.subject.classId === activeClassId,
  )

  // Per-subject enrollment map for the evaluation's year. For REGULAR (or
  // unconfigured non-REGULAR) subjects, this returns the full class roster;
  // for OPTIONAL/EXTRA subjects in a SubjectGroup, it returns only enrolled.
  const enrollmentMap = await buildEnrollmentMap(
    scopedSubjectEvaluations.map(se => se.subjectId),
    evaluation.academicYearId,
  )
  const enrolledIdsBySubject: Record<string, string[]> = {}
  for (const [subjectId, set] of enrollmentMap.entries()) {
    enrolledIdsBySubject[subjectId] = Array.from(set)
  }

  // For each subject that lives in a SubjectGroup, surface enough to render the
  // ManageDrawer inline (no need to navigate to /academics/subjects/groups).
  const subjectIdsForGroupLookup = scopedSubjectEvaluations.map(se => se.subjectId)
  const groupLinks = subjectIdsForGroupLookup.length === 0 ? [] : await prisma.subjectGroupSubject.findMany({
    where: { subjectId: { in: subjectIdsForGroupLookup } },
    include: {
      group: {
        include: {
          class:    { select: { name: true } },
          subjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
        },
      },
    },
  })
  const groupBySubject: Record<string, {
    id: string; label: string; kind: "OPTIONAL_PICK" | "EXTRA_COHORT"; pickCount: number
    classId: string; className: string
    subjects: { id: string; name: string; code: string }[]
  }> = {}
  for (const link of groupLinks) {
    groupBySubject[link.subjectId] = {
      id:        link.group.id,
      label:     link.group.label,
      kind:      link.group.kind,
      pickCount: link.group.pickCount,
      classId:   link.group.classId,
      className: link.group.class.name,
      subjects:  link.group.subjects.map(gs => ({
        id:   gs.subject.id,
        name: gs.subject.name,
        code: gs.subject.code,
      })),
    }
  }

  return (
    <div className="space-y-5">
      <Header evaluation={evaluation} memberClasses={memberClasses} />

      <ClassSwitcher
        classes={memberClasses}
        activeClassId={activeClassId}
      />

      <EvaluationDetailClient
        evaluationId={evaluation.id}
        activeClassId={activeClassId}
        activeAcademicYearId={evaluation.academicYearId}
        isLocked={evaluation.isLocked}
        userId={session?.user?.id ?? ""}
        classSubjects={allSubjectsInClass}
        exams={allExams}
        cloneSources={cloneSources}
        enrolledIdsBySubject={enrolledIdsBySubject}
        groupBySubject={groupBySubject}
        years={allYearsRaw}
        outlierThresholds={outlierThresholds}
        students={students.map(s => ({
          id:          s.id,
          userId:      s.user.id,
          fullName:    s.user.fullName,
          admissionNo: s.admissionNo,
          rollNumber:  s.rollNumber,
        }))}
        subjectEvaluations={scopedSubjectEvaluations.map(se => ({
          id:          se.id,
          subjectId:   se.subjectId,
          subjectName: se.subject.name,
          subjectCode: se.subject.code,
          internalMax: se.internalMax,
          externalMax: se.externalMax,
          components:  se.components.map(c => ({
            id:               c.id,
            part:             c.part,
            label:            c.label,
            maxMarks:         c.maxMarks,
            orderIndex:       c.orderIndex,
            source:           c.source,
            sourceExamId:     c.sourceExamId,
            sourceExamName:   c.sourceExam?.name ?? null,
            sourceMaxMarks:   c.sourceMaxMarks,
          })),
        }))}
      />
    </div>
  )
}

function Header({
  evaluation,
  memberClasses,
}: {
  evaluation: {
    name:           string
    description:    string | null
    sequenceNumber: number
    isFinal:        boolean
    isLocked:       boolean
    publishAt:      Date | null
    academicYear:   { name: string }
    subjectEvaluations: unknown[]
  }
  memberClasses: { id: string; name: string }[]
}) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/academics/evaluations">
        <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </Link>
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center",
        evaluation.isFinal ? "bg-emerald-100" : "bg-primary/10",
      )}>
        <ClipboardCheck className={cn("w-5 h-5", evaluation.isFinal ? "text-emerald-600" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold truncate">{evaluation.name}</h2>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            {memberClasses.length === 0
              ? "No classes"
              : memberClasses.length === 1
                ? memberClasses[0].name
                : `${memberClasses.length} classes`}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Seq {evaluation.sequenceNumber}</span>
          <span>·</span>
          <span>{evaluation.academicYear.name}</span>
          {evaluation.description && (
            <>
              <span>·</span>
              <Badge className="text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200">
                {evaluation.description}
              </Badge>
            </>
          )}
          {evaluation.isFinal && (
            <>
              <span>·</span>
              <Badge className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">FINAL</Badge>
            </>
          )}
          {evaluation.isLocked && (
            <>
              <span>·</span>
              <Badge className="text-[10px] font-bold gap-1 bg-rose-50 text-rose-700 border-rose-200">
                <Lock className="w-2.5 h-2.5" /> Locked
              </Badge>
            </>
          )}
          {evaluation.publishAt && (
            <>
              <span>·</span>
              <Badge className="text-[10px] font-bold gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                <Eye className="w-2.5 h-2.5" /> Published
              </Badge>
            </>
          )}
        </div>
      </div>
      <Badge variant="outline" className="text-xs font-bold gap-1">
        <BookOpen className="w-3 h-3" /> {evaluation.subjectEvaluations.length} subjects
      </Badge>
    </div>
  )
}
