import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export const metadata: Metadata = {
  title: { default: "Academic Calendar", template: "%s | Calendar | School360" },
  description: "School events, holidays, and the Bikram Sambat academic calendar.",
}

export default async function CalendarLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/calendar`)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {children}
    </div>
  )
}
