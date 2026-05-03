import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTrialStatus, getActiveModules } from "@/lib/modules"
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

  const school = await prisma.school.findUnique({
    where: { slug: domain },
    include: {
      _count: {
        select: { users: true, faculties: true, classes: true, sections: true, subjects: true },
      },
    },
  })

  if (!school) notFound()

  const [trial, activeModules] = await Promise.all([
    getTrialStatus(school.id),
    getActiveModules(school.id),
  ])

  return (
    <DashboardClient data={{ school, trial, activeModules }} />
  )
}
