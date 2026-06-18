import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getAttempt } from "@/actions/lms/quizzes"
import { lmsAccessState } from "../../../../../access-states"
import { TakeQuizClient } from "./take-quiz-client"

export const metadata: Metadata = { title: "Take Quiz" }

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ domain: string; id: string; attemptId: string }>
}) {
  const { domain, id, attemptId } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn/${id}/quizzes`)

  let data: Awaited<ReturnType<typeof getAttempt>>
  try {
    data = await getAttempt(attemptId)
  } catch (e) {
    if ((e as Error).message === "Attempt not found") notFound()
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn/${id}/quizzes`)
    if (state !== undefined) return state
    throw e
  }

  // Already submitted → back to list.
  if (data.attempt.status !== "IN_PROGRESS") redirect(`/${domain}/lms/learn/${id}/quizzes`)

  return <TakeQuizClient courseId={id} attempt={data.attempt} quiz={data.quiz} questions={data.questions} />
}
