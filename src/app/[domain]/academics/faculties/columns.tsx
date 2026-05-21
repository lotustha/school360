"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, FolderTree, Globe2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DAY_LABELS_SHORT } from "@/lib/working-days"
import { cn } from "@/lib/utils"

export type FacultyColumn = {
  id:           string
  name:         string
  classCount:   number
  workingDays:  number[]
  description?: string | null
  /** "general" rows represent the no-faculty bucket (school default). Name is non-editable. */
  kind?:        "faculty" | "general"
}

const ORDERED_DAYS = [0, 1, 2, 3, 4, 5, 6]   // Sun → Sat

export function getColumns({
  onEdit,
  onDelete,
  schoolWorkingDays,
}: {
  onEdit:             (row: FacultyColumn) => void
  onDelete:           (row: FacultyColumn) => void
  schoolWorkingDays:  number[]
}): ColumnDef<FacultyColumn>[] {
  return [
    {
      accessorKey: "name",
      header: "Faculty",
      cell: ({ row }) => {
        const isGeneral = row.original.kind === "general"
        return (
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
              isGeneral ? "bg-slate-100" : "bg-violet-100",
            )}>
              {isGeneral
                ? <Globe2 className="w-4 h-4 text-slate-500" />
                : <FolderTree className="w-4 h-4 text-violet-600" />}
            </div>
            <div>
              <p className="font-semibold text-slate-800 flex items-center gap-2">
                {row.getValue("name")}
                {isGeneral && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    default
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">
                {isGeneral ? "Classes with no faculty" : "Academic stream"}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "classCount",
      header: "Classes",
      cell: ({ row }) => {
        const n = row.getValue("classCount") as number
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            n > 0
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : "bg-slate-50 text-slate-400 border-slate-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${n > 0 ? "bg-violet-500" : "bg-slate-300"}`} />
            {n} {n === 1 ? "class" : "classes"}
          </span>
        )
      },
    },
    {
      accessorKey: "workingDays",
      header: "Working Days",
      cell: ({ row }) => {
        const days       = row.getValue("workingDays") as number[]
        const isGeneral  = row.original.kind === "general"
        const inherited  = !isGeneral && (!days || days.length === 0)
        const effective  = inherited ? schoolWorkingDays : (days ?? [])
        const effectiveSet = new Set(effective)
        return (
          <div className="flex items-center gap-1">
            {ORDERED_DAYS.map(d => {
              const on = effectiveSet.has(d)
              return (
                <span key={d} title={DAY_LABELS_SHORT[d]}
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-black border",
                    on
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-300 border-slate-200",
                  )}>
                  {DAY_LABELS_SHORT[d][0]}
                </span>
              )
            })}
            {inherited && (
              <span className="ml-1.5 text-[10px] text-slate-400 italic">inherits school</span>
            )}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const isGeneral = row.original.kind === "general"
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                <DropdownMenuItem onClick={() => onEdit(row.original)} className="cursor-pointer gap-2">
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  {isGeneral ? "Edit Working Days" : "Edit Faculty"}
                </DropdownMenuItem>
                {!isGeneral && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(row.original)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
                      <Trash className="w-3.5 h-3.5" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
