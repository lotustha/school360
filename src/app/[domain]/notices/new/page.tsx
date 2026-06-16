import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { hasPermission } from "@/lib/permissions"
import { getNoticeTargets } from "@/actions/notices"
import { ArrowLeft, Paperclip } from "lucide-react"
import { NoticeForm } from "./notice-form"

export const metadata: Metadata = { title: "New Notice · Notice Board" }

export default async function NewNoticePage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) redirect(`/${domain}/login?next=/notices/new`)
  if (!(await hasPermission(session, "notice:manage"))) redirect("/notices")

  const targets = await getNoticeTargets()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/notices"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />Notice Board
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Publish a Notice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The notice goes live immediately and shows on the dashboard, notice board, and mobile app.
        </p>
      </div>

      <NoticeForm targets={targets} />

      <p className="text-[10px] text-slate-400 inline-flex items-center gap-1">
        <Paperclip className="w-3 h-3" />
        File attachments will be available once document storage is enabled.
      </p>
    </div>
  )
}
