"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ClassColumn = {
  id:            string
  name:          string
  facultyName:   string | null
  sectionsCount: number
  subjectsCount: number
}

export const columns: ColumnDef<ClassColumn>[] = [
  {
    accessorKey: "name",
    header: "Class",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <GraduationCap className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{row.getValue("name")}</p>
          {row.original.facultyName && (
            <p className="text-[11px] text-slate-400">{row.original.facultyName}</p>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "facultyName",
    header: "Stream",
    cell: ({ row }) => {
      const f = row.getValue("facultyName") as string | null
      return f ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />{f}
        </span>
      ) : (
        <span className="text-xs text-slate-400 italic">General</span>
      )
    },
  },
  {
    accessorKey: "sectionsCount",
    header: "Sections",
    cell: ({ row }) => {
      const n = row.getValue("sectionsCount") as number
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
          n > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          {n} sec
        </span>
      )
    },
  },
  {
    accessorKey: "subjectsCount",
    header: "Subjects",
    cell: ({ row }) => {
      const n = row.getValue("subjectsCount") as number
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
          n > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          {n} subj
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
              <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Class
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
