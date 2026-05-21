import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import {
  getScheduleScope, getScheduleBoards, listSeatsForSchedule,
} from "@/actions/exam-seats"
import { SeatPrintView, type SeatPrintMode } from "./print-view"

export const metadata: Metadata = { title: "Print Seat Plan" }

interface PageProps {
  params:       Promise<{ domain: string; examId: string; scheduleId: string }>
  searchParams: Promise<{ roomId?: string; mode?: string }>
}

function parseMode(s: string | undefined): SeatPrintMode {
  if (s === "map" || s === "roster") return s
  return "both"
}
function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function SeatPrintPage({ params, searchParams }: PageProps) {
  const { domain, examId, scheduleId } = await params
  const sp = await searchParams
  const mode    = parseMode(sp.mode)
  const roomIds = parseList(sp.roomId)

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, name: true },
  })
  if (!school) notFound()

  const scope = await getScheduleScope(scheduleId, school.id)
  if (!scope) notFound()

  const [allBoards, seats] = await Promise.all([
    getScheduleBoards(scheduleId, school.id),
    listSeatsForSchedule(scheduleId, school.id),
  ])

  // Optionally filter to a subset of rooms
  const boards = roomIds.length > 0
    ? allBoards.filter(b => roomIds.includes(b.roomId))
    : allBoards

  return (
    <SeatPrintView
      schoolName={school.name}
      paperName={scope.paperName}
      dateBS={scope.dateBS}
      startTime={scope.startTime}
      durationMin={scope.durationMin}
      boards={boards}
      seats={seats}
      mode={mode}
      examId={examId}
    />
  )
}
