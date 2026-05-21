import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { AccountingNav } from "./accounting-nav"

export const metadata: Metadata = {
  title: { default: "Accounting", template: "%s | Accounting | School360" },
  description: "Double-entry accounting: vouchers, ledger, fiscal-year reports.",
}

export default async function AccountingLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) {
    redirect(`/${domain}/login?next=/accounting`)
  }
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <AccountingNav />
      {children}
    </div>
  )
}
