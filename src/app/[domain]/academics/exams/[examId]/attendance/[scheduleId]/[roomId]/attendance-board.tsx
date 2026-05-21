"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Check, X, Clock, Ban, Save, Loader2, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  setAttendance, bulkMarkAll,
  type AttendanceRow, type AttendanceStatus,
} from "@/actions/exam-attendance"

interface Props {
  schoolId:    string
  markedById:  string
  scheduleId:  string
  roomId:      string
  initialRows: AttendanceRow[]
}

const CYCLE: Record<AttendanceStatus, AttendanceStatus> = {
  PRESENT:  "ABSENT",
  ABSENT:   "LATE",
  LATE:     "DEBARRED",
  DEBARRED: "PRESENT",
}

const STATUS_META: Record<AttendanceStatus, { label: string; classes: string; icon: typeof Check }> = {
  PRESENT:  { label: "Present",  classes: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100", icon: Check },
  ABSENT:   { label: "Absent",   classes: "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100",             icon: X },
  LATE:     { label: "Late",     classes: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",         icon: Clock },
  DEBARRED: { label: "Debarred", classes: "bg-slate-200 text-slate-700 border-slate-400 hover:bg-slate-300",         icon: Ban },
}

export function AttendanceBoard({
  schoolId, markedById, scheduleId, roomId, initialRows,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [rows, setRows] = useState<AttendanceRow[]>(initialRows)
  useEffect(() => { setRows(initialRows) }, [initialRows])

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const baselineRef = useRef<Map<string, AttendanceStatus>>(
    new Map(initialRows.map(r => [r.studentId, r.status])),
  )

  useEffect(() => {
    const a = baselineRef.current
    let any = false
    for (const r of rows) {
      if (a.get(r.studentId) !== r.status) { any = true; break }
    }
    setDirty(any)
  }, [rows])

  // ─── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const tally = { PRESENT: 0, ABSENT: 0, LATE: 0, DEBARRED: 0 } as Record<AttendanceStatus, number>
    for (const r of rows) tally[r.status]++
    return tally
  }, [rows])

  // ─── Cycle one student ──────────────────────────────────────────────
  function cycle(studentId: string) {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, status: CYCLE[r.status] } : r))
  }

  // ─── Bulk-mark all ──────────────────────────────────────────────────
  function bulkAll(status: AttendanceStatus) {
    if (!confirm(`Mark ALL ${rows.length} students as ${STATUS_META[status].label}?`)) return
    setSaving(true)
    startT(async () => {
      try {
        await bulkMarkAll({ scheduleId, roomId, schoolId, markedById, status })
        // Refresh from server to reflect persisted state
        baselineRef.current = new Map(rows.map(r => [r.studentId, status]))
        setRows(prev => prev.map(r => ({ ...r, status })))
        setDirty(false)
        toast.success(`Marked ${rows.length} as ${STATUS_META[status].label.toLowerCase()}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      } finally {
        setSaving(false)
      }
    })
  }

  // ─── Save dirty changes ─────────────────────────────────────────────
  function saveAll() {
    if (!dirty) return
    const changes = rows.filter(r => baselineRef.current.get(r.studentId) !== r.status)
    setSaving(true)
    startT(async () => {
      try {
        await setAttendance({
          scheduleId, roomId, schoolId, markedById,
          marks: changes.map(c => ({ studentId: c.studentId, status: c.status, note: c.note })),
        })
        baselineRef.current = new Map(rows.map(r => [r.studentId, r.status]))
        setDirty(false)
        toast.success(`Saved ${changes.length} change${changes.length === 1 ? "" : "s"}`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-7 h-7 text-amber-600 mx-auto mb-2" />
        <p className="text-sm font-bold text-amber-900">No students seated in this room.</p>
        <p className="text-xs text-amber-700 mt-1">Run the seat plan first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats + bulk */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <CountChip status="PRESENT"  n={stats.PRESENT}  />
        <CountChip status="ABSENT"   n={stats.ABSENT}   />
        <CountChip status="LATE"     n={stats.LATE}     />
        <CountChip status="DEBARRED" n={stats.DEBARRED} />
        <span className="text-[10px] text-slate-400 font-medium ml-2">
          of {rows.length} seated
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => bulkAll("PRESENT")} disabled={saving}
          className="gap-1.5 cursor-pointer text-xs h-8 bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Check className="w-3.5 h-3.5" /> All present
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkAll("ABSENT")} disabled={saving}
          className="gap-1.5 cursor-pointer text-xs h-8 bg-white text-rose-700 border-rose-200 hover:bg-rose-50">
          <X className="w-3.5 h-3.5" /> All absent
        </Button>
      </div>

      {/* Roster grid — click student card to cycle status */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/60 border-b border-slate-100">
          <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Seat</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Adm No · Roll</div>
          <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Class</div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Status</div>
        </div>
        <div className="divide-y divide-slate-100/60">
          {rows
            .slice()
            .sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)
            .map(r => (
              <button
                key={r.studentId}
                onClick={() => cycle(r.studentId)}
                className="w-full text-left grid grid-cols-12 gap-3 px-5 py-2.5 items-center hover:bg-slate-50/40 transition-colors cursor-pointer"
              >
                <div className="col-span-1 text-[10px] font-mono tabular-nums text-slate-500">
                  R{r.row}·C{r.col}
                </div>
                <div className="col-span-3 text-[11px] font-mono tabular-nums text-slate-600">
                  <div>{r.admissionNo}</div>
                  <div className="text-[10px] text-slate-400">{r.rollNumber ?? "—"}</div>
                </div>
                <div className="col-span-4 text-sm font-semibold text-slate-800 truncate">{r.studentName}</div>
                <div className="col-span-2 text-xs text-slate-500 truncate">{r.className}</div>
                <div className="col-span-2 flex items-center justify-end">
                  <StatusBadge status={r.status} />
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 z-30">
          <div className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unsaved changes
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={saveAll} disabled={saving}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save attendance
          </Button>
        </div>
      )}
    </div>
  )
}

function CountChip({ status, n }: { status: AttendanceStatus; n: number }) {
  const m = STATUS_META[status]
  const Icon = m.icon
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold tabular-nums",
      m.classes,
    )}>
      <Icon className="w-3 h-3" />
      {n} {m.label}
    </span>
  )
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const m = STATUS_META[status]
  const Icon = m.icon
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-bold cursor-pointer transition-all",
      m.classes,
    )}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  )
}
