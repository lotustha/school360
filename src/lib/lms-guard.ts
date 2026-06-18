import type { Session } from "next-auth"
import { requirePermission, getSchoolSession } from "@/lib/permissions"
import { requireAnyPermission } from "@/lib/guard"
import { requireModule } from "@/lib/modules"
import { prisma } from "@/lib/prisma"

// Shared LMS gates. Every LMS read goes through lms:view (or stronger lms:manage),
// every structural write through lms:manage, and both first assert the
// ONLINE_LEARNING subscription module is active for the tenant.

export async function gateLmsRead(): Promise<Session> {
  const session = await requireAnyPermission(["lms:view", "lms:manage"])
  await requireModule(session.user.schoolId!, "ONLINE_LEARNING")
  return session
}

export async function gateLmsManage(): Promise<Session> {
  const session = await requirePermission("lms:manage")
  await requireModule(session.user.schoolId!, "ONLINE_LEARNING")
  return session
}

/** Gate a specific LMS capability (e.g. lms:quizzes:manage) + module check. */
export async function gateLmsPermission(code: string): Promise<Session> {
  const session = await requirePermission(code)
  await requireModule(session.user.schoolId!, "ONLINE_LEARNING")
  return session
}

/**
 * Resolve the learner (Student) behind the current session. Used by all
 * student-facing LMS reads/writes. Requires the ONLINE_LEARNING module but NOT
 * a permission grant — being a logged-in student of the tenant is enough.
 * Throws FORBIDDEN if the session user is not a student.
 */
export async function gateLmsLearner(): Promise<{ session: Session; studentId: string }> {
  const session = await getSchoolSession()
  await requireModule(session.user.schoolId!, "ONLINE_LEARNING")
  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, schoolId: session.user.schoolId! },
    select: { id: true },
  })
  if (!student) throw new Error("FORBIDDEN")
  return { session, studentId: student.id }
}
