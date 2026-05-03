"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Eye, UserX, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

export type StudentColumn = {
  id:          string
  admissionNo: string
  name:        string
  email:       string
  className:   string
  sectionName: string | null
  gender:      string
  status:      string
  guardian:    string | null
  guardianPhone: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE:     "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  LEFT:       "bg-slate-500/10 text-slate-600 border-slate-500/25",
  GRADUATED:  "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-400",
  SUSPENDED:  "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400",
}

export const columns: ColumnDef<StudentColumn>[] = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 rounded-xl">
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xs font-bold">
            {row.getValue<string>("name").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium text-sm">{row.getValue("name")}</div>
          <div className="text-xs text-muted-foreground">{row.original.admissionNo}</div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "className",
    header: "Class",
    cell: ({ row }) => (
      <div className="text-sm">
        <span className="font-medium">{row.getValue("className")}</span>
        {row.original.sectionName && (
          <span className="text-muted-foreground"> · {row.original.sectionName}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "guardian",
    header: "Guardian",
    cell: ({ row }) => (
      <div className="text-sm">
        <div>{row.original.guardian ?? "—"}</div>
        {row.original.guardianPhone && (
          <div className="text-xs text-muted-foreground font-mono">{row.original.guardianPhone}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "gender",
    header: "Gender",
    cell: ({ row }) => <span className="text-sm capitalize">{row.getValue<string>("gender").toLowerCase()}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue<string>("status")
      return (
        <Badge variant="outline" className={`text-[10px] font-bold ${statusColors[status] ?? ""}`}>
          {status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="glass border-white/25 dark:border-white/10">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/students/${row.original.id}`} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" /> View Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
            <UserX className="mr-2 h-4 w-4" /> Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
