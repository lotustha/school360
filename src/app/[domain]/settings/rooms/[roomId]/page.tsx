import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, DoorOpen } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getRoomWithSeats, listRooms } from "@/actions/rooms"
import { SeatLayoutEditor } from "./seat-layout-editor"

export const metadata: Metadata = { title: "Edit Room Layout" }

export default async function RoomLayoutPage({
  params,
}: {
  params: Promise<{ domain: string; roomId: string }>
}) {
  const { domain, roomId } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const [room, allRooms] = await Promise.all([
    getRoomWithSeats(roomId, school.id),
    listRooms(school.id),
  ])
  if (!room) notFound()

  // Other rooms (with at least one seat) that can serve as a copy source.
  const sourceCandidates = allRooms
    .filter(r => r.id !== room.id && r.capacity > 0)
    .map(r => ({ id: r.id, name: r.name, capacity: r.capacity }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/settings/rooms">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> All rooms
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <DoorOpen className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900">{room.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Design the physical seat layout. Variable widths per row are supported —
            row 1 can have 4 seats, row 2 can have 2 seats. Cycle a seat through
            <strong className="ml-1">Seat → Aisle → Teacher desk</strong> by clicking.
            Drag rows to reorder.
          </p>
        </div>
      </div>

      <SeatLayoutEditor
        roomId={room.id}
        schoolId={school.id}
        initialSeats={room.seats}
        initialRowCount={room.rowCount}
        examSeatCount={room.examSeatCount}
        sourceCandidates={sourceCandidates}
      />
    </div>
  )
}
