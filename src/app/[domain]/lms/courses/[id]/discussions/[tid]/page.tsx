import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getThread } from "@/actions/lms/discussions"
import { lmsAccessState } from "../../../../access-states"
import { ThreadView } from "../../../../_components/discussions/thread-view"

export const metadata: Metadata = { title: "Discussion" }

export default async function CourseThreadPage({
  params,
}: {
  params: Promise<{ domain: string; id: string; tid: string }>
}) {
  const { domain, id, tid } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/discussions/${tid}`)

  let data: Awaited<ReturnType<typeof getThread>>
  try {
    data = await getThread(tid)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Thread not found" || msg === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  return <ThreadView data={data} listHref={`/lms/courses/${id}/discussions`} />
}
