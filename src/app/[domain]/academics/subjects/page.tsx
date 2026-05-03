import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, SubjectColumn } from "./columns"
import { SubjectDrawer } from "./subject-drawer"
import { BookOpen, Layers, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export const metadata: Metadata = { title: "Subjects" }

export default async function SubjectsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [subjects, classes] = await Promise.all([
    prisma.subject.findMany({
      where: { schoolId: school.id },
      include: { class: true, components: true },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where: { schoolId: school.id },
      include: { faculty: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows: SubjectColumn[] = subjects.map(s => ({
    id:              s.id,
    name:            s.name,
    code:            s.code,
    className:       s.class.name,
    creditHours:     s.creditHours,
    componentsCount: s.components.length,
  }))

  const classesForDrawer = classes.map(c => ({
    id: c.id, name: c.name, facultyName: c.faculty?.name ?? null,
  }))

  const withoutComponents = rows.filter(r => r.componentsCount === 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Subjects</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "subject" : "subjects"} configured
            </p>
          </div>
        </div>
        <SubjectDrawer schoolId={school.id} classes={classesForDrawer} />
      </div>

      {/* Stats pills */}
      {rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs gap-1.5 bg-white/70 border border-white/40">
            <BookOpen className="w-3 h-3" /> {rows.length} Total
          </Badge>
          {withoutComponents > 0 && (
            <Badge variant="outline" className="text-xs gap-1.5 border-amber-300/70 text-amber-700 bg-amber-50/60">
              <Layers className="w-3 h-3" /> {withoutComponents} missing components
            </Badge>
          )}
        </div>
      )}

      {/* Alerts */}
      {classes.length === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>No classes found.</strong> Create classes before adding subjects.{" "}
              <Link href="/academics/classes" className="underline font-semibold hover:text-blue-900 transition-colors">
                Go to Classes →
              </Link>
            </p>
          </div>
        </div>
      )}

      {withoutComponents > 0 && rows.length > 0 && (
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Layers className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-0.5">
                {withoutComponents} {withoutComponents === 1 ? "subject" : "subjects"} missing evaluation components
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Use the <strong>⋯ menu</strong> on each subject to add Internal, External, or CAS components with marks and breakdowns.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={rows} searchKey="name" />
      </div>
    </div>
  )
}
