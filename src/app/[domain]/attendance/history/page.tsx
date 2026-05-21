import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, History } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getAttendanceHistory } from "@/actions/attendance"
import { todayBS, currentBSYear, bsMonthName } from "@/lib/nepali-date"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { columns, type AttendanceHistoryRow } from "./columns"

export const metadata: Metadata = { title: "Attendance History" }

export default async function AttendanceHistoryPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ classId?: string; month?: string }>
}) {
  const { domain } = await params
  const { classId, month } = await searchParams

  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const year    = currentBSYear()
  const monthBS = month ?? `${year}-${String(new Date().getMonth() + 1 + 2).padStart(2, "0")}` // rough current BS month

  const records = await getAttendanceHistory(school.id, {
    classId,
    fromBS: `${monthBS}-01`,
    toBS:   `${monthBS}-32`,
  })

  const rows: AttendanceHistoryRow[] = records.map(r => ({
    id:               r.id,
    studentName:      r.student.user.fullName,
    studentAvatarUrl: r.student.user.avatarUrl ?? null,
    takenByAvatarUrl: r.takenBy.avatarUrl ?? null,
    admissionNo:      r.student.admissionNo,
    className:        r.className,
    sectionName:      r.sectionName,
    dateBS:           r.dateBS,
    status:           r.status,
    takenBy:          r.takenBy.fullName,
    note:             r.note,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/attendance">
            <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5 hover:bg-primary/8">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">Attendance History</h1>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{rows.length} records</span>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 overflow-hidden shadow-sm">
        <DataTable columns={columns} data={rows} searchKey="studentName" />
      </div>
    </div>
  )
}
