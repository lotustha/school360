import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getLearnerCourse } from "@/actions/lms/progress"
import { lmsAccessState } from "../../access-states"
import { CoursePlayer } from "./course-player"

export const metadata: Metadata = { title: "Learn" }

export default async function LearnPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn/${id}`)

  let data: Awaited<ReturnType<typeof getLearnerCourse>>
  try {
    data = await getLearnerCourse(id)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "Course not found") notFound()
    if (msg === "FORBIDDEN") redirect(`/${domain}/lms/learn`) // not enrolled
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn/${id}`)
    if (state !== undefined) return state
    throw e
  }

  return (
    <CoursePlayer
      course={data.course}
      completedLessonIds={data.completedLessonIds}
    />
  )
}
