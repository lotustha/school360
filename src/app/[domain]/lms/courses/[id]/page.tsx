import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getCourse } from "@/actions/lms/courses"
import { lmsAccessState } from "../../access-states"
import { CourseBuilder } from "./course-builder"

export const metadata: Metadata = { title: "Course" }

export default async function CoursePage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}`)

  let course: Awaited<ReturnType<typeof getCourse>>
  try {
    course = await getCourse(id)
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:manage")

  return <CourseBuilder course={course} canManage={canManage} />
}
