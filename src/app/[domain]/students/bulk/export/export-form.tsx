"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Download, GraduationCap, Users, ShieldCheck, Loader2, Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { exportStudentRows } from "@/actions/students-bulk"

type ClassOpt = { id: string; name: string; facultyName?: string | null; sections: { id: string; name: string }[] }

interface Props {
  schoolId:   string
  classes:    ClassOpt[]
  totalCount: number
}

const STATUSES = [
  { id: "ACTIVE",    label: "Active"    },
  { id: "LEFT",      label: "Left"      },
  { id: "GRADUATED", label: "Graduated" },
  { id: "SUSPENDED", label: "Suspended" },
]

export function ExportForm({ schoolId, classes, totalCount }: Props) {
  const [, startT] = useTransition()
  const [busy, setBusy] = useState(false)

  const [classIds,   setClassIds]   = useState<string[]>([])
  const [sectionIds, setSectionIds] = useState<string[]>([])
  const [statuses,   setStatuses]   = useState<string[]>(["ACTIVE"])

  function toggle<T extends string>(current: T[], v: T, set: (next: T[]) => void) {
    set(current.includes(v) ? current.filter(x => x !== v) : [...current, v])
  }

  const availSections = useMemo(() => {
    if (classIds.length === 0) return [] as { id: string; name: string; className: string }[]
    return classes
      .filter(c => classIds.includes(c.id))
      .flatMap(c => c.sections.map(s => ({ id: s.id, name: s.name, className: c.name })))
  }, [classIds, classes])

  async function download() {
    setBusy(true)
    startT(async () => {
      try {
        const rows = await exportStudentRows(schoolId, {
          classIds,
          sectionIds,
          statuses,
        })
        if (rows.length === 0) {
          toast.error("No students match these filters.")
          return
        }
        const XLSX = await import("xlsx")
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Students")
        const stamp = new Date().toISOString().slice(0, 10)
        XLSX.writeFile(wb, `students-${stamp}.xlsx`)
        toast.success(`Exported ${rows.length} student${rows.length === 1 ? "" : "s"}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed")
      } finally {
        setBusy(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 space-y-4">
        {/* Status */}
        <FilterGroup icon={ShieldCheck} label="Status">
          {STATUSES.map(s => (
            <Chip key={s.id} active={statuses.includes(s.id)}
              onClick={() => toggle(statuses, s.id, setStatuses)}>
              {s.label}
            </Chip>
          ))}
        </FilterGroup>

        {/* Class */}
        <FilterGroup icon={GraduationCap} label="Class" subtitle="Leave empty for all classes">
          {classes.map(c => (
            <Chip key={c.id} active={classIds.includes(c.id)}
              onClick={() => {
                toggle(classIds, c.id, setClassIds)
                // Drop sections that no longer apply when class deselected
                if (classIds.includes(c.id)) {
                  setSectionIds(prev => prev.filter(id => !c.sections.some(s => s.id === id)))
                }
              }}>
              {c.name}
              {c.facultyName && <span className="ml-1.5 text-[9px] opacity-70">{c.facultyName}</span>}
            </Chip>
          ))}
        </FilterGroup>

        {/* Section */}
        {availSections.length > 0 && (
          <FilterGroup icon={Users} label="Section" subtitle="Optional — leave empty for all">
            {availSections.map(s => (
              <Chip key={s.id} active={sectionIds.includes(s.id)}
                onClick={() => toggle(sectionIds, s.id, setSectionIds)}>
                {s.className} · {s.name}
              </Chip>
            ))}
          </FilterGroup>
        )}
      </div>

      <div className="bg-amber-50/40 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          The exported file is round-trippable through the importer. Keep the <strong>Admission #</strong> column intact
          when re-importing — that&apos;s how rows get matched back to students.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          School total: <strong className="text-slate-700">{totalCount}</strong>
        </span>
        <div className="flex-1" />
        <Button onClick={download} disabled={busy}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download .xlsx
        </Button>
      </div>
    </div>
  )
}

function FilterGroup({
  icon: Icon, label, subtitle, children,
}: {
  icon: React.ElementType
  label: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
        {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}

function Chip({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer",
        active
          ? "bg-primary/10 text-primary border-primary/30 font-bold shadow-sm"
          : "bg-white border-slate-200 text-slate-600 hover:border-primary/30",
      )}>
      {children}
    </button>
  )
}
