import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getCourse } from "@/actions/lms/courses"
import { listCourseQuizzes, type QuizRow } from "@/actions/lms/quizzes"
import { lmsAccessState } from "../../../access-states"
import { QuizzesClient } from "./quizzes-client"

export const metadata: Metadata = { title: "Quizzes" }

export default async function QuizzesPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/quizzes`)

  let course: Awaited<ReturnType<typeof getCourse>>
  let quizzes: QuizRow[]
  try {
    ;[course, quizzes] = await Promise.all([getCourse(id), listCourseQuizzes(id)])
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:quizzes:manage")

  return <QuizzesClient courseId={course.id} courseTitle={course.title} quizzes={quizzes} canManage={canManage} />
}
