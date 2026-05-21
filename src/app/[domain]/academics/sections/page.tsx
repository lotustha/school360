import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Prisma } from "../../../../../generated/prisma/client"
import { type SectionColumn } from "./columns"
import { SectionDrawer } from "./section-drawer"
import { SectionsTable } from "./sections-table"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { Users, Info } from "lucide-react"
import Link from "next/link"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"

export const metadata: Metadata = { title: "Sections" }

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ facultyId?: string; classId?: string }>
}

export default async function SectionsPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams
  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  // ─── Faculty filter: respect "none" sentinel for classes with no faculty ──
  const facultyNone     = facultyIds.includes("none")
  const realFacultyIds  = facultyIds.filter(id => id !== "none")
  const classFacultyFilter: Prisma.ClassWhereInput | undefined =
    realFacultyIds.length > 0 && facultyNone
      ? { OR: [{ facultyId: { in: realFacultyIds } }, { facultyId: null }] }
      : realFacultyIds.length > 0
        ? { facultyId: { in: realFacultyIds } }
        : facultyNone
          ? { facultyId: null }
          : undefined

  const sectionWhere: Prisma.SectionWhereInput = {
    schoolId: school.id,
    ...(classIds.length > 0 && { classId: { in: classIds } }),
    ...(classFacultyFilter && { class: classFacultyFilter }),
  }

  const [sections, classes, faculties] = await Promise.all([
    prisma.section.findMany({
      where: sectionWhere,
      include: {
        class: {
          include: {
            faculty:  true,
            subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: { faculty: true, sections: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows: SectionColumn[] = sections.map(s => ({
    id:          s.id,
    name:        s.name,
    classId:     s.classId,
    className:   s.class.name,
    facultyName: s.class.faculty?.name ?? null,
    subjects:    s.class.subjects.map(sub => sub.name),
  }))

  const classesForDrawer = sortClassesByFacultyThenName(
    classes.map(c => ({
      id: c.id, name: c.name, facultyName: c.faculty?.name ?? null,
    })),
  )

  const classesForFilter = sortClassesByFacultyThenName(
    classes.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyId:   c.facultyId,
      facultyName: c.faculty?.name ?? null,
      sections:    c.sections.map(s => ({ id: s.id, name: s.name })),
    })),
  )

  const filteredCount  = rows.length
  const unfilteredHint = (facultyIds.length > 0 || classIds.length > 0) ? " in scope" : " across all classes"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sections</h2>
            <p className="text-sm text-muted-foreground">
              {filteredCount} {filteredCount === 1 ? "section" : "sections"}{unfilteredHint}
            </p>
          </div>
        </div>
        <SectionDrawer schoolId={school.id} classes={classesForDrawer} />
      </div>

      <GlobalFiltersBar
        show={["facultyId", "classId"]}
        faculties={faculties}
        classes={classesForFilter}
      />

      {classes.length === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>No classes found.</strong> Create classes first before adding sections.{" "}
              <Link href="/academics/classes" className="underline font-semibold hover:text-blue-900 transition-colors">
                Go to Classes →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <SectionsTable rows={rows} schoolId={school.id} classes={classesForDrawer} />
      </div>
    </div>
  )
}
