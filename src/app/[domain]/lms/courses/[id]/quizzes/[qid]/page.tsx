import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getQuizEditor } from "@/actions/lms/quizzes"
import { lmsAccessState } from "../../../../access-states"
import { QuizEditorClient } from "./quiz-editor-client"

export const metadata: Metadata = { title: "Edit Quiz" }

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ domain: string; id: string; qid: string }>
}) {
  const { domain, id, qid } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/courses/${id}/quizzes/${qid}`)

  let quiz: Awaited<ReturnType<typeof getQuizEditor>>
  try {
    quiz = await getQuizEditor(qid)
  } catch (e) {
    if ((e as Error).message === "Quiz not found") notFound()
    const state = lmsAccessState(e, domain, "lms:quizzes:manage")
    if (state === null) redirect(`/${domain}/login?next=/lms`)
    if (state !== undefined) return state
    throw e
  }

  return <QuizEditorClient courseId={id} quiz={quiz} />
}
