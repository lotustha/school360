import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getAssignmentForGrading } from "@/actions/lms/assignments"
import { lmsAccessState } from "../../../../access-states"
import { GradingClient } from "./grading-client"

export const metadata: Metadata = { title: "Grade Assignment" }

export default async function GradingPage({
  params,
}: {
  params: Promise<{ domain: string; id: string; aid: string }>
}) {
  const { domain, id, aid } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/assignments/${aid}`)

  let data: Awaited<ReturnType<typeof getAssignmentForGrading>>
  try {
    data = await getAssignmentForGrading(aid)
  } catch (e) {
    if ((e as Error).message === "Assignment not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canGrade = await hasPermission(session, "lms:assignments:grade")

  return <GradingClient courseId={id} assignment={data.assignment} rows={data.rows} canGrade={canGrade} />
}
