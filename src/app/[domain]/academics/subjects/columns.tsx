"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, BookOpen, Layers, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type SubjectColumn = {
  id:              string
  name:            string
  code:            string
  className:       string
  creditHours:     number | null
  componentsCount: number
}

export const columns: ColumnDef<SubjectColumn>[] = [
  {
    accessorKey: "name",
    header: "Subject",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <BookOpen className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{row.getValue("name")}</p>
          <code className="text-[11px] text-slate-400 font-mono">{row.original.code}</code>
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
    accessorKey: "creditHours",
    header: "Credits",
    cell: ({ row }) => {
      const c = row.getValue("creditHours") as number | null
      return c != null ? (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
          {c} hr{c !== 1 ? "s" : ""}
        </span>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      )
    },
  },
  {
    accessorKey: "componentsCount",
    header: "Components",
    cell: ({ row }) => {
      const n = row.getValue("componentsCount") as number
      return n > 0 ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/8 text-primary border border-primary/20">
          <Layers className="w-3 h-3" /> {n} set
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
          <AlertCircle className="w-3 h-3" /> Not set
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
              <Layers className="w-3.5 h-3.5 text-primary" /> Manage Components
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Subject
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
