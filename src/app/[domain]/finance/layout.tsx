import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export const metadata: Metadata = {
  title: { default: "Finance", template: "%s | Finance | School360" },
  description: "Fee collection and student receipts.",
}

export default async function FinanceLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/finance`)

  // Tabs are rendered globally in HeaderTabs (sticky header). No in-page nav pill.
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {children}
    </div>
  )
}
