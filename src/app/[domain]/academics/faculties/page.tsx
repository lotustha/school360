import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { FacultyDrawer } from "./faculty-drawer"
import { FacultiesTable, GENERAL_ROW_ID } from "./faculties-table"
import { type FacultyColumn } from "./columns"
import { FolderTree } from "lucide-react"

export const metadata: Metadata = { title: "Faculties" }

export default async function FacultiesPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, workingDays: true },
  })
  if (!school) notFound()

  const [faculties, generalClassCount] = await Promise.all([
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.class.count({ where: { schoolId: school.id, facultyId: null } }),
  ])

  const facultyRows: FacultyColumn[] = faculties.map(f => ({
    id: f.id, name: f.name, classCount: f._count.classes, workingDays: f.workingDays,
    kind: "faculty",
  }))

  // Synthetic "General" row — represents classes without a faculty. Backed by
  // School.workingDays; non-deletable; name not renameable.
  const generalRow: FacultyColumn = {
    id:           GENERAL_ROW_ID,
    name:         "General",
    classCount:   generalClassCount,
    workingDays:  school.workingDays,
    kind:         "general",
  }

  const rows = [generalRow, ...facultyRows]

  return (
    <div className="space-y-4">
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
        <FacultyDrawer schoolId={school.id} schoolWorkingDays={school.workingDays} />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <FacultiesTable rows={rows} schoolId={school.id} schoolWorkingDays={school.workingDays} />
      </div>
    </div>
  )
}
