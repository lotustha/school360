import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, RoleColumn } from "./columns"
import { Shield, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Roles | Settings | School360",
  description: "Manage system and custom roles for your school.",
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const school = await prisma.school.findUnique({
    where: { slug: domain },
  })

  if (!school) return <div>School not found</div>

  const roles = await prisma.role.findMany({
    where: {
      OR: [
        { schoolId: null },      // Global system roles
        { schoolId: school.id }, // This school's custom roles
      ],
    },
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  })

  const formattedRoles: RoleColumn[] = roles.map((role: any) => ({
    id: role.id,
    name: role.name,
    description: role.description || "No description provided",
    type: role.schoolId ? "Custom" : "System",
    userCount: role._count.users,
  }))

  const systemRoles = formattedRoles.filter((r) => r.type === "System").length
  const customRoles = formattedRoles.filter((r) => r.type === "Custom").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Roles & Permissions</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage access roles for your staff and admins.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Role
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs gap-1.5">
          <Shield className="w-3 h-3" />
          {systemRoles} System Role{systemRoles !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline" className="text-xs gap-1.5">
          <Shield className="w-3 h-3 text-primary" />
          {customRoles} Custom Role{customRoles !== 1 ? "s" : ""}
        </Badge>
      </div>

      <DataTable columns={columns} data={formattedRoles} searchKey="name" />
    </div>
  )
}
