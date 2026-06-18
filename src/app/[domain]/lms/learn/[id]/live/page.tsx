import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMyLiveClasses } from "@/actions/lms/live-classes"
import { lmsAccessState } from "../../../access-states"
import { MyLiveClassesClient } from "./my-live-client"

export const metadata: Metadata = { title: "Live Classes" }

export default async function MyLivePage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/lms/learn/${id}/live`)

  let classes: Awaited<ReturnType<typeof getMyLiveClasses>>
  try {
    classes = await getMyLiveClasses(id)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === "FORBIDDEN") redirect(`/${domain}/lms/learn`)
    const state = lmsAccessState(e, domain)
    if (state === null) redirect(`/${domain}/login?next=/lms/learn/${id}/live`)
    if (state !== undefined) return state
    throw e
  }

  return <MyLiveClassesClient courseId={id} classes={classes} />
}
