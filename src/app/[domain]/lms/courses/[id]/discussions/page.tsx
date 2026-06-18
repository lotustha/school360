import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { listThreads } from "@/actions/lms/discussions"
import { lmsAccessState } from "../../../access-states"
import { DiscussionsBoard } from "../../../_components/discussions/discussions-board"

export const metadata: Metadata = { title: "Discussions" }

export default async function CourseDiscussionsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/discussions`)

  let data: Awaited<ReturnType<typeof listThreads>>
  try {
    data = await listThreads(id)
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  return (
    <DiscussionsBoard
      courseId={id}
      backHref={`/lms/courses/${id}`}
      threadHrefBase={`/lms/courses/${id}/discussions`}
      data={data}
    />
  )
}
