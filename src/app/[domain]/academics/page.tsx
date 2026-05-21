import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  GraduationCap, BookOpen, Users, FolderTree, CalendarRange,
  ArrowRight, Plus, AlertCircle, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { notFound } from "next/navigation"

export const metadata: Metadata = { title: "Overview" }

export default async function AcademicsOverviewPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [faculties, classes, sectionCount, subjectCount, academicYearCount] = await Promise.all([
    prisma.faculty.findMany({
      where: { schoolId: school.id },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
      take: 5,
    }),
    prisma.class.findMany({
      where: { schoolId: school.id },
      include: { faculty: { select: { name: true } }, _count: { select: { sections: true, subjects: true } } },
      orderBy: { name: "asc" },
      take: 6,
    }),
    prisma.section.count({ where: { schoolId: school.id } }),
    prisma.subject.count({ where: { schoolId: school.id } }),
    prisma.academicYear.count({ where: { schoolId: school.id } }),
  ])

  const isEmpty = faculties.length === 0 && classes.length === 0

  const statCards = [
    { title: "Faculties",  value: faculties.length,    desc: "Streams & branches",   icon: FolderTree,    color: "text-violet-600", bg: "bg-violet-500/8",  border: "border-violet-500/20", href: "/academics/faculties" },
    { title: "Classes",    value: classes.length,      desc: "Grades configured",    icon: GraduationCap, color: "text-primary",    bg: "bg-primary/8",     border: "border-primary/20",    href: "/academics/classes" },
    { title: "Sections",   value: sectionCount,        desc: "Student groups",       icon: Users,         color: "text-blue-600",   bg: "bg-blue-500/8",    border: "border-blue-500/20",   href: "/academics/sections" },
    { title: "Subjects",   value: subjectCount,        desc: "With components",      icon: BookOpen,      color: "text-amber-600",  bg: "bg-amber-500/8",   border: "border-amber-500/20",  href: "/academics/subjects" },
    { title: "Sessions",   value: academicYearCount,   desc: "Per-faculty AYs",      icon: CalendarRange, color: "text-rose-600",   bg: "bg-rose-500/8",    border: "border-rose-500/20",   href: "/academics/years" },
  ]

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(stat => (
          <Link key={stat.title} href={stat.href} className="block group">
            <div className={cn(
              "bg-white/70 backdrop-blur-xl rounded-xl border p-5 transition-all duration-200",
              "hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 cursor-pointer",
              stat.border
            )}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div className="text-3xl font-bold tabular-nums">{stat.value}</div>
              <div className="text-sm font-semibold mt-0.5">{stat.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
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
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Faculties panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
              <div>
                <p className="font-semibold text-sm">Faculties</p>
                <p className="text-xs text-muted-foreground">Academic streams</p>
              </div>
              <Link href="/academics/faculties">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="p-3">
              {faculties.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No faculties yet.</p>
                  <Link href="/academics/faculties">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer"><Plus className="w-3 h-3" />Add Faculty</Button>
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {faculties.map(f => (
                    <li key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-primary/4 transition-colors group cursor-default">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <FolderTree className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <span className="text-sm font-medium">{f.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-semibold bg-white/80">
                        {f._count.classes} class{f._count.classes !== 1 ? "es" : ""}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Classes panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
              <div>
                <p className="font-semibold text-sm">Classes</p>
                <p className="text-xs text-muted-foreground">With sections &amp; subjects</p>
              </div>
              <Link href="/academics/classes">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="p-3">
              {classes.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No classes yet.</p>
                  <Link href="/academics/classes">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer"><Plus className="w-3 h-3" />Add Class</Button>
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {classes.map(cls => (
                    <li key={cls.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-primary/4 transition-colors cursor-default">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{cls.name}</span>
                          {cls.faculty && (
                            <span className="text-xs text-muted-foreground ml-1.5">· {cls.faculty.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 bg-white/60">
                          {cls._count.sections}S
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 bg-white/60">
                          {cls._count.subjects}Sub
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup alert */}
      {!isEmpty && (subjectCount === 0 || sectionCount === 0) && (
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-5">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Setup incomplete</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                {sectionCount === 0 && "Add sections to group students into classes. "}
                {subjectCount === 0 && "Configure subjects with evaluation components to enable gradebooks."}
              </p>
              <div className="flex gap-2 mt-3">
                {sectionCount === 0 && (
                  <Link href="/academics/sections">
                    <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 cursor-pointer">
                      Add Sections
                    </Button>
                  </Link>
                )}
                {subjectCount === 0 && (
                  <Link href="/academics/subjects">
                    <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 cursor-pointer">
                      Add Subjects
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
