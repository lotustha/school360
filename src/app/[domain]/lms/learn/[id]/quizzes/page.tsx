import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMyQuizzes } from "@/actions/lms/quizzes"
import { lmsAccessState } from "../../../access-states"
import { MyQuizzesClient } from "./my-quizzes-client"

export const metadata: Metadata = { title: "Quizzes" }

export default async function MyQuizzesPage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn/${id}/quizzes`)

  let quizzes: Awaited<ReturnType<typeof getMyQuizzes>>
  try {
    quizzes = await getMyQuizzes(id)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "FORBIDDEN") redirect(`/${domain}/lms/learn`)
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn/${id}/quizzes`)
    if (state !== undefined) return state
    throw e
  }

  return <MyQuizzesClient courseId={id} quizzes={quizzes} />
}
