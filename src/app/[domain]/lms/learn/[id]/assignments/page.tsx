import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMyAssignments } from "@/actions/lms/assignments"
import { lmsAccessState } from "../../../access-states"
import { MyAssignmentsClient } from "./my-assignments-client"

export const metadata: Metadata = { title: "Assignments" }

export default async function MyAssignmentsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn/${id}/assignments`)

  let assignments: Awaited<ReturnType<typeof getMyAssignments>>
  try {
    assignments = await getMyAssignments(id)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Course not found") notFound()
    if (msg === "FORBIDDEN") redirect(`/${domain}/lms/learn`)
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn/${id}/assignments`)
    if (state !== undefined) return state
    throw e
  }

  return <MyAssignmentsClient courseId={id} assignments={assignments} />
}
