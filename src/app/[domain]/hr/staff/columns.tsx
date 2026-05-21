"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { StaffRow } from "@/actions/hr"

const ROLE_LABEL: Record<string, string> = {
  TEACHER:      "Teacher",
  STAFF:        "Staff",
  SCHOOL_ADMIN: "Admin",
}

const ROLE_STYLE: Record<string, string> = {
  TEACHER:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  SCHOOL_ADMIN: "bg-violet-50  text-violet-700  border-violet-200",
  STAFF:        "bg-slate-50   text-slate-600   border-slate-200",
}

export const columns: ColumnDef<StaffRow>[] = [
  {
    accessorKey: "fullName",
    header: "Name",
    cell: ({ row }) => {
      const initials = row.original.fullName
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
      return (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{row.getValue("fullName")}</p>
            <p className="text-[11px] text-slate-400">{row.original.email}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue<string>("role")
      return (
        <Badge variant="outline" className={cn("text-[10px] font-bold", ROLE_STYLE[role] ?? "")}>
          {ROLE_LABEL[role] ?? role}
        </Badge>
      )
    },
  },
  {
    accessorKey: "panNumber",
    header: "PAN",
    cell: ({ row }) => {
      const pan = row.getValue<string | null>("panNumber")
      return pan
        ? <span className="font-mono text-xs">{pan}</span>
        : <span className="text-xs text-slate-400 italic">—</span>
    },
  },
  {
    accessorKey: "baseSalary",
    header: "Base Salary",
    cell: ({ row }) => {
      const salary = row.getValue<number | null>("baseSalary")
      return salary != null
        ? <span className="font-mono text-sm font-semibold">Rs. {salary.toLocaleString()}</span>
        : <span className="text-xs text-slate-400 italic">Not set</span>
    },
  },
  {
    accessorKey: "ssfEnabled",
    header: "SSF",
    cell: ({ row }) => {
      const enabled = row.getValue<boolean | null>("ssfEnabled")
      if (enabled == null) return <span className="text-xs text-slate-400 italic">—</span>
      return (
        <Badge variant="outline" className={cn(
          "text-[10px] font-bold",
          enabled ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200"
        )}>
          {enabled ? "SSF" : "No SSF"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row: _ }) => (
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuItem className="cursor-pointer gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Staff
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
              <Trash className="w-3.5 h-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
]
