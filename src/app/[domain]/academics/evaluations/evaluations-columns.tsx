"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import {
  MoreHorizontal, ClipboardCheck, Hash, Lock, Unlock, Eye, EyeOff,
  Pencil, Trash2, BookOpen, Award, GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type EvaluationRow = {
  id:               string
  name:             string
  description:      string | null
  sequenceNumber:   number
  isFinal:          boolean
  isLocked:         boolean
  publishAt:        Date | null
  createdAt:        Date
  classes:          { id: string; name: string; facultyName: string | null }[]
  academicYearId:   string
  academicYearName: string
  isCurrentYear:    boolean
  subjectsCount:    number
  componentsTotal:  number
  resultsEntered:   number
}

export function getEvaluationColumns({
  onEdit,
  onDelete,
  onToggleLock,
  onTogglePublish,
}: {
  onEdit:          (row: EvaluationRow) => void
  onDelete:        (row: EvaluationRow) => void
  onToggleLock:    (row: EvaluationRow) => void
  onTogglePublish: (row: EvaluationRow) => void
}): ColumnDef<EvaluationRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Evaluation",
      cell: ({ row }) => {
        const r = row.original
        return (
          <Link
            href={`/academics/evaluations/${r.id}`}
            className="flex items-center gap-3 group/name"
          >
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
              r.isFinal ? "bg-emerald-100" : "bg-blue-100",
            )}>
              <ClipboardCheck className={cn("w-4 h-4", r.isFinal ? "text-emerald-600" : "text-blue-600")} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate group-hover/name:text-primary transition-colors">
                {r.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />Seq {r.sequenceNumber}</span>
                {r.isFinal && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Award className="w-2.5 h-2.5" /> FINAL
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const d = row.original.description
        if (!d) return <span className="text-xs text-slate-400 italic">—</span>
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            {d}
          </span>
        )
      },
    },
    {
      id: "classes",
      header: "Classes",
      cell: ({ row }) => {
        const cs = row.original.classes
        if (cs.length === 0) return <span className="text-xs text-slate-400 italic">No classes</span>
        const visible = cs.slice(0, 4)
        const rest    = cs.length - visible.length
        return (
          <div className="flex flex-wrap items-center gap-1 max-w-md">
            <span className="lg:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <GraduationCap className="w-2.5 h-2.5" /> {cs.length}
            </span>
            <span className="hidden lg:contents">
              {visible.map(c => (
                <span
                  key={c.id}
                  title={c.facultyName ? `${c.name} · ${c.facultyName}` : c.name}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap"
                >
                  {c.name}
                </span>
              ))}
              {rest > 0 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"
                  title={cs.slice(4).map(c => c.name).join(", ")}
                >
                  +{rest}
                </span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "academicYearName",
      header: "Session",
      cell: ({ row }) => {
        const r = row.original
        return (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
            r.isCurrentYear
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-200",
          )}>
            {r.academicYearName}
            {r.isCurrentYear && <span className="text-[9px] font-bold">CURRENT</span>}
          </span>
        )
      },
    },
    {
      accessorKey: "subjectsCount",
      header: "Subjects",
      cell: ({ row }) => {
        const n = row.original.subjectsCount
        if (n === 0) return <span className="text-xs text-slate-400 italic">none</span>
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <BookOpen className="w-2.5 h-2.5" /> {n}
          </span>
        )
      },
    },
    {
      id: "progress",
      header: "Results",
      cell: ({ row }) => {
        const r = row.original
        const denom = r.subjectsCount
        const num   = denom > 0 ? Math.min(r.resultsEntered, denom) : 0
        const pct = denom === 0 ? 0 : Math.round((num / denom) * 100)
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-slate-200",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500 w-9 text-right">{pct}%</span>
          </div>
        )
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {r.isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            )}
            {r.publishAt ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Eye className="w-2.5 h-2.5" /> Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Draft
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const d = row.original.createdAt
        return (
          <span className="text-xs text-slate-500">
            {d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                <DropdownMenuItem asChild>
                  <Link href={`/academics/evaluations/${r.id}`} className="cursor-pointer gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" /> Open
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(r)} className="cursor-pointer gap-2">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onToggleLock(r)} className="cursor-pointer gap-2">
                  {r.isLocked
                    ? <><Unlock className="w-3.5 h-3.5 text-slate-500" /> Unlock</>
                    : <><Lock   className="w-3.5 h-3.5 text-slate-500" /> Lock</>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTogglePublish(r)} className="cursor-pointer gap-2">
                  {r.publishAt
                    ? <><EyeOff className="w-3.5 h-3.5 text-slate-500" /> Unpublish</>
                    : <><Eye    className="w-3.5 h-3.5 text-slate-500" /> Publish</>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(r)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
