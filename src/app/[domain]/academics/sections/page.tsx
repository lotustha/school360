import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, SectionColumn } from "./columns"
import { SectionDrawer } from "./section-drawer"
import { Users, Info } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "Sections" }

export default async function SectionsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [sections, classes] = await Promise.all([
    prisma.section.findMany({
      where: { schoolId: school.id },
      include: { class: { include: { faculty: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.class.findMany({
      where: { schoolId: school.id },
      include: { faculty: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows: SectionColumn[] = sections.map(s => ({
    id:          s.id,
    name:        s.name,
    className:   s.class.name,
    facultyName: s.class.faculty?.name ?? null,
  }))

  const classesForDrawer = classes.map(c => ({
    id: c.id, name: c.name, facultyName: c.faculty?.name ?? null,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sections</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "section" : "sections"} across all classes
            </p>
          </div>
        </div>
        <SectionDrawer schoolId={school.id} classes={classesForDrawer} />
      </div>

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
        <DataTable columns={columns} data={rows} searchKey="name" />
      </div>
    </div>
  )
}
