import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getGradingSettings } from "@/actions/grading"
import { listRubrics } from "@/actions/evaluation"
import { GradingTabs } from "./grading-tabs"

export const metadata: Metadata = { title: "Grading" }

export default async function GradingPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const [school, session] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain } }),
    getServerSession(authOptions),
  ])
  if (!school) notFound()

  const [settings, rubrics] = await Promise.all([
    getGradingSettings(school.id),
    listRubrics(school.id),
  ])

  return (
    <GradingTabs
      schoolId={school.id}
      userId={session?.user?.id ?? ""}
      initialSettings={settings}
      initialRubrics={rubrics}
    />
  )
}
