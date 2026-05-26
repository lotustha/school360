import { Metadata } from "next"
import { Users as UsersIcon } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { getRecentlyCollectedStudents } from "@/actions/accounting/fee-payments"
import { StudentsClient } from "./students-client"

export const metadata: Metadata = { title: "Students · Fees" }

export default async function StudentsLandingPage() {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!

  const [classes, faculties, totalActive, recent] = await Promise.all([
    prisma.class.findMany({
      where:   { schoolId },
      include: { faculty: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.faculty.findMany({
      where:   { schoolId },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    getRecentlyCollectedStudents(6),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open a student to view and edit their fee schedule for the year.
          </p>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1">
          <UsersIcon className="w-3 h-3" />{totalActive} active student{totalActive === 1 ? "" : "s"}
        </div>
      </div>

      <StudentsClient
        classes={classes.map(c => ({ id: c.id, name: c.name, facultyName: c.faculty?.name ?? null }))}
        faculties={faculties}
        recent={recent}
      />
    </div>
  )
}
