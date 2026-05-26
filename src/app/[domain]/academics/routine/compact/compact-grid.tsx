"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FolderTree, Building2, CalendarClock, Printer, ArrowDownAZ, ArrowUpAZ } from "lucide-react"
import { cn } from "@/lib/utils"
import { subjectShort, teacherInitials } from "@/lib/routine-format"
import { dayDisplayNumber } from "@/lib/working-days"
import type {
  CompactClassColumn, CompactCellEntry,
} from "@/actions/routine"
import { QuickAssignPopover, type QuickAssignTarget } from "./quick-assign-popover"

interface Props {
  columns: CompactClassColumn[]
}

interface PeriodAxisItem {
  orderIndex: number
  label:      string | null
  isBreak:    boolean
  startTime:  string | null
  endTime:    string | null
}

// ─── Top-level: split by schedule first, then render one grid per schedule ──

export function CompactGrid({ columns }: Props) {
  const [quickTarget, setQuickTarget] = useState<QuickAssignTarget | null>(null)
  /** Server returns classes in ascending progression. User can flip to desc here. */
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const orderedColumns = useMemo(
    () => sortDir === "asc" ? columns : [...columns].reverse(),
    [columns, sortDir],
  )
  const scheduleGroups = useMemo(() => {
    const map = new Map<string, {
      scheduleId:   string | null
      scheduleName: string | null
      classes:      CompactClassColumn[]
    }>()
    for (const c of orderedColumns) {
      const key = c.periodScheduleId ?? "_NONE_"
      if (!map.has(key)) {
        map.set(key, {
          scheduleId:   c.periodScheduleId,
          scheduleName: c.periodScheduleName,
          classes:      [],
        })
      }
      map.get(key)!.classes.push(c)
    }
    // Sort: real schedules first by name; "no schedule" bucket last
    return [...map.values()].sort((a, b) => {
      if (!a.scheduleId && b.scheduleId) return  1
      if (a.scheduleId && !b.scheduleId) return -1
      return (a.scheduleName ?? "").localeCompare(b.scheduleName ?? "")
    })
  }, [orderedColumns])

  if (columns.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-12 text-center">
        <p className="font-semibold text-sm mb-1">No routine to show</p>
        <p className="text-xs text-muted-foreground">
          Pick a faculty or class, or attach a period schedule to a class first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {scheduleGroups.map(g => (
        <ScheduleSection
          key={g.scheduleId ?? "_none"}
          scheduleId={g.scheduleId}
          scheduleName={g.scheduleName}
          classes={g.classes}
          showHeading={scheduleGroups.length > 1}
          onQuickAssign={setQuickTarget}
          sortDir={sortDir}
          onToggleSort={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
        />
      ))}
      {quickTarget && (
        <QuickAssignPopover target={quickTarget} onClose={() => setQuickTarget(null)} />
      )}
    </div>
  )
}

// ─── One grid per Period Schedule ──────────────────────────────────────────

function ScheduleSection({
  scheduleId, scheduleName, classes, showHeading, onQuickAssign, sortDir, onToggleSort,
}: {
  scheduleId:   string | null
  scheduleName: string | null
  classes:      CompactClassColumn[]
  showHeading:  boolean
  onQuickAssign: (target: QuickAssignTarget) => void
  sortDir:       "asc" | "desc"
  onToggleSort:  () => void
}) {
  const searchParams = useSearchParams()

  function openPrint() {
    if (!scheduleId) return
    const next = new URLSearchParams()
    next.set("scheduleId", scheduleId)
    const ay  = searchParams.get("academicYearId")
    const fac = searchParams.get("facultyId")
    const cls = searchParams.get("classId")
    if (ay)  next.set("academicYearId", ay)
    if (fac) next.set("facultyId",      fac)
    if (cls) next.set("classId",        cls)
    if (scheduleName) next.set("title", `Class Routine`)
    window.open(`/academics/routine/print?${next.toString()}`, "_blank", "noopener,noreferrer")
  }
  // Period axis is local to this schedule — times only line up within a schedule.
  const periodAxis = useMemo<PeriodAxisItem[]>(() => {
    const byOrder = new Map<number, PeriodAxisItem>()
    for (const c of classes) {
      for (const r of c.rows) {
        const prev = byOrder.get(r.orderIndex)
        if (!prev) {
          byOrder.set(r.orderIndex, {
            orderIndex: r.orderIndex,
            label:      r.label,
            isBreak:    r.isBreak,
            startTime:  r.startTime,
            endTime:    r.endTime,
          })
        }
        // Within a single schedule all classes share identical slots, so we
        // don't need to merge fields across classes here.
      }
    }
    return [...byOrder.values()].sort((a, b) => a.orderIndex - b.orderIndex)
  }, [classes])

  // Group classes inside this schedule by faculty for inline section bands
  const facultyGroups = useMemo(() => {
    const map = new Map<string, { facultyId: string | null; facultyName: string | null; classes: CompactClassColumn[] }>()
    for (const c of classes) {
      const key = c.facultyId ?? "_NONE_"
      if (!map.has(key)) {
        map.set(key, { facultyId: c.facultyId, facultyName: c.facultyName, classes: [] })
      }
      map.get(key)!.classes.push(c)
    }
    return [...map.values()]
  }, [classes])

  const totalCols = 1 + periodAxis.length

  return (
    <section className="space-y-2">
      {showHeading && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800">
              {scheduleName ?? <span className="italic text-slate-400">No period schedule</span>}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {classes.length} class{classes.length === 1 ? "" : "es"}
              {periodAxis.length > 0 && <> · {periodAxis.length} slot{periodAxis.length === 1 ? "" : "s"}</>}
            </p>
          </div>
          {scheduleId && periodAxis.length > 0 && (
            <button
              onClick={openPrint}
              title={`Print ${scheduleName ?? "schedule"}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-primary border border-slate-200 hover:border-primary/30 bg-white/80 hover:bg-primary/5 rounded-lg px-2.5 h-7 cursor-pointer transition-colors"
            >
              <Printer className="w-3 h-3" /> Print
            </button>
          )}
        </div>
      )}
      {!showHeading && scheduleId && periodAxis.length > 0 && (
        <div className="flex justify-end px-1">
          <button
            onClick={openPrint}
            title={`Print ${scheduleName ?? "schedule"}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-primary border border-slate-200 hover:border-primary/30 bg-white/80 hover:bg-primary/5 rounded-lg px-2.5 h-7 cursor-pointer transition-colors"
          >
            <Printer className="w-3 h-3" /> Print
          </button>
        </div>
      )}

      {periodAxis.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-dashed border-slate-200 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            {classes.length} class{classes.length === 1 ? "" : "es"} with no period schedule attached.
            <br />
            Attach one in Routine &gt; Schedules to render their grid.
          </p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs w-full table-fixed">
            <colgroup>
              <col className="w-[110px]" />
              {periodAxis.map(p => <col key={p.orderIndex} />)}
            </colgroup>
            <thead className="sticky top-0 z-30">
              <tr className="bg-slate-50/95 backdrop-blur-xl">
                <th className="sticky left-0 z-40 bg-slate-50/95 border-b border-r border-slate-200 px-2 py-3 text-left">
                  <button
                    type="button"
                    onClick={onToggleSort}
                    title={sortDir === "asc"
                      ? "Sorted by class progression (ECD → 1 → 12). Click to reverse."
                      : "Sorted by reverse progression (12 → 1 → ECD). Click to reset."}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary cursor-pointer rounded px-1 py-0.5 hover:bg-primary/8 transition-colors"
                  >
                    Class
                    {sortDir === "asc"
                      ? <ArrowDownAZ className="w-3 h-3" aria-label="Ascending" />
                      : <ArrowUpAZ className="w-3 h-3" aria-label="Descending" />}
                  </button>
                </th>
                {periodAxis.map(p => (
                  <th key={p.orderIndex}
                    className={cn(
                      "px-1.5 py-2 border-b border-l border-slate-200 align-top",
                      p.isBreak ? "bg-amber-50/60" : "",
                    )}>
                    <div className={cn(
                      "text-[11px] font-bold leading-tight truncate",
                      p.isBreak ? "text-amber-700" : "text-slate-700",
                    )} title={p.label ?? `P${p.orderIndex + 1}`}>
                      {p.label ?? `P${p.orderIndex + 1}`}
                    </div>
                    {(p.startTime || p.endTime) && (
                      <div className="mt-0.5 text-[9px] font-mono text-slate-400 tabular-nums truncate">
                        {p.startTime ?? "—"}–{p.endTime ?? "—"}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {facultyGroups.map(g => (
                <FacultyGroup
                  key={`${scheduleId ?? "_"}-${g.facultyId ?? "_"}`}
                  facultyName={g.facultyName}
                  classes={g.classes}
                  periodAxis={periodAxis}
                  totalCols={totalCols}
                  onQuickAssign={onQuickAssign}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Faculty band + class rows ──────────────────────────────────────────────

function FacultyGroup({
  facultyName, classes, periodAxis, totalCols, onQuickAssign,
}: {
  facultyName: string | null
  classes:     CompactClassColumn[]
  periodAxis:  PeriodAxisItem[]
  totalCols:   number
  onQuickAssign: (target: QuickAssignTarget) => void
}) {
  return (
    <>
      <tr>
        <td
          colSpan={totalCols}
          className="sticky left-0 z-20 bg-gradient-to-r from-violet-50/80 to-violet-50/10 border-b border-t border-violet-100 px-3 py-1.5"
        >
          <div className="flex items-center gap-1.5">
            {facultyName
              ? <FolderTree className="w-3 h-3 text-violet-600" />
              : <Building2  className="w-3 h-3 text-slate-500" />}
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
              {facultyName ?? "General"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              · {classes.length} class{classes.length === 1 ? "" : "es"}
            </span>
          </div>
        </td>
      </tr>
      {classes.map((c, rowIdx) => (
        <tr key={c.classId} className={rowIdx % 2 === 0 ? "bg-white/30" : "bg-slate-50/20"}>
          <th className="sticky left-0 z-10 bg-white/95 backdrop-blur-xl border-b border-r border-slate-100 px-2 py-2 align-middle text-left">
            <div className="flex flex-col gap-0.5">
              <code className="text-[12px] font-mono font-black text-emerald-700 leading-tight">
                {c.classShortName}
              </code>
              <span className="text-[10px] text-slate-400 truncate" title={c.className}>
                {c.className}
              </span>
            </div>
          </th>
          {periodAxis.map(p => {
            const row = c.rows.find(r => r.orderIndex === p.orderIndex)
            const isBreak = !!(row?.isBreak || p.isBreak)
            return (
              <td key={p.orderIndex}
                onDoubleClick={isBreak ? undefined : () => onQuickAssign({
                  classId:      c.classId,
                  className:    c.className,
                  classShort:   c.classShortName,
                  periodSlotId: row?.slotId ?? p.orderIndex.toString(),
                  periodLabel:  `${p.label ?? `P${p.orderIndex + 1}`}${p.startTime ? ` (${p.startTime}${p.endTime ? "–" + p.endTime : ""})` : ""}`,
                })}
                title={isBreak ? undefined : "Double-click to quick-assign a subject"}
                className={cn(
                  "border-b border-l border-slate-100 align-top px-1 py-1",
                  p.isBreak && "bg-amber-50/30",
                  !isBreak && "cursor-pointer hover:bg-primary/5 transition-colors select-none",
                )}>
                {row?.isBreak || p.isBreak ? (
                  <span className="text-[10px] text-amber-600/70 italic">—</span>
                ) : row && row.cells.length > 0 ? (
                  <div className="space-y-1">
                    {row.cells.map((cell, i) => (
                      <CompactCellRow
                        key={`${cell.subjectId ?? "_"}-${cell.teacherUserId ?? "_"}-${i}`}
                        cell={cell}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300 italic">—</span>
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

// ─── Single (teacher–subject–group) entry inside a (class × period) cell ─

function CompactCellRow({ cell }: { cell: CompactCellEntry }) {
  const dayNums   = cell.days.map(dayDisplayNumber).join(",")
  const initials  = cell.teacherName ? teacherInitials(cell.teacherName) : "?"
  const subj      = cell.subjectName
    ? subjectShort({ name: cell.subjectName, shortName: cell.subjectShortName })
    : "—"
  return (
    <div
      className="text-[10px] leading-tight whitespace-normal break-words"
      title={[
        cell.teacherName,
        cell.subjectName,
        cell.studentGroupName ? `Group: ${cell.studentGroupName}` : null,
      ].filter(Boolean).join(" · ")}
    >
      <span className="font-mono font-black tabular-nums text-slate-700">{initials}</span>
      <span className="text-slate-400 mx-0.5">-</span>
      <span className="font-semibold text-emerald-700">{subj}</span>
      {cell.studentGroupName && (
        <span className="ml-0.5 text-[9px] font-bold text-violet-600 align-top">★</span>
      )}
      <span className="ml-0.5 text-[9px] font-mono text-slate-400 tabular-nums">({dayNums})</span>
    </div>
  )
}
