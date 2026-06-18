import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getCourse } from "@/actions/lms/courses"
import { listCourseLiveClasses, type LiveClassRow } from "@/actions/lms/live-classes"
import { lmsAccessState } from "../../../access-states"
import { LiveClassesClient } from "./live-classes-client"

export const metadata: Metadata = { title: "Live Classes" }

export default async function LiveClassesPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/live`)

  let course: Awaited<ReturnType<typeof getCourse>>
  let classes: LiveClassRow[]
  try {
    ;[course, classes] = await Promise.all([getCourse(id), listCourseLiveClasses(id)])
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:live:manage")

  return <LiveClassesClient courseId={course.id} courseTitle={course.title} classes={classes} canManage={canManage} />
}
