"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, Grid3X3, DoorOpen, EyeOff, Eye, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { RoomRow } from "@/actions/rooms"

export function getColumns({
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
}: {
  onEdit:         (row: RoomRow) => void
  onDelete:       (row: RoomRow) => void
  onToggleActive: (row: RoomRow) => void
  onDuplicate:    (row: RoomRow) => void
}): ColumnDef<RoomRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Room",
      cell: ({ row }) => {
        const r = row.original
        return (
          <Link
            href={`/settings/rooms/${r.id}`}
            className="flex items-center gap-3 group/link"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <DoorOpen className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 group-hover/link:text-primary transition-colors">
                {r.name}
              </p>
              {r.notes && (
                <p className="text-[11px] text-slate-400 truncate max-w-[300px]">{r.notes}</p>
              )}
            </div>
          </Link>
        )
      },
    },
    {
      accessorKey: "capacity",
      header: "Capacity",
      cell: ({ row }) => {
        const total = row.original.capacity
        const exam  = row.original.examCapacity
        const allUsable = total === exam
        return (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              total > 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`} title="Physical capacity">
              <Grid3X3 className="w-2.5 h-2.5" />
              <span className="tabular-nums">{total}</span>
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              exam > 0
                ? allUsable
                  ? "bg-sky-50 text-sky-700 border-sky-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-400 border-slate-200"
            }`} title="Exam-usable seats">
              <span className="text-[10px]">✓</span>
              <span className="tabular-nums">{exam}</span>
              <span className="text-[9px] font-medium opacity-70">exam</span>
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "classCount",
      header: "Used by",
      cell: ({ row }) => {
        const c = row.original.classCount
        const e = row.original.examSeatCount
        if (c === 0 && e === 0) {
          return <span className="text-[11px] text-slate-400 italic">unused</span>
        }
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            {c > 0 && <span className="font-semibold">{c} class{c === 1 ? "" : "es"}</span>}
            {c > 0 && e > 0 && <span className="text-slate-300">·</span>}
            {e > 0 && <span className="text-slate-500">{e} exam seat{e === 1 ? "" : "s"}</span>}
          </div>
        )
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const on = row.original.isActive
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            on
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-slate-400"}`} />
            {on ? "Active" : "Disabled"}
          </span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link href={`/settings/rooms/${r.id}`}>
                    <Grid3X3 className="w-3.5 h-3.5 text-primary" /> Edit Layout
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(r)} className="cursor-pointer gap-2">
                  <Edit className="w-3.5 h-3.5 text-slate-500" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(r)} className="cursor-pointer gap-2">
                  <Copy className="w-3.5 h-3.5 text-sky-600" /> Duplicate room
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleActive(r)} className="cursor-pointer gap-2">
                  {r.isActive
                    ? <><EyeOff className="w-3.5 h-3.5 text-slate-500" /> Disable</>
                    : <><Eye    className="w-3.5 h-3.5 text-emerald-600" /> Re-enable</>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(r)}
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2"
                >
                  <Trash className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
