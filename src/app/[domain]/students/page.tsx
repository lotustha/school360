import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { columns, StudentColumn } from "./columns"
import { StudentDrawer } from "./student-drawer"

export const metadata: Metadata = { title: "Students" }

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const school = await prisma.school.findUnique({
    where: { slug: domain },
    include: {
      students: {
        include: {
          user:      { select: { fullName: true, email: true } },
          class:     { select: { name: true } },
          section:   { select: { name: true } },
          guardians: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { admissionNo: "asc" },
      },
      classes: {
        orderBy: { name: "asc" },
        include: { sections: { orderBy: { name: "asc" } } },
      },
    },
  })

  if (!school) notFound()

  const rows: StudentColumn[] = school.students.map(s => ({
    id:             s.id,
    admissionNo:    s.admissionNo,
    name:           s.user.fullName,
    email:          s.user.email,
    className:      s.class.name,
    sectionName:    s.section?.name ?? null,
    gender:         s.gender,
    status:         s.status,
    guardian:       s.guardians[0]?.name ?? null,
    guardianPhone:  s.guardians[0]?.phone ?? null,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Students</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} student{rows.length !== 1 ? "s" : ""} enrolled
            </p>
          </div>
        </div>
        <StudentDrawer
          schoolId={school.id}
          slug={school.slug}
          classes={school.classes}
        />
      </div>

      <div className="glass rounded-xl border border-white/25 dark:border-white/8 overflow-hidden">
        <DataTable columns={columns} data={rows} searchKey="name" />
      </div>
    </div>
  )
}
