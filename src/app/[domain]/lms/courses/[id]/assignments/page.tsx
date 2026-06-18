import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getCourse, listCourseSubjects } from "@/actions/lms/courses"
import { listCourseAssignments, type AssignmentRow } from "@/actions/lms/assignments"
import { lmsAccessState } from "../../../access-states"
import { AssignmentsClient } from "./assignments-client"

export const metadata: Metadata = { title: "Assignments" }

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/assignments`)

  let course: Awaited<ReturnType<typeof getCourse>>
  let assignments: AssignmentRow[]
  try {
    ;[course, assignments] = await Promise.all([getCourse(id), listCourseAssignments(id)])
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:assignments:manage")
  const canGrade  = await hasPermission(session, "lms:assignments:grade")
  const subjects  = canManage ? await listCourseSubjects() : []

  return (
    <AssignmentsClient
      courseId={course.id}
      courseTitle={course.title}
      defaultSubjectId={course.subjectId}
      assignments={assignments}
      subjects={subjects}
      canManage={canManage}
      canGrade={canGrade}
    />
  )
}
