import { Metadata } from "next"
import { notFound } from "next/navigation"
import { DoorOpen } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listRooms } from "@/actions/rooms"
import { RoomsTable } from "./rooms-table"
import { RoomDrawer } from "./room-drawer"

export const metadata: Metadata = { title: "Rooms" }

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const rows = await listRooms(school.id)

  const totalCapacity = rows.reduce((n, r) => n + r.capacity,     0)
  const examCapacity  = rows.reduce((n, r) => n + r.examCapacity, 0)
  const inUse         = rows.filter(r => r.classCount > 0 || r.examSeatCount > 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Rooms</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "room" : "rooms"} ·{" "}
              <span className="tabular-nums font-semibold text-slate-700">{totalCapacity}</span> total seats ·{" "}
              <span className="tabular-nums font-semibold text-sky-700">{examCapacity}</span> exam-usable · {inUse} in use
            </p>
          </div>
        </div>
        <RoomDrawer schoolId={school.id} />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <RoomsTable rows={rows} schoolId={school.id} />
      </div>
    </div>
  )
}
