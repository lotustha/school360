import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, FacultyColumn } from "./columns"
import { FacultyDrawer } from "./faculty-drawer"
import { FolderTree } from "lucide-react"

export const metadata: Metadata = { title: "Faculties" }

export default async function FacultiesPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const faculties = await prisma.faculty.findMany({
    where: { schoolId: school.id },
    include: { _count: { select: { classes: true } } },
    orderBy: { name: "asc" },
  })

  const rows: FacultyColumn[] = faculties.map(f => ({
    id: f.id, name: f.name, classCount: f._count.classes,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FolderTree className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Faculties</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "faculty" : "faculties"}
            </p>
          </div>
        </div>
        <FacultyDrawer schoolId={school.id} />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={rows} searchKey="name" />
      </div>
    </div>
  )
}
