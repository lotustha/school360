import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getTrialStatus, getActiveModules } from "@/lib/modules"
import { getDashboardNotices } from "@/actions/notices"
import { DashboardClient } from "./dashboard-client"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "School management dashboard.",
}

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) {
    redirect(`/${domain}/login`)
  }

  const school = await prisma.school.findUnique({
    where: { slug: domain },
    include: {
      _count: {
        select: { users: true, faculties: true, classes: true, sections: true, subjects: true },
      },
    },
  })

  if (!school) notFound()

  const [trial, activeModules, notices] = await Promise.all([
    getTrialStatus(school.id),
    getActiveModules(school.id),
    getDashboardNotices(4).catch(() => []),
  ])

  return (
    <DashboardClient data={{ school, trial, activeModules, notices }} />
  )
}
