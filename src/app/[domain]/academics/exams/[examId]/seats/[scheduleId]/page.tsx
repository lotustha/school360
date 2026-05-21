import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Grid3X3 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  getScheduleScope, getScheduleBoards, listSeatsForSchedule, listEligibleStudents,
} from "@/actions/exam-seats"
import { formatBS } from "@/lib/nepali-date"
import { ExamTabs } from "../../exam-tabs"
import { SeatBoard } from "./seat-board"

export const metadata: Metadata = { title: "Seat Plan" }

export default async function SeatPlanPage({
  params,
}: {
  params: Promise<{ domain: string; examId: string; scheduleId: string }>
}) {
  const { domain, examId, scheduleId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const scope = await getScheduleScope(scheduleId, school.id)
  if (!scope) notFound()

  const [boards, seats, eligible, rooms] = await Promise.all([
    getScheduleBoards(scheduleId, school.id),
    listSeatsForSchedule(scheduleId, school.id),
    listEligibleStudents(scope.paperId, school.id),
    prisma.room.findMany({
      where:   { schoolId: school.id, isActive: true },
      include: { seats: { select: { kind: true, examUsable: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  const roomOptions = rooms.map(r => {
    const seats = r.seats
    return {
      id:           r.id,
      name:         r.name,
      capacity:     seats.filter(s => s.kind === "SEAT").length,
      examCapacity: seats.filter(s => s.kind === "SEAT" && s.examUsable).length,
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/academics/exams/${examId}/seats`}>
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> All sittings
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Grid3X3 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{scope.paperName} — Seat Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-mono">{formatBS(scope.dateBS)}</span> ·
            <span className="ml-1 font-mono">{scope.startTime}</span> ·
            <span className="ml-1 font-mono">{scope.durationMin}min</span>
          </p>
        </div>
      </div>

      <ExamTabs examId={examId} />

      <SeatBoard
        schoolId={school.id}
        examId={examId}
        scheduleId={scheduleId}
        initialBoards={boards}
        initialSeats={seats}
        initialEligible={eligible}
        rooms={roomOptions}
      />
    </div>
  )
}
