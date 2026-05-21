import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getStaff } from "@/actions/hr"
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"
import { StaffDrawer } from "./staff-drawer"

export const metadata: Metadata = { title: "Staff" }

export default async function StaffPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const staff = await getStaff(school.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <StaffDrawer schoolId={school.id} />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 overflow-hidden shadow-sm">
        <DataTable columns={columns} data={staff} searchKey="fullName" />
      </div>
    </div>
  )
}
