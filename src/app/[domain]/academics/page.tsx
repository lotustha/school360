import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  GraduationCap, BookOpen, Users, FolderTree, CalendarRange,
  ArrowRight, Plus, AlertCircle, CheckCircle2, Circle, Wrench,
  ClipboardCheck, Calendar as CalendarIcon, BarChart3, FileSpreadsheet, Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Overview" }

export default async function AcademicsOverviewPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [
    faculties, classes,
    sectionCount, subjectCount, studentCount,
    componentCount, examCount, evaluationCount,
    classesWithSchedule,
    academicYears, currentAY,
  ] = await Promise.all([
    prisma.faculty.findMany({
      where: { schoolId: school.id },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: { faculty: { select: { name: true } }, _count: { select: { sections: true, subjects: true, students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.section.count({ where: { schoolId: school.id } }),
    prisma.subject.count({ where: { schoolId: school.id } }),
    prisma.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
    prisma.evaluationComponent.count({ where: { subjectEvaluation: { subject: { schoolId: school.id } } } }),
    prisma.exam.count({ where: { schoolId: school.id } }),
    prisma.evaluation.count({ where: { schoolId: school.id } }),
    prisma.class.count({ where: { schoolId: school.id, periodScheduleId: { not: null } } }),
    prisma.academicYear.findMany({ where: { schoolId: school.id }, orderBy: [{ isCurrent: "desc" }, { startDateBS: "desc" }] }),
    prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true } }),
  ])

  const isEmpty = faculties.length === 0 && classes.length === 0

  // Setup checklist — readiness signals. Faculties are intentionally excluded:
  // classes can live under the "General" stream (null facultyId), so requiring
  // an explicit faculty would falsely mark a working school as incomplete.
  const checklist = [
    { label: "Academic year set",      done: !!currentAY,                       href: "/academics/years",       hint: currentAY ? `Current: ${currentAY.name}` : "Mark one AY as current" },
    { label: "Classes configured",     done: classes.length > 0,                href: "/academics/classes",     hint: `${classes.length} class${classes.length === 1 ? "" : "es"}` },
    { label: "Sections grouping",      done: sectionCount > 0,                  href: "/academics/sections",    hint: `${sectionCount} section${sectionCount === 1 ? "" : "s"}` },
    { label: "Subjects with components", done: subjectCount > 0 && componentCount > 0, href: "/academics/subjects", hint: subjectCount === 0 ? "No subjects yet" : `${componentCount} component${componentCount === 1 ? "" : "s"} on ${subjectCount} subject${subjectCount === 1 ? "" : "s"}` },
    { label: "Routine published",      done: classesWithSchedule > 0,           href: "/academics/routine",     hint: classes.length > 0 ? `${classesWithSchedule}/${classes.length} class${classes.length === 1 ? "" : "es"} have a period schedule` : "Add classes first" },
    { label: "Exams scheduled",        done: examCount > 0,                     href: "/academics/exams",       hint: `${examCount} exam${examCount === 1 ? "" : "s"}` },
  ]
  const doneCount = checklist.filter(c => c.done).length
  const readiness = Math.round((doneCount / checklist.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Academics</h1>
            {currentAY ? (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200">
                AY {currentAY.name} · CURRENT
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200">
                No current AY
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Faculties, classes, sections, subjects, routine, exams — and gradebook readiness.
          </p>
        </div>
      </div>

      {/* KPI strip — 6 metrics on desktop, scrolling on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Students"  value={studentCount}        sub="Active enrolment"   tone="emerald" icon={Users}        href="/students" />
        <Kpi label="Classes"   value={classes.length}      sub="Grades configured"  tone="primary" icon={GraduationCap} href="/academics/classes" />
        <Kpi label="Subjects"  value={subjectCount}        sub={`${componentCount} components`} tone="amber"  icon={BookOpen}      href="/academics/subjects" />
        <Kpi label="Sections"  value={sectionCount}        sub="Student groupings"  tone="sky"     icon={Users}         href="/academics/sections" />
        <Kpi label="Faculties" value={faculties.length}    sub={faculties.length === 0 ? "Using General stream" : "Streams"} tone="violet"  icon={FolderTree}    href="/academics/faculties" />
        <Kpi label="Sessions"  value={academicYears.length} sub={currentAY ? `Current: ${currentAY.name}` : "—"} tone="rose" icon={CalendarRange} href="/academics/years" />
      </div>

      {/* Setup checklist + Submodule shortcuts (2-col on desktop) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-500" /> Setup checklist
              </h2>
              <p className="text-[11px] text-slate-500">Each row links to where it&apos;s configured.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    readiness === 100 ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                    : readiness >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : "bg-gradient-to-r from-rose-400 to-rose-500",
                  )}
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <span className="text-xs font-bold font-mono tabular-nums text-slate-700">{readiness}%</span>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {checklist.map(item => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors cursor-pointer group"
                >
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-bold truncate", item.done ? "text-slate-700" : "text-slate-500")}>{item.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.hint}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Submodule shortcuts */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold tracking-tight">Manage</h2>
            <p className="text-[11px] text-slate-500">Submodules</p>
          </div>
          <div className="p-3 space-y-1.5">
            <SubmoduleLink href="/academics/routine"     icon={CalendarIcon}     label="Routine"     desc="Period timetable" />
            <SubmoduleLink href="/academics/exams"       icon={ClipboardCheck}   label="Exams"       desc="Terminal exam setup" />
            <SubmoduleLink href="/academics/grading"     icon={BarChart3}        label="Grading"     desc="Marks bands & GPA" />
            <SubmoduleLink href="/academics/evaluations" icon={Star}             label="Evaluations" desc="CAS rubric framework" />
            <SubmoduleLink href="/academics/years"       icon={FileSpreadsheet}  label="Sessions"    desc="Academic years" />
          </div>
        </div>
      </div>

      {/* Empty state OR Faculties + Classes panels */}
      {isEmpty ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 border-dashed p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2 tracking-tight">Start building your academic structure</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Set up faculties first (Science, Management), then add classes, sections, and subjects.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/academics/faculties">
              <Button className="gap-1.5 cursor-pointer shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> Add First Faculty
              </Button>
            </Link>
            <Link href="/academics/classes">
              <Button variant="outline" className="gap-1.5 cursor-pointer hover:bg-primary/5 hover:border-primary/40">
                <GraduationCap className="w-4 h-4" /> Add Class
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Faculties panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Faculties</h2>
                <p className="text-[11px] text-slate-500">{faculties.length} total</p>
              </div>
              <Link href="/academics/faculties" className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                View all →
              </Link>
            </div>
            {faculties.length === 0 ? (
              <div className="py-8 px-5 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 mb-3">
                  <FolderTree className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-xs font-bold text-violet-700">General</span>
                </div>
                <p className="text-sm text-slate-700 font-semibold mb-1">All classes are under the General stream</p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-3">
                  Faculties are optional. Add them only if your school splits Grade 11–12 into
                  Science / Management / Humanities streams with separate classes per stream.
                </p>
                <Link href="/academics/faculties">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer">
                    <Plus className="w-3 h-3" /> Add Faculty
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {faculties.map(f => (
                  <li key={f.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <FolderTree className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 truncate">{f.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-slate-50">
                      {f._count.classes} class{f._count.classes !== 1 ? "es" : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Classes panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Classes</h2>
                <p className="text-[11px] text-slate-500">{classes.length} total · sections · subjects · students</p>
              </div>
              <Link href="/academics/classes" className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                View all →
              </Link>
            </div>
            {classes.length === 0 ? (
              <div className="py-8 text-center px-3">
                <p className="text-sm text-slate-500 mb-3">No classes yet.</p>
                <Link href="/academics/classes">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer"><Plus className="w-3 h-3" />Add Class</Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {classes.map(cls => (
                  <li key={cls.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{cls.name}</p>
                        {cls.faculty && (
                          <p className="text-[10px] text-violet-700 uppercase tracking-widest font-bold">{cls.faculty.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Mini label={`${cls._count.students}`} title="Students" tone="emerald" />
                      <Mini label={`${cls._count.sections}S`} title="Sections" tone="sky" />
                      <Mini label={`${cls._count.subjects}Sub`} title="Subjects" tone="amber" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Setup alert */}
      {!isEmpty && (subjectCount === 0 || sectionCount === 0) && (
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-2xl p-5">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Setup incomplete</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                {sectionCount === 0 && "Add sections to group students into classes. "}
                {subjectCount === 0 && "Configure subjects with evaluation components to enable gradebooks. "}
                Use the Setup checklist above to track everything.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Activity footnote */}
      {!isEmpty && (
        <p className="text-[10px] text-slate-400 inline-flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {evaluationCount > 0
            ? `${evaluationCount} evaluation${evaluationCount === 1 ? "" : "s"} configured across exams.`
            : "No evaluations recorded yet — set up gradebook components on each subject."}
        </p>
      )}
    </div>
  )
}

function Kpi({
  label, value, sub, tone, icon: Icon, href,
}: {
  label: string; value: number; sub: string
  tone: "emerald" | "primary" | "sky" | "violet" | "rose" | "amber"
  icon: React.ElementType
  href: string
}) {
  const palette = {
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    sky:     { ring: "ring-sky-100",     icon: "text-sky-600 bg-sky-50",         value: "text-sky-700" },
    violet:  { ring: "ring-violet-100",  icon: "text-violet-600 bg-violet-50",   value: "text-violet-700" },
    rose:    { ring: "ring-rose-100",    icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
    amber:   { ring: "ring-amber-100",   icon: "text-amber-700 bg-amber-50",     value: "text-amber-700" },
  }[tone]
  return (
    <Link href={href} className="block group">
      <div className={cn(
        "bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 ring-1 h-full",
        palette.ring,
        "hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer",
      )}>
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", palette.icon)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className={cn("text-xl font-bold font-mono tabular-nums leading-tight", palette.value)}>{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>
      </div>
    </Link>
  )
}

function SubmoduleLink({
  href, icon: Icon, label, desc,
}: { href: string; icon: React.ElementType; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer group">
      <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{label}</p>
        <p className="text-[10px] text-slate-500 truncate">{desc}</p>
      </div>
      <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
    </Link>
  )
}

function Mini({ label, title, tone }: { label: string; title: string; tone: "emerald" | "sky" | "amber" }) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky:     "bg-sky-50 text-sky-700",
    amber:   "bg-amber-50 text-amber-700",
  }[tone]
  return (
    <span className={cn("inline-block text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", cls)} title={title}>
      {label}
    </span>
  )
}
