"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  ChevronLeft, ChevronRight, Clock, FileText, Plus,
  Calendar as CalendarIcon, Trash2, Edit, Layers, Printer,
  X, Save, BookOpen, GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { toAD, toBS, formatBS } from "@/lib/nepali-date"
import {
  setPaperSchedule, clearPaperSchedule, deleteExamPaper, placePaperOnCell,
  type PaperRow, type ExamHolidayRow,
} from "@/actions/exams"
import { createSubject } from "@/actions/academics"
import { PaperDrawer, type PaperClassOpt } from "./paper-drawer"
import { ExamQuickAssignPopover, type ExamQuickAssignTarget } from "./quick-assign-popover"

interface Props {
  schoolId:        string
  examId:          string
  initialPapers:   PaperRow[]
  initialHolidays: ExamHolidayRow[]
  classes:         PaperClassOpt[]
}

const SPAN_MIN_DAYS = 7
const DRAG_FROM_RAIL  = "rail:"   // prefix for rail subject draggable ids
const DRAG_FROM_BLOCK = "block:"  // prefix for placed-block draggable ids

export function RoutineMatrix({ schoolId, examId, initialPapers, initialHolidays, classes }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [papers, setPapers] = useState<PaperRow[]>(initialPapers)
  useEffect(() => { setPapers(initialPapers) }, [initialPapers])

  const holidayByDate = useMemo(() => {
    const m = new Map<string, ExamHolidayRow>()
    for (const h of initialHolidays) m.set(h.dateBS, h)
    return m
  }, [initialHolidays])

  // ─── Day axis & toolbar state ────────────────────────────────────────
  const [startBS, setStartBS] = useState<string>(() => {
    const earliest = initialPapers.map(p => p.schedule?.dateBS).filter(Boolean) as string[]
    if (earliest.length === 0) return toBS(new Date())
    const min = earliest.sort()[0]
    const ad = toAD(min)
    ad.setDate(ad.getDate() - 1)
    return toBS(ad)
  })
  const [defaultStart, setDefaultStart] = useState("10:00")
  const [defaultDuration, setDefaultDuration] = useState(90)

  // Axis length = max(subjects-per-class, papers-per-class) + holidays.length,
  // with a floor for visual breathing room. This way the routine grows naturally
  // as classes accumulate subjects / papers without manual "Next week" clicks.
  const spanDays = useMemo(() => {
    const maxSubjects = classes.reduce((m, c) => Math.max(m, c.subjects.length), 0)
    const papersPerClass = new Map<string, number>()
    for (const p of papers) {
      for (const t of p.targets) {
        papersPerClass.set(t.classId, (papersPerClass.get(t.classId) ?? 0) + 1)
      }
    }
    const maxPapers = Array.from(papersPerClass.values()).reduce((m, n) => Math.max(m, n), 0)
    const needed = Math.max(maxSubjects, maxPapers) + initialHolidays.length
    return Math.max(SPAN_MIN_DAYS, needed)
  }, [classes, papers, initialHolidays])

  const days = useMemo(() => buildDayAxis(startBS, spanDays), [startBS, spanDays])
  const daySet = useMemo(() => new Set(days.map(d => d.bs)), [days])

  // ─── Selected class for subject rail ─────────────────────────────────
  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id ?? "")
  const selectedClass = useMemo(
    () => classes.find(c => c.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  )

  // ─── Build lookup: (classId, dateBS) → placed papers ─────────────────
  const placedByCell = useMemo(() => {
    const m = new Map<string, PaperRow[]>()
    for (const p of papers) {
      if (!p.schedule) continue
      if (!daySet.has(p.schedule.dateBS)) continue
      for (const t of p.targets) {
        const key = `${t.classId}:${p.schedule.dateBS}`
        if (!m.has(key)) m.set(key, [])
        m.get(key)!.push(p)
      }
    }
    return m
  }, [papers, daySet])

  // ─── DnD ─────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeId, setActiveId] = useState<string | null>(null)

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)) }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const activeStr = String(e.active.id)
    const overId    = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    // overId is "cell:CLASS_ID:DATE_BS"
    if (!overId.startsWith("cell:")) return
    const [, classId, dateBS] = overId.split(":")
    if (!classId || !dateBS) return

    // From rail
    if (activeStr.startsWith(DRAG_FROM_RAIL)) {
      const subjectId = activeStr.slice(DRAG_FROM_RAIL.length)
      const cls = selectedClass
      const subj = cls?.subjects.find(s => s.id === subjectId)
      if (!cls || !subj) return
      if (cls.id !== classId) {
        // Allow dropping the selected-class subject only into THAT class's column
        toast.error(`Drop this subject in the ${cls.name} column`)
        return
      }
      placeFromRail(classId, subj.id, subj.name, subj.code, dateBS)
      return
    }

    // From an existing placed block (paper id with prefix)
    if (activeStr.startsWith(DRAG_FROM_BLOCK)) {
      const paperId = activeStr.slice(DRAG_FROM_BLOCK.length)
      const paper = papers.find(p => p.id === paperId)
      if (!paper) return
      // Reschedule (server keeps existing targets; date moves)
      moveBlock(paper, dateBS)
      return
    }
  }

  function placeFromRail(classId: string, subjectId: string, subjectName: string, subjectCode: string | null, dateBS: string) {
    startT(async () => {
      try {
        await placePaperOnCell({
          schoolId, examId, classId, subjectId,
          subjectName, subjectCode,
          dateBS, dateAD: toAD(dateBS),
          startTime: defaultStart,
          defaultDurationMin: defaultDuration,
        })
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      }
    })
  }

  function moveBlock(paper: PaperRow, dateBS: string) {
    if (paper.schedule?.dateBS === dateBS) return
    const startTime = paper.schedule?.startTime ?? defaultStart
    setPapers(prev => prev.map(p => p.id === paper.id
      ? { ...p, schedule: { id: p.schedule?.id ?? "tmp", dateBS, dateAD: toAD(dateBS), startTime, durationMin: p.schedule?.durationMin ?? null } }
      : p))
    startT(async () => {
      try {
        await setPaperSchedule({
          paperId:     paper.id,
          schoolId,
          dateBS,
          dateAD:      toAD(dateBS),
          startTime,
          durationMin: paper.schedule?.durationMin,
        })
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Move failed")
        router.refresh()
      }
    })
  }

  function clearSchedule(paper: PaperRow) {
    setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, schedule: null } : p))
    startT(async () => {
      try {
        await clearPaperSchedule(paper.id, schoolId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Clear failed")
        router.refresh()
      }
    })
  }

  function patchSchedule(paper: PaperRow, patch: { startTime?: string; durationMin?: number | null }) {
    if (!paper.schedule) return
    const next = { ...paper.schedule, ...patch }
    setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, schedule: next } : p))
    startT(async () => {
      try {
        await setPaperSchedule({
          paperId:     paper.id,
          schoolId,
          dateBS:      next.dateBS,
          dateAD:      toAD(next.dateBS),
          startTime:   next.startTime,
          durationMin: next.durationMin,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
        router.refresh()
      }
    })
  }

  // ─── Add Paper drawer (manual entry) ────────────────────────────────
  const [editingPaper, setEditingPaper]   = useState<PaperRow | null>(null)

  async function handleDelete(paper: PaperRow) {
    if (!confirm(`Delete paper "${paper.subjectName}"?`)) return
    try {
      await deleteExamPaper(paper.id, schoolId)
      toast.success(`Paper "${paper.subjectName}" deleted`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }

  // ─── Double-click edit popover ──────────────────────────────────────
  const [editingTimePaper, setEditingTimePaper] = useState<PaperRow | null>(null)

  // ─── Cell-level quick-assign popover (double-click empty cell) ───────
  const [quickTarget, setQuickTarget] = useState<ExamQuickAssignTarget | null>(null)

  // ─── Add-subject quick popover ───────────────────────────────────────
  const [adding, setAdding] = useState(false)

  // ─── Print ───────────────────────────────────────────────────────────
  function openPrint(mode: "combined" | "faculty" | "class") {
    window.open(`/academics/exams/${examId}/routine/print?mode=${mode}`, "_blank", "noopener,noreferrer")
  }

  // ─── Day navigation ─────────────────────────────────────────────────
  function shift(deltaDays: number) {
    const ad = toAD(startBS)
    ad.setDate(ad.getDate() + deltaDays)
    setStartBS(toBS(ad))
  }
  function jumpToday() { setStartBS(toBS(new Date())) }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Toolbar (NOT sticky — scrolls away with the page) */}
      <div className="bg-white/80 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={jumpToday}
          className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
          <CalendarIcon className="w-3.5 h-3.5" /> Today
        </Button>

        <Button size="icon" variant="outline" onClick={() => shift(-7)}
          className="h-8 w-8 cursor-pointer bg-white" title="Previous week">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start</span>
          <div className="w-[240px]">
            <NepaliDateInput value={startBS} onChange={setStartBS} />
          </div>
        </div>
        <Button size="icon" variant="outline" onClick={() => shift(7)}
          className="h-8 w-8 cursor-pointer bg-white" title="Next week">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Default</span>
          <Input
            type="time"
            value={defaultStart}
            onChange={e => setDefaultStart(e.target.value)}
            className="h-6 w-[70px] px-1.5 text-[11px] font-mono tabular-nums bg-white border-slate-200"
            title="Default start time for new papers (double-click any block to override)"
          />
          <Input
            type="number"
            min={5}
            max={600}
            step={15}
            value={defaultDuration}
            onChange={e => setDefaultDuration(parseInt(e.target.value, 10) || 90)}
            className="h-6 w-[52px] px-1.5 text-[11px] font-mono tabular-nums bg-white border-slate-200"
            title="Default duration in minutes"
          />
          <span className="text-[10px] text-slate-400">min</span>
        </div>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"
              className="gap-1.5 cursor-pointer text-xs h-8 bg-white border-slate-200 hover:border-primary/30 hover:bg-primary/5"
              disabled={papers.length === 0}
              title={papers.length === 0 ? "Add a paper first" : "Print"}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Print routine</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openPrint("combined")} className="cursor-pointer gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex flex-col">
                <span className="font-bold">Combined</span>
                <span className="text-[10px] text-slate-400">All papers in one table</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPrint("faculty")} className="cursor-pointer gap-2 text-xs">
              <GraduationCap className="w-3.5 h-3.5 text-violet-600" />
              <div className="flex flex-col">
                <span className="font-bold">Per faculty</span>
                <span className="text-[10px] text-slate-400">One section per faculty</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPrint("class")} className="cursor-pointer gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <div className="flex flex-col">
                <span className="font-bold">Per class</span>
                <span className="text-[10px] text-slate-400">With signature column</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Subject rail — sticky at top of scroll */}
      <div className="mt-2 sticky top-0 z-30 bg-white/85 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <BookOpen className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Subjects · <span className="text-primary">{selectedClass?.name ?? "—"}</span>
          </span>
        </div>
        {!selectedClass ? (
          <p className="text-[11px] text-slate-400 italic">Click a class row to load its subjects here.</p>
        ) : (
          <div className="flex items-stretch gap-1.5 overflow-x-auto flex-1 min-w-0">
            {selectedClass.subjects.map(s => (
              <RailSubject key={s.id} subject={s} className={selectedClass.name} />
            ))}
            <AddSubjectButton
              onClick={() => setAdding(true)}
              className={selectedClass.name}
            />
          </div>
        )}
      </div>

      {/* Grid: rows = classes, columns = days.
          overflow-auto (both axes) on this container makes it its own scroll
          context. Sticky elements inside (date header, class column) then pin
          relative to this scroll port — which is the only way to keep the date
          row visible while scrolling vertically through classes inside a
          horizontally-scrollable grid. */}
      <div
        className="mt-3 bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-auto"
        style={{ maxHeight: "calc(100svh - 14rem)" }}
      >
        <div style={{ minWidth: `${150 + days.length * 105}px` }}>
          {/* Header row — date columns. Sticky to the top of THIS scroll port. */}
          <div
            className="grid border-b border-slate-200 sticky top-0 z-20 bg-white/95 backdrop-blur-xl"
            style={{
              gridTemplateColumns: `150px repeat(${days.length}, minmax(105px, 1fr))`,
            }}
          >
            <div className="px-2 py-1.5 bg-slate-50/70 sticky left-0 z-30 border-r border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Class</span>
            </div>
            {days.map(d => {
              const holiday = holidayByDate.get(d.bs)
              return (
                <div
                  key={d.bs}
                  className={cn(
                    "px-1.5 py-1.5 border-r last:border-r-0 border-slate-100",
                    holiday ? "bg-rose-50/80"
                      : d.isToday ? "bg-amber-50/80"
                      : d.isWeekend ? "bg-slate-50/80"
                      : "bg-slate-50/40",
                  )}
                >
                  <div className={cn(
                    "text-[9px] font-black uppercase tracking-wider",
                    holiday ? "text-rose-700"
                      : d.isToday ? "text-amber-700"
                      : d.isWeekend ? "text-slate-400"
                      : "text-slate-500",
                  )}>{d.weekday}</div>
                  <div className={cn(
                    "text-xs font-bold tabular-nums leading-tight",
                    holiday ? "text-rose-800" : d.isToday ? "text-amber-800" : "text-slate-700",
                  )}>
                    {d.dayNum} {d.monthLabel}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 tabular-nums truncate">{d.bs}</div>
                  {holiday && (
                    <div className="mt-0.5 inline-flex items-center gap-1 px-1 py-0 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200 max-w-full">
                      <span className="truncate">{holiday.reason ?? "Holiday"}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Body rows — one per class */}
          {classes.map(c => (
            <div
              key={c.id}
              className="grid border-b border-slate-100 last:border-b-0"
              style={{ gridTemplateColumns: `150px repeat(${days.length}, minmax(105px, 1fr))` }}
            >
              <button
                onClick={() => setSelectedClassId(c.id)}
                className={cn(
                  "px-2 py-1.5 sticky left-0 z-10 border-r border-slate-200 text-left transition-colors cursor-pointer backdrop-blur-xl",
                  c.id === selectedClassId
                    ? "bg-primary/10 hover:bg-primary/15"
                    : "bg-white/85 hover:bg-slate-50",
                )}
                title="Click to load this class's subjects in the rail above"
              >
                <div className={cn(
                  "text-[11px] font-black truncate",
                  c.id === selectedClassId ? "text-primary" : "text-slate-700",
                )}>
                  {c.name}
                </div>
                <div className="text-[9px] text-slate-400 font-medium truncate">
                  {c.facultyName ?? "General"} · {c.subjects.length} subj.
                </div>
              </button>
              {days.map(d => {
                const holiday = holidayByDate.get(d.bs)
                return (
                  <CellDroppable
                    key={d.bs}
                    classId={c.id}
                    dateBS={d.bs}
                    papers={placedByCell.get(`${c.id}:${d.bs}`) ?? []}
                    isWeekend={d.isWeekend}
                    isToday={d.isToday}
                    isHoliday={!!holiday}
                    isClassSelected={c.id === selectedClassId}
                    onCellClick={() => setSelectedClassId(c.id)}
                    onCellDoubleClick={() => {
                      setSelectedClassId(c.id)
                      setQuickTarget({ classId: c.id, className: c.name, dateBS: d.bs })
                    }}
                    onEdit={setEditingPaper}
                    onDelete={handleDelete}
                    onClear={clearSchedule}
                    onDoubleClick={setEditingTimePaper}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId && (() => {
          if (activeId.startsWith(DRAG_FROM_RAIL)) {
            const subjectId = activeId.slice(DRAG_FROM_RAIL.length)
            const subj = selectedClass?.subjects.find(s => s.id === subjectId)
            if (!subj) return null
            return <SubjectPillStatic subject={subj} ghost />
          }
          if (activeId.startsWith(DRAG_FROM_BLOCK)) {
            const paperId = activeId.slice(DRAG_FROM_BLOCK.length)
            const paper = papers.find(p => p.id === paperId)
            if (!paper) return null
            return <PlacedBlockStatic paper={paper} ghost />
          }
          return null
        })()}
      </DragOverlay>

      {/* Paper drawer (full editor) */}
      {editingPaper && (
        <PaperDrawer
          schoolId={schoolId}
          examId={examId}
          classes={classes}
          editPaper={editingPaper}
          open={true}
          onOpenChange={(o) => {
            if (!o) {
              setEditingPaper(null)
              router.refresh()
            }
          }}
        />
      )}

      {/* Time/duration popover */}
      {editingTimePaper && (
        <TimeEditDialog
          paper={editingTimePaper}
          onClose={() => setEditingTimePaper(null)}
          onSave={(patch) => {
            patchSchedule(editingTimePaper, patch)
            setEditingTimePaper(null)
          }}
        />
      )}

      {/* Add custom subject popover */}
      {adding && selectedClass && (
        <AddSubjectDialog
          schoolId={schoolId}
          classId={selectedClass.id}
          className={selectedClass.name}
          existingCodes={new Set(selectedClass.subjects.map(s => s.code))}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); router.refresh() }}
        />
      )}

      {/* Cell quick-assign popover (double-click a cell to open) */}
      {quickTarget && (
        <ExamQuickAssignPopover
          schoolId={schoolId}
          examId={examId}
          target={quickTarget}
          classes={classes}
          placedPapers={placedByCell.get(`${quickTarget.classId}:${quickTarget.dateBS}`) ?? []}
          defaultStart={defaultStart}
          defaultDuration={defaultDuration}
          onClose={() => setQuickTarget(null)}
        />
      )}
    </DndContext>
  )
}

// ─── Day axis ──────────────────────────────────────────────────────────

interface AxisDay {
  bs:         string
  weekday:    string
  dayNum:     number
  monthLabel: string
  isToday:    boolean
  isWeekend:  boolean
}
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const BS_MONTH_ABBR = ["Bai","Jes","Asa","Shr","Bha","Ash","Kar","Man","Pou","Mag","Fal","Cha"]

function buildDayAxis(startBS: string, span: number): AxisDay[] {
  const out: AxisDay[] = []
  const today = toBS(new Date())
  for (let i = 0; i < span; i++) {
    const ad = toAD(startBS)
    ad.setDate(ad.getDate() + i)
    const bs = toBS(ad)
    const wdIdx = ad.getDay()
    const dayNum = parseInt(bs.split("-")[2], 10)
    const monthNum = parseInt(bs.split("-")[1], 10)
    out.push({
      bs,
      weekday:    WEEKDAY_SHORT[wdIdx],
      dayNum,
      monthLabel: BS_MONTH_ABBR[monthNum - 1] ?? "",
      isToday:    bs === today,
      isWeekend:  wdIdx === 6,
    })
  }
  return out
}

// ─── Cell ──────────────────────────────────────────────────────────────

function CellDroppable({
  classId, dateBS, papers, isWeekend, isToday, isHoliday,
  isClassSelected, onCellClick, onCellDoubleClick,
  onEdit, onDelete, onClear, onDoubleClick,
}: {
  classId:            string
  dateBS:             string
  papers:             PaperRow[]
  isWeekend:          boolean
  isToday:            boolean
  isHoliday?:         boolean
  isClassSelected?:   boolean
  onCellClick?:       () => void
  onCellDoubleClick?: () => void
  onEdit:             (p: PaperRow) => void
  onDelete:           (p: PaperRow) => void
  onClear:            (p: PaperRow) => void
  onDoubleClick:      (p: PaperRow) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${classId}:${dateBS}` })
  const isEmpty = papers.length === 0
  return (
    <div
      ref={setNodeRef}
      onClick={isEmpty ? onCellClick : undefined}
      onDoubleClick={() => onCellDoubleClick?.()}
      className={cn(
        "group relative border-r last:border-r-0 border-slate-100 p-1 min-h-[60px] transition-colors",
        (isEmpty || onCellDoubleClick) && "cursor-pointer",
        isHoliday && "bg-rose-50/40",
        !isHoliday && isWeekend && "bg-slate-50/40",
        !isHoliday && isToday && "bg-amber-50/30",
        isOver && "bg-primary/10",
        isEmpty && !isOver && "hover:bg-primary/5",
      )}
      title={isEmpty ? "Click to load subjects · Double-click to quick-assign a paper" : "Double-click empty area to add another paper"}
    >
      <div className="space-y-1">
        {papers.map(p => (
          <PlacedBlock
            key={p.id}
            paper={p}
            onEdit={onEdit}
            onDelete={onDelete}
            onClear={onClear}
            onDoubleClick={onDoubleClick}
          />
        ))}
      </div>
      {isEmpty && (
        <span className={cn(
          "absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider pointer-events-none transition-opacity",
          isClassSelected
            ? "text-primary/40 opacity-0 group-hover:opacity-100"
            : "text-slate-300 opacity-0 group-hover:opacity-100",
        )}>
          {isClassSelected ? "Drop · or dbl-click" : "Click · or dbl-click"}
        </span>
      )}
    </div>
  )
}

// ─── Placed block (draggable; double-click → edit time) ────────────────

function PlacedBlock({
  paper, onEdit, onDelete, onClear, onDoubleClick,
}: {
  paper:         PaperRow
  onEdit:        (p: PaperRow) => void
  onDelete:      (p: PaperRow) => void
  onClear:       (p: PaperRow) => void
  onDoubleClick: (p: PaperRow) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${DRAG_FROM_BLOCK}${paper.id}` })
  const sched = paper.schedule
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group bg-gradient-to-br from-violet-50 via-white to-white border border-violet-200 rounded-md p-1.5 transition-all",
        "hover:shadow-sm hover:border-violet-300",
        isDragging && "opacity-30",
      )}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(paper) }}
    >
      <div className="flex items-start gap-1">
        <div {...attributes} {...listeners} className="flex-1 min-w-0 cursor-grab active:cursor-grabbing">
          <div className="text-[11px] font-bold text-slate-800 truncate leading-tight">
            {paper.subjectName}
          </div>
          {sched && (
            <div className="text-[10px] font-mono tabular-nums text-violet-700 mt-0.5">
              {sched.startTime} · {sched.durationMin ?? paper.durationMin}min
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onEdit(paper) }}
            title="Edit paper (targets, marks)"
            className="w-4 h-4 rounded hover:bg-violet-100 text-violet-600 flex items-center justify-center cursor-pointer">
            <Edit className="w-2.5 h-2.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClear(paper) }}
            title="Clear from this day (paper kept)"
            className="w-4 h-4 rounded hover:bg-amber-100 text-amber-600 flex items-center justify-center cursor-pointer">
            <X className="w-2.5 h-2.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(paper) }}
            title="Delete paper"
            className="w-4 h-4 rounded hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      {paper.targets.length > 1 && (
        <div className="mt-0.5 text-[9px] text-slate-400 font-bold flex items-center gap-0.5">
          <Layers className="w-2 h-2" /> Combined · {paper.targets.length} classes
        </div>
      )}
    </div>
  )
}

function PlacedBlockStatic({ paper, ghost }: { paper: PaperRow; ghost?: boolean }) {
  const sched = paper.schedule
  return (
    <div className={cn(
      "bg-white border border-violet-300 rounded-md p-2 shadow-lg w-[180px]",
      ghost && "rotate-2",
    )}>
      <div className="text-[11px] font-bold text-slate-800 truncate">{paper.subjectName}</div>
      {sched && (
        <div className="text-[10px] font-mono tabular-nums text-violet-700 mt-0.5">
          {sched.startTime} · {sched.durationMin ?? paper.durationMin}min
        </div>
      )}
    </div>
  )
}

// ─── Rail subject + Add button ─────────────────────────────────────────

interface RailSubjectOpt {
  id:          string
  name:        string
  code:        string
  teacherName: string | null
}

function RailSubject({ subject, className }: { subject: RailSubjectOpt; className: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${DRAG_FROM_RAIL}${subject.id}` })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`Drag onto ${className} column to schedule`}
      className={cn(
        "flex-shrink-0 min-w-[150px] bg-white border border-slate-200 rounded-lg p-2 cursor-grab active:cursor-grabbing transition-all hover:border-primary/30 hover:shadow-sm",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="w-6 h-6 rounded bg-violet-100 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-3 h-3 text-violet-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-800 truncate leading-tight">{subject.name}</div>
          <code className="text-[9px] font-mono text-slate-400 tabular-nums">{subject.code}</code>
        </div>
      </div>
      {subject.teacherName && (
        <div className="mt-1 text-[9px] text-slate-500 truncate">
          {subject.teacherName}
        </div>
      )}
    </div>
  )
}

function SubjectPillStatic({ subject, ghost }: { subject: RailSubjectOpt; ghost?: boolean }) {
  return (
    <div className={cn(
      "bg-white border border-violet-300 rounded-lg p-2 shadow-lg w-[150px]",
      ghost && "rotate-2",
    )}>
      <div className="text-[11px] font-bold text-slate-800 truncate">{subject.name}</div>
      {subject.teacherName && (
        <div className="text-[9px] text-slate-500 truncate mt-0.5">{subject.teacherName}</div>
      )}
    </div>
  )
}

function AddSubjectButton({
  onClick, className,
}: {
  onClick:   () => void
  className: string
}) {
  return (
    <button
      onClick={onClick}
      title={`Add a new subject to ${className} (e.g. Practical)`}
      className="flex-shrink-0 min-w-[120px] flex flex-col items-center justify-center gap-1 bg-white/50 border-2 border-dashed border-slate-300 rounded-lg p-3 cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5"
    >
      <Plus className="w-4 h-4 text-slate-400" />
      <span className="text-[10px] font-bold text-slate-500">Add Subject</span>
      <span className="text-[9px] text-slate-400">e.g. Practical</span>
    </button>
  )
}

// ─── Time edit popover ─────────────────────────────────────────────────

function TimeEditDialog({
  paper, onClose, onSave,
}: {
  paper:  PaperRow
  onClose: () => void
  onSave: (patch: { startTime?: string; durationMin?: number | null }) => void
}) {
  const sched = paper.schedule
  const [startTime, setStartTime] = useState(sched?.startTime ?? "10:00")
  const [durationMin, setDurationMin] = useState(sched?.durationMin ?? paper.durationMin)
  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="bg-white/95 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-sm p-0 flex flex-col">
        <div className="flex items-start gap-4 px-6 pt-7 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">{paper.subjectName}</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Set the start time and duration for this paper.
              {sched && <span className="block mt-0.5 font-mono tabular-nums">{formatBS(sched.dateBS)}</span>}
            </SheetDescription>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start time</label>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-xl font-mono tabular-nums" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duration (minutes)</label>
            <Input type="number" min={5} max={600} step={15} value={durationMin ?? ""}
              onChange={e => setDurationMin(parseInt(e.target.value, 10) || 90)}
              className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-xl font-mono tabular-nums w-32" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs h-9 cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave({ startTime, durationMin })}
            className="gap-1.5 cursor-pointer text-xs h-9 font-bold">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Add-subject quick dialog ──────────────────────────────────────────

function AddSubjectDialog({
  schoolId, classId, className, existingCodes, onClose, onSaved,
}: {
  schoolId:      string
  classId:       string
  className:     string
  existingCodes: Set<string>
  onClose:       () => void
  onSaved:       () => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) { toast.error("Name is required"); return }
    let finalCode = code.trim()
    if (!finalCode) {
      // Auto-generate a 4-digit code that's unique within the class
      let n = 1
      do {
        finalCode = String(n).padStart(4, "0")
        n++
      } while (existingCodes.has(finalCode) && n < 9999)
    } else if (existingCodes.has(finalCode)) {
      toast.error(`Code "${finalCode}" is already used in this class`)
      return
    }
    setSaving(true)
    try {
      await createSubject(schoolId, classId, name.trim(), finalCode)
      toast.success(`Added "${name.trim()}" to ${className}`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="bg-white/95 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-sm p-0 flex flex-col">
        <div className="flex items-start gap-4 px-6 pt-7 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Add Subject</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Adds a new subject to <strong>{className}</strong>. Use this for practicals or
              one-off exam-only subjects that aren&apos;t in the regular subject list.
            </SheetDescription>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subject name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Physics Practical"
              className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Code (auto if blank)</label>
            <Input value={code} onChange={e => setCode(e.target.value)}
              placeholder="e.g. PHY-P"
              className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-xl font-mono" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs h-9 cursor-pointer">
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="gap-1.5 cursor-pointer text-xs h-9 font-bold">
            <Plus className="w-3.5 h-3.5" /> {saving ? "Adding…" : "Add Subject"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
