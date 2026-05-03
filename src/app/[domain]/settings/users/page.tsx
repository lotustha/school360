import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { DataTable } from "@/components/ui/data-table"
import { columns, UserColumn } from "./columns"
import { Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Users | Settings | School360",
  description: "Manage users and granular access overrides.",
}

export default async function UsersPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const school = await prisma.school.findUnique({
    where: { slug: domain },
  })

  if (!school) return <div>School not found</div>

  const users = await prisma.user.findMany({
    where: { schoolId: school.id },
    include: {
      customRole: true,
      userPermissions: {
        include: { permission: true },
      },
    },
    orderBy: { fullName: "asc" },
  })

  const formattedUsers: UserColumn[] = users.map((user: any) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.customRole?.name || user.role,
    overridesCount: user.userPermissions.length,
  }))

  const withOverrides = formattedUsers.filter((u) => u.overridesCount > 0).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Users & Access</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage user accounts and specific permission overrides.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs gap-1.5">
          <Users className="w-3 h-3" />
          {formattedUsers.length} User{formattedUsers.length !== 1 ? "s" : ""}
        </Badge>
        {withOverrides > 0 && (
          <Badge variant="outline" className="text-xs gap-1.5 border-amber-300 text-amber-700 dark:text-amber-400">
            {withOverrides} with permission overrides
          </Badge>
        )}
      </div>

      <DataTable columns={columns} data={formattedUsers} searchKey="fullName" />
    </div>
  )
}
