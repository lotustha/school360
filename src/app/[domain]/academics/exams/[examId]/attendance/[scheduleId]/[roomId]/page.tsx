import { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getRoomAttendance } from "@/actions/exam-attendance"
import { formatBS } from "@/lib/nepali-date"
import { ExamTabs } from "../../../exam-tabs"
import { AttendanceBoard } from "./attendance-board"

export const metadata: Metadata = { title: "Mark Attendance" }

export default async function MarkAttendancePage({
  params,
}: {
  params: Promise<{ domain: string; examId: string; scheduleId: string; roomId: string }>
}) {
  const { domain, examId, scheduleId, roomId } = await params
  const [school, session] = await Promise.all([
    prisma.school.findUnique({ where: { slug: domain }, select: { id: true } }),
    getServerSession(authOptions),
  ])
  if (!school) notFound()
  if (!session?.user?.id) redirect("/login")

  const data = await getRoomAttendance(scheduleId, roomId, school.id)
  if (!data) notFound()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/academics/exams/${examId}/attendance`}>
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> All sittings
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">
            {data.scope.paperName} — <span className="font-mono">{data.scope.roomName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-mono tabular-nums">{formatBS(data.scope.dateBS)}</span> ·
            <span className="ml-1 font-mono">{data.scope.startTime}</span> ·
            <span className="ml-1 font-mono">{data.scope.durationMin}min</span>
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      <AttendanceBoard
        schoolId={school.id}
        markedById={session.user.id}
        scheduleId={scheduleId}
        roomId={roomId}
        initialRows={data.rows}
      />
    </div>
  )
}
