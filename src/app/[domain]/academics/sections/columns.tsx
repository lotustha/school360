"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type SectionColumn = {
  id:          string
  name:        string
  classId:     string
  className:   string
  facultyName: string | null
  subjects:    string[]
}

export function getColumns({
  onEdit,
  onDelete,
}: {
  onEdit:   (row: SectionColumn) => void
  onDelete: (row: SectionColumn) => void
}): ColumnDef<SectionColumn>[] {
  return [
    {
      accessorKey: "name",
      header: "Section",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Section {row.getValue("name")}</p>
            <p className="text-[11px] text-slate-400">Student group</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "className",
      header: "Class",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {row.getValue("className")}
        </span>
      ),
    },
    {
      accessorKey: "facultyName",
      header: "Stream",
      cell: ({ row }) => {
        const f = row.getValue("facultyName") as string | null
        return f ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
            {f}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">General</span>
        )
      },
    },
    {
      accessorKey: "subjects",
      header: "Subjects",
      cell: ({ row }) => {
        const names   = row.original.subjects
        const n       = names.length
        const visible = names.slice(0, 4)
        const rest    = n - visible.length
        if (n === 0) return <span className="text-xs text-slate-400 italic">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            <span className="lg:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {n} subj
            </span>
            <span className="hidden lg:contents">
              {visible.map(s => (
                <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                  {s}
                </span>
              ))}
              {rest > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  +{rest}
                </span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
              <DropdownMenuItem onClick={() => onEdit(row.original)} className="cursor-pointer gap-2">
                <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Section
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(row.original)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
                <Trash className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]
}
