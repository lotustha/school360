import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getCourse } from "@/actions/lms/courses"
import { listEnrollments, getEnrollableStudents, type EnrollmentRow } from "@/actions/lms/enrollment"
import { lmsAccessState } from "../../../access-states"
import { StudentsClient } from "./students-client"

export const metadata: Metadata = { title: "Course Students" }

export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/students`)

  let course: Awaited<ReturnType<typeof getCourse>>
  let enrollments: EnrollmentRow[]
  try {
    ;[course, enrollments] = await Promise.all([getCourse(id), listEnrollments(id)])
  } catch (e) {
    if ((e as Error).message === "Course not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  const canManage = await hasPermission(session, "lms:manage")
  const enrollable = canManage ? await getEnrollableStudents(id) : { classes: [], students: [] }

  return (
    <StudentsClient
      courseId={course.id}
      courseTitle={course.title}
      enrollments={enrollments}
      canManage={canManage}
      enrollable={enrollable}
    />
  )
}
