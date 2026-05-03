import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, ClassColumn } from "./columns"
import { ClassDrawer } from "./class-drawer"
import { GraduationCap, Info } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "Classes" }

export default async function ClassesPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [classes, faculties] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: school.id },
      include: { faculty: true, _count: { select: { sections: true, subjects: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where: { schoolId: school.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const rows: ClassColumn[] = classes.map(c => ({
    id: c.id, name: c.name,
    facultyName:   c.faculty?.name ?? null,
    sectionsCount: c._count.sections,
    subjectsCount: c._count.subjects,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Classes</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "class" : "classes"} configured
            </p>
          </div>
        </div>
        <ClassDrawer schoolId={school.id} faculties={faculties} />
      </div>

      {faculties.length === 0 && (
        <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-4">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Tip:</strong> For +2 schools, add faculties first (Science, Management, Humanities) so you can assign classes to streams.{" "}
              <Link href="/academics/faculties" className="underline font-semibold hover:text-blue-900 transition-colors">
                Add Faculties →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={rows} searchKey="name" />
      </div>
    </div>
  )
}
