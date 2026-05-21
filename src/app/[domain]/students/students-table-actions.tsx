"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  EyeOff, Printer, Settings2, ListChecks, Users2, FileText, ClipboardList,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { COLUMNS, type ColumnKey } from "./students-table"

interface Props {
  visibleColumns:   Set<ColumnKey>
  onColumnToggle:   (key: ColumnKey, visible: boolean) => void
  onResetColumns:   () => void
}

const PRINT_PRESETS = [
  {
    mode:    "ptm",
    label:   "Teacher–Parent Meeting",
    desc:    "Class roster + parent name + signature column",
    icon:    Users2,
    accent:  "text-blue-600",
  },
  {
    mode:    "tour",
    label:   "Tour Attendance",
    desc:    "Present checkbox + time in/out + signature",
    icon:    ClipboardList,
    accent:  "text-emerald-600",
  },
  {
    mode:    "roster",
    label:   "Class Roster",
    desc:    "Clean list with adm no, name, roll, guardian phone",
    icon:    FileText,
    accent:  "text-violet-600",
  },
  {
    mode:    "current",
    label:   "Current View",
    desc:    "Whatever columns you have visible now",
    icon:    ListChecks,
    accent:  "text-amber-600",
  },
] as const

export function StudentsTableActions({ visibleColumns, onColumnToggle, onResetColumns }: Props) {
  const searchParams = useSearchParams()

  // Forward all current filters to print page so the printed list matches what's on screen
  const printQuery = (mode: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("mode", mode)
    if (mode === "current") {
      params.set("cols", [...visibleColumns].join(","))
    }
    return `/students/print?${params.toString()}`
  }

  // Don't show "actions" / "indicators" columns in toggle since they're computed not data
  const toggleableColumns = COLUMNS.filter(c => c.key !== "index" && c.key !== "actions")
  const visibleCount = COLUMNS.filter(c => visibleColumns.has(c.key)).length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Columns visibility menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 cursor-pointer text-xs bg-white/80">
            <Settings2 className="w-3.5 h-3.5" />
            Columns
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">({visibleCount})</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
          <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-slate-400">
            Show columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toggleableColumns.map(c => (
            <DropdownMenuCheckboxItem key={c.key}
              checked={visibleColumns.has(c.key)}
              onCheckedChange={(checked) => onColumnToggle(c.key, !!checked)}
              className="text-xs cursor-pointer">
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onResetColumns} className="text-xs cursor-pointer gap-1.5">
            <EyeOff className="w-3.5 h-3.5 text-slate-400" /> Reset to defaults
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Print menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 cursor-pointer text-xs bg-white/80">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
          <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-slate-400">
            Print preset
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRINT_PRESETS.map(p => (
            <DropdownMenuItem key={p.mode} asChild className="cursor-pointer">
              <Link href={printQuery(p.mode)} target="_blank" className="flex items-start gap-2.5 py-2">
                <p.icon className={`w-4 h-4 mt-0.5 ${p.accent}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{p.label}</p>
                  <p className="text-[10px] text-slate-500 leading-snug">{p.desc}</p>
                </div>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
