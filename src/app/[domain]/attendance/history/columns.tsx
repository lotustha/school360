"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"

export type AttendanceHistoryRow = {
  id:          string
  studentName: string
  admissionNo: string
  className:   string
  sectionName: string | null
  dateBS:      string
  status:      string
  takenBy:     string
  note:        string | null
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ABSENT:  "bg-rose-50    text-rose-700    border-rose-200",
  LATE:    "bg-amber-50   text-amber-700   border-amber-200",
  EXCUSED: "bg-blue-50    text-blue-700    border-blue-200",
}

export const columns: ColumnDef<AttendanceHistoryRow>[] = [
  {
    accessorKey: "dateBS",
    header: "Date (BS)",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{formatBS(row.getValue("dateBS"))}</span>
    ),
  },
  {
    accessorKey: "studentName",
    header: "Student",
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-sm">{row.getValue("studentName")}</div>
        <div className="text-xs text-muted-foreground font-mono">{row.original.admissionNo}</div>
      </div>
    ),
  },
  {
    accessorKey: "className",
    header: "Class",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue("className")}
        {row.original.sectionName && ` — ${row.original.sectionName}`}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.getValue<string>("status")
      return (
        <Badge variant="outline" className={cn("text-[10px] font-bold", STATUS_STYLE[s] ?? "")}>
          {s}
        </Badge>
      )
    },
  },
  {
    accessorKey: "takenBy",
    header: "Taken By",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.getValue("takenBy")}</span>,
  },
]
