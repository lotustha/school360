"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, FolderTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type FacultyColumn = {
  id:          string
  name:        string
  classCount:  number
  description?: string | null
}

export const columns: ColumnDef<FacultyColumn>[] = [
  {
    accessorKey: "name",
    header: "Faculty",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <FolderTree className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{row.getValue("name")}</p>
          <p className="text-[11px] text-slate-400">Academic stream</p>
        </div>
      </div>
    ),
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
            <DropdownMenuItem className="cursor-pointer gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Faculty
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
              <Trash className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
]
