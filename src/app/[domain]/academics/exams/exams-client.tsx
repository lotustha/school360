"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarRange, Plus, Pencil, Trash2, Save, X, Info, FileText, ArrowRight,
  GraduationCap, Check, Layers, FolderTree, Building2, Search, ArrowUpDown,
  LayoutList, LayoutGrid, GanttChart, Copy, Download, MoreHorizontal,
  CalendarClock, ClipboardCheck, DoorOpen, UserCog, CircleDot, Sparkles,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"
import {
  createExam, updateExam, deleteExam, getExamClasses, cloneExam, bulkDeleteExams,
  type ExamProgressRow,
} from "@/actions/exams"
import { loadGlobalCtx, saveGlobalCtx, FACULTY_GENERAL } from "@/lib/global-context"

type ExamRow = {
  id:             string
  name:           string
  academicYearId: string
  facultyId:      string | null
  academicYear:   { id: string; name: string; facultyId: string | null }
  faculty:        { id: string; name: string } | null
  createdAt:      Date
  _count?:        { papers: number; classes: number }
}

type FacultyOpt      = { id: string; name: string }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null; startDateBS: string }
type ClassOpt        = { id: string; name: string; facultyId: string | null; facultyName: string | null }
type ViewMode        = "list" | "grid" | "timeline"
type SortKey         = "created-desc" | "name-asc" | "name-desc" | "date-asc" | "date-desc" | "progress-desc"

const GENERAL = FACULTY_GENERAL
const SESSION_ALL = "__all__"

// Common Nepali school terminal names. Users can still type any custom name —
// the SearchableSelect accepts free text via allowFreeText.
const TERMINAL_NAME_PRESETS: SearchableSelectOption[] = [
  { value: "First Terminal Examination",  label: "First Terminal Examination",  hint: "Term 1" },
  { value: "Second Terminal Examination", label: "Second Terminal Examination", hint: "Term 2" },
  { value: "Third Terminal Examination",  label: "Third Terminal Examination",  hint: "Term 3" },
  { value: "Pre-Board Examination",       label: "Pre-Board Examination",       hint: "Mock" },
  { value: "Final Examination",           label: "Final Examination",           hint: "Annual" },
]

type Status = "DRAFT" | "PLANNING" | "SCHEDULED" | "LIVE" | "COMPLETED"

interface Props {
  schoolId:        string
  initialExams:    ExamRow[]
  initialProgress: ExamProgressRow[]
  academicYears:   AcademicYearOpt[]
  faculties:       FacultyOpt[]
  classes:         ClassOpt[]
}

function statusOf(p: ExamProgressRow | undefined): Status {
  if (!p || p.paperCount === 0) return "DRAFT"
  if (p.scheduledCount < p.paperCount) return "PLANNING"
  if (p.attendanceTotal > 0 && p.attendanceMarked >= p.attendanceTotal) return "COMPLETED"
  if (p.attendanceMarked > 0) return "LIVE"
  return "SCHEDULED"
}

const STATUS_META: Record<Status, { label: string; dot: string; pill: string }> = {
  DRAFT:     { label: "Draft",       dot: "bg-slate-400",   pill: "bg-slate-50 text-slate-600 border-slate-200" },
  PLANNING:  { label: "Planning",    dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 border-amber-200" },
  SCHEDULED: { label: "Scheduled",   dot: "bg-violet-500",  pill: "bg-violet-50 text-violet-700 border-violet-200" },
  LIVE:      { label: "Live",        dot: "bg-rose-500 animate-pulse", pill: "bg-rose-50 text-rose-700 border-rose-200" },
  COMPLETED: { label: "Completed",   dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

export function ExamsClient({ schoolId, initialExams, initialProgress, academicYears, faculties, classes }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [editing, setEditing]   = useState<ExamRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [cloning, setCloning]   = useState<ExamRow | null>(null)

  // SSR-safe defaults — localStorage read deferred to a post-mount effect to
  // avoid hydration mismatch (server has no window, client has stored picks).
  const [filterFacultyId, setFilterFacultyIdState] = useState<string>(GENERAL)
  const [filterSessionName, setFilterSessionNameState] = useState<string>(SESSION_ALL)

  useEffect(() => {
    const ctx = loadGlobalCtx()
    if (ctx.facultyKey)       setFilterFacultyIdState(ctx.facultyKey)
    if (ctx.academicYearName) setFilterSessionNameState(ctx.academicYearName)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Local UI state — not persisted (per-session/per-tab)
  const [search, setSearch]     = useState("")
  const [sortKey, setSortKey]   = useState<SortKey>("created-desc")
  const [view, setView]         = useState<ViewMode>("list")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function setFilterFacultyId(v: string) {
    setFilterFacultyIdState(v)
    saveGlobalCtx({ facultyKey: v })
    setSelected(new Set())
  }
  function setFilterSessionName(v: string) {
    setFilterSessionNameState(v)
    saveGlobalCtx({ academicYearName: v === SESSION_ALL ? undefined : v })
    setSelected(new Set())
  }

  const progressById = useMemo(() => {
    const m = new Map<string, ExamProgressRow>()
    for (const p of initialProgress) m.set(p.examId, p)
    return m
  }, [initialProgress])

  const sessionOptions = useMemo(() => {
    const facultyMatch = (yFacultyId: string | null) =>
      filterFacultyId === GENERAL ? yFacultyId === null : yFacultyId === filterFacultyId
    const byName = new Map<string, { name: string; isCurrent: boolean; latestStart: string }>()
    for (const y of academicYears) {
      if (!facultyMatch(y.facultyId)) continue
      const ex = byName.get(y.name)
      const start = y.startDateBS ?? ""
      if (!ex) { byName.set(y.name, { name: y.name, isCurrent: y.isCurrent, latestStart: start }); continue }
      if (y.isCurrent) ex.isCurrent = true
      if (start > ex.latestStart) ex.latestStart = start
    }
    return [...byName.values()].sort((a, b) => b.latestStart.localeCompare(a.latestStart))
  }, [academicYears, filterFacultyId])

  useEffect(() => {
    if (filterSessionName === SESSION_ALL) return
    if (!sessionOptions.some(s => s.name === filterSessionName)) {
      const latest = sessionOptions.find(s => s.isCurrent) ?? sessionOptions[0]
      setFilterSessionNameState(latest?.name ?? SESSION_ALL)
      saveGlobalCtx({ academicYearName: latest?.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOptions])

  const exams = initialExams

  const scopedExams = useMemo(() => exams.filter(e => {
    if (filterFacultyId === GENERAL) {
      if (e.facultyId !== null) return false
    } else if (e.facultyId !== filterFacultyId) {
      return false
    }
    if (filterSessionName !== SESSION_ALL && e.academicYear.name !== filterSessionName) return false
    return true
  }), [exams, filterFacultyId, filterSessionName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q ? scopedExams.filter(e => e.name.toLowerCase().includes(q)) : scopedExams
    list = [...list].sort((a, b) => {
      const pa = progressById.get(a.id)
      const pb = progressById.get(b.id)
      switch (sortKey) {
        case "name-asc":      return a.name.localeCompare(b.name)
        case "name-desc":     return b.name.localeCompare(a.name)
        case "date-asc":      return (pa?.firstDateBS ?? "￿").localeCompare(pb?.firstDateBS ?? "￿")
        case "date-desc":     return (pb?.firstDateBS ?? "").localeCompare(pa?.firstDateBS ?? "")
        case "progress-desc": {
          const va = pa && pa.paperCount > 0 ? pa.scheduledCount / pa.paperCount : 0
          const vb = pb && pb.paperCount > 0 ? pb.scheduledCount / pb.paperCount : 0
          return vb - va
        }
        case "created-desc":
        default:              return b.createdAt.getTime() - a.createdAt.getTime()
      }
    })
    return list
  }, [scopedExams, search, sortKey, progressById])

  // KPI roll-up for the strip
  const kpis = useMemo(() => {
    let papers = 0, scheduled = 0, seats = 0, attMarked = 0, attTotal = 0, live = 0, done = 0
    for (const e of scopedExams) {
      const p = progressById.get(e.id)
      if (!p) continue
      papers    += p.paperCount
      scheduled += p.scheduledCount
      seats     += p.seatsAssigned
      attMarked += p.attendanceMarked
      attTotal  += p.attendanceTotal
      const s = statusOf(p)
      if (s === "LIVE")      live++
      if (s === "COMPLETED") done++
    }
    return { terminals: scopedExams.length, papers, scheduled, seats, attMarked, attTotal, live, done }
  }, [scopedExams, progressById])

  function handleDelete(exam: ExamRow) {
    if (!confirm(`Delete "${exam.name}"? Papers, schedules, seats, and TerminalExamScore rows for this terminal will be removed.`)) return
    startT(async () => {
      try {
        await deleteExam(exam.id)
        toast.success("Terminal deleted")
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} terminal${selected.size === 1 ? "" : "s"}? All their papers, schedules, seats, and scores will be removed.`)) return
    startT(async () => {
      try {
        const res = await bulkDeleteExams(schoolId, [...selected])
        toast.success(`Deleted ${res.deleted} terminal${res.deleted === 1 ? "" : "s"}`)
        setSelected(new Set())
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  function exportXlsx(rows: ExamRow[], filename: string) {
    const COL = ["Name", "Faculty", "Session", "Status", "Classes", "Papers", "Scheduled", "Scheduled %", "First date BS", "Last date BS", "Seats", "Invigilator %", "Attendance %"]
    const aoa: (string | number)[][] = [COL]
    for (const e of rows) {
      const p = progressById.get(e.id)
      const s = statusOf(p)
      const schedPct = p && p.paperCount       > 0 ? Math.round((p.scheduledCount   / p.paperCount)       * 100) : 0
      const invigPct = p && p.invigilatorTotal > 0 ? Math.round((p.invigilatorRooms / p.invigilatorTotal) * 100) : 0
      const attPct   = p && p.attendanceTotal  > 0 ? Math.round((p.attendanceMarked / p.attendanceTotal)  * 100) : 0
      aoa.push([
        e.name,
        e.faculty?.name ?? "General",
        e.academicYear.name,
        STATUS_META[s].label,
        e._count?.classes ?? 0,
        p?.paperCount     ?? 0,
        p?.scheduledCount ?? 0,
        schedPct,
        p?.firstDateBS ?? "",
        p?.lastDateBS  ?? "",
        p?.seatsAssigned ?? 0,
        invigPct,
        attPct,
      ])
    }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, "Terminals")
    XLSX.writeFile(wb, filename)
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)))
  }

  const sortedFaculties = useMemo(
    () => [...faculties].sort((a, b) => b.name.localeCompare(a.name)),
    [faculties],
  )

  return (
    <div className="space-y-4">
      <KpiStrip kpis={kpis} />

      {/* Faculty + Session + Search + Sort + View */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Faculty
          </span>
          <Select value={filterFacultyId} onValueChange={setFilterFacultyId}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[170px]">
              <SelectValue placeholder="Pick faculty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL}>General (no faculty)</SelectItem>
              {sortedFaculties.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <CalendarRange className="w-3 h-3" /> Session
          </span>
          <Select value={filterSessionName} onValueChange={setFilterSessionName}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[170px]">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SESSION_ALL}>All sessions</SelectItem>
              {sessionOptions.map(s => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                  {s.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Search className="w-3 h-3" /> Search
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find by name (e.g. Term 1)"
              className="h-9 text-xs bg-white border-slate-200 pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" /> Sort
          </span>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created-desc">Newest first</SelectItem>
              <SelectItem value="name-asc">Name A → Z</SelectItem>
              <SelectItem value="name-desc">Name Z → A</SelectItem>
              <SelectItem value="date-asc">Earliest date</SelectItem>
              <SelectItem value="date-desc">Latest date</SelectItem>
              <SelectItem value="progress-desc">Most progress</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">View</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden h-9">
            <ViewBtn active={view === "list"}     onClick={() => setView("list")}     icon={<LayoutList   className="w-3.5 h-3.5" />} label="List" />
            <ViewBtn active={view === "grid"}     onClick={() => setView("grid")}     icon={<LayoutGrid   className="w-3.5 h-3.5" />} label="Cards" />
            <ViewBtn active={view === "timeline"} onClick={() => setView("timeline")} icon={<GanttChart   className="w-3.5 h-3.5" />} label="Timeline" />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <CalendarRange className="w-3 h-3" />
          {filtered.length} {filtered.length === 1 ? "terminal" : "terminals"}
          {search && <span className="text-slate-400 font-normal">· filtered</span>}
        </Badge>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={filtered.length === 0}
            onClick={() => exportXlsx(filtered, "terminals.xlsx")}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <Download className="w-3.5 h-3.5" /> XLSX
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> New Terminal
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-primary/8 border border-primary/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 sticky top-2 z-20 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-[11px] flex items-center justify-center">
              {selected.size}
            </span>
            <span className="font-semibold text-slate-800">selected</span>
            <button onClick={() => setSelected(new Set())} className="text-slate-500 hover:text-slate-700 underline text-[11px] cursor-pointer">
              clear
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => exportXlsx(filtered.filter(e => selected.has(e.id)), "terminals-selected.xlsx")}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDelete} disabled={pending}
              className="gap-1.5 cursor-pointer text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      <div className="bg-blue-50/40 border border-blue-200/60 rounded-xl p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800 leading-relaxed">
          A <strong>terminal</strong> belongs to a faculty (or General) and a session. The four progress bars show
          how much of each pipeline stage is complete: <em>routine</em> (papers placed on dates), <em>seats</em>{" "}
          (students assigned to rooms), <em>invigilators</em> (rooms covered) and <em>attendance</em> (marks recorded).
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} hasSearch={search.length > 0} />
      ) : view === "list" ? (
        <ListView
          rows={filtered}
          progressById={progressById}
          selected={selected}
          onToggle={toggleSelected}
          onSelectAll={toggleSelectAll}
          onEdit={setEditing}
          onClone={setCloning}
          onDelete={handleDelete}
          pending={pending}
        />
      ) : view === "grid" ? (
        <GridView
          rows={filtered}
          progressById={progressById}
          selected={selected}
          onToggle={toggleSelected}
          onEdit={setEditing}
          onClone={setCloning}
          onDelete={handleDelete}
        />
      ) : (
        <TimelineView rows={filtered} progressById={progressById} onOpen={(e) => router.push(`/academics/exams/${e.id}`)} />
      )}

      {(editing !== null || creating) && (
        <ExamBuilder
          key={editing?.id ?? "new-exam"}
          schoolId={schoolId}
          faculties={faculties}
          academicYears={academicYears}
          classes={classes}
          defaultFacultyId={filterFacultyId === GENERAL ? null : filterFacultyId}
          editing={editing}
          onClose={() => { setEditing(null); setCreating(false); router.refresh() }}
        />
      )}

      {cloning && (
        <CloneDrawer
          schoolId={schoolId}
          source={cloning}
          academicYears={academicYears}
          onClose={() => { setCloning(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── KPI strip ──────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: { terminals: number; papers: number; scheduled: number; seats: number; attMarked: number; attTotal: number; live: number; done: number } }) {
  const schedPct = kpis.papers   > 0 ? Math.round((kpis.scheduled / kpis.papers)   * 100) : 0
  const attPct   = kpis.attTotal > 0 ? Math.round((kpis.attMarked / kpis.attTotal) * 100) : 0
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Kpi label="Terminals"  value={kpis.terminals} icon={<CalendarRange className="w-3.5 h-3.5" />} accent="violet"  />
      <Kpi label="Papers"     value={kpis.papers}    icon={<FileText      className="w-3.5 h-3.5" />} accent="sky"     sub={schedPct > 0 ? `${schedPct}% scheduled` : undefined} />
      <Kpi label="Seats"      value={kpis.seats}     icon={<DoorOpen      className="w-3.5 h-3.5" />} accent="amber"   />
      <Kpi label="Live now"   value={kpis.live}      icon={<CircleDot     className="w-3.5 h-3.5" />} accent="rose"    pulse={kpis.live > 0} />
      <Kpi label="Completed"  value={kpis.done}      icon={<ClipboardCheck className="w-3.5 h-3.5" />} accent="emerald" sub={attPct > 0 ? `${attPct}% attendance` : undefined} />
    </div>
  )
}

function Kpi({ label, value, icon, accent, sub, pulse }: { label: string; value: number; icon: React.ReactNode; accent: "violet" | "sky" | "amber" | "rose" | "emerald"; sub?: string; pulse?: boolean }) {
  const ic = { violet: "text-violet-600", sky: "text-sky-600", amber: "text-amber-600", rose: "text-rose-600", emerald: "text-emerald-600" }[accent]
  const dot = { violet: "bg-violet-500", sky: "bg-sky-500", amber: "bg-amber-500", rose: "bg-rose-500", emerald: "bg-emerald-500" }[accent]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", ic)}>
          {icon}{label}
        </span>
        <span className={cn("w-1.5 h-1.5 rounded-full", dot, pulse && "animate-pulse")} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
        {sub && <span className="text-[10px] text-slate-500 font-medium tabular-nums">{sub}</span>}
      </div>
    </div>
  )
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 text-[11px] font-bold transition-colors cursor-pointer",
        active ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50",
      )}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ─── Progress bars (4 stacked thin bars) ────────────────────────────────

function ProgressBars({ p }: { p: ExamProgressRow | undefined }) {
  // Denominators reflect real coverage, not presence/absence:
  // Routine     = papers placed on a date / total papers
  // Seats       = scheduled rooms with ≥1 seat / total scheduled rooms
  // Invigilator = scheduled rooms with ≥1 invigilator / total scheduled rooms
  // Attendance  = marks recorded / seats assigned (one mark per seated student)
  const sched = p && p.paperCount       > 0 ? p.scheduledCount   / p.paperCount       : 0
  const seat  = p && p.invigilatorTotal > 0 ? p.roomsSeated      / p.invigilatorTotal : 0
  const invig = p && p.invigilatorTotal > 0 ? p.invigilatorRooms / p.invigilatorTotal : 0
  const att   = p && p.attendanceTotal  > 0 ? p.attendanceMarked / p.attendanceTotal  : 0
  return (
    <div className="flex items-center gap-1.5">
      <ProgressDot tag="Routine"  full="Routine"      pct={sched} color="bg-violet-500"  text="text-violet-600"  />
      <ProgressDot tag="Seats"    full="Seats"        pct={seat}  color="bg-sky-500"     text="text-sky-600"     />
      <ProgressDot tag="Invig."   full="Invigilators" pct={invig} color="bg-amber-500"   text="text-amber-600"   />
      <ProgressDot tag="Attend."  full="Attendance"   pct={att}   color="bg-emerald-500" text="text-emerald-600" />
    </div>
  )
}

function ProgressDot({ tag, full, pct, color, text }: { tag: string; full: string; pct: number; color: string; text: string }) {
  const w = Math.round(pct * 100)
  return (
    <div className="group flex-1 min-w-[36px] flex flex-col" title={`${full}: ${w}%`}>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-wider leading-none truncate",
        text,
      )}>{tag}</span>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full transition-all duration-300", color)} style={{ width: `${w}%` }} />
      </div>
      <span className="mt-1 text-[9px] font-bold text-slate-500 tabular-nums leading-none">{w}%</span>
    </div>
  )
}

// ─── List view ──────────────────────────────────────────────────────────

function ListView({
  rows, progressById, selected, onToggle, onSelectAll, onEdit, onClone, onDelete, pending,
}: {
  rows:         ExamRow[]
  progressById: Map<string, ExamProgressRow>
  selected:     Set<string>
  onToggle:     (id: string) => void
  onSelectAll:  () => void
  onEdit:       (e: ExamRow) => void
  onClone:      (e: ExamRow) => void
  onDelete:     (e: ExamRow) => void
  pending:      boolean
}) {
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,2.2fr)_minmax(0,1.2fr)_64px] gap-3 px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 items-center">
        <button onClick={onSelectAll} aria-label="Select all"
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors",
            allSelected ? "bg-primary border-primary" : "border-slate-300 hover:border-slate-400",
          )}>
          {allSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
        </button>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name · Session</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Papers</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date span (BS)</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">⋯</div>
      </div>
      <div className="divide-y divide-slate-100/60">
        {rows.map(exam => {
          const p   = progressById.get(exam.id)
          const s   = statusOf(p)
          const cnt = exam._count?.classes ?? 0
          const papers = p?.paperCount ?? exam._count?.papers ?? 0
          const isSel = selected.has(exam.id)
          return (
            <div key={exam.id}
              className={cn(
                "grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,2.2fr)_minmax(0,1.2fr)_64px] gap-3 px-4 py-3 items-center transition-colors group",
                isSel ? "bg-primary/5" : "hover:bg-primary/5",
              )}>
              <button onClick={() => onToggle(exam.id)} aria-label="Select"
                className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors",
                  isSel ? "bg-primary border-primary" : "border-slate-300 hover:border-slate-400",
                )}>
                {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
              </button>
              <div className="min-w-0">
                <Link
                  href={`/academics/exams/${exam.id}`}
                  className="font-semibold text-sm truncate flex items-center gap-1.5 text-slate-800 hover:text-primary transition-colors"
                >
                  <span className="truncate">{exam.name}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                  <span className="font-mono tabular-nums">{exam.academicYear.name}</span>
                  <span className="text-slate-300">·</span>
                  {exam.facultyId ? (
                    <span className="inline-flex items-center gap-0.5 text-violet-600">
                      <FolderTree className="w-2.5 h-2.5" />{exam.faculty?.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-slate-500">
                      <Building2 className="w-2.5 h-2.5" />General
                    </span>
                  )}
                  {cnt > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">
                        <GraduationCap className="w-2.5 h-2.5" />{cnt}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_META[s].pill)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </span>
              </div>
              <div>
                {papers > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                    <FileText className="w-2.5 h-2.5" />{papers}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-300 italic">no papers</span>
                )}
              </div>
              <ProgressBars p={p} />
              <div className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
                {p?.firstDateBS ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="w-2.5 h-2.5 text-slate-400" />
                    {formatBS(p.firstDateBS)}
                    {p.lastDateBS && p.lastDateBS !== p.firstDateBS && (
                      <>
                        <span className="text-slate-300">→</span>
                        {formatBS(p.lastDateBS)}
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-300 italic font-sans">not scheduled</span>
                )}
              </div>
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEdit(exam)} className="cursor-pointer text-xs">
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onClone(exam)} className="cursor-pointer text-xs">
                      <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(exam)} disabled={pending}
                      className="cursor-pointer text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Card grid view ─────────────────────────────────────────────────────

function GridView({
  rows, progressById, selected, onToggle, onEdit, onClone, onDelete,
}: {
  rows:         ExamRow[]
  progressById: Map<string, ExamProgressRow>
  selected:     Set<string>
  onToggle:     (id: string) => void
  onEdit:       (e: ExamRow) => void
  onClone:      (e: ExamRow) => void
  onDelete:     (e: ExamRow) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(exam => {
        const p = progressById.get(exam.id)
        const s = statusOf(p)
        const isSel  = selected.has(exam.id)
        const papers = p?.paperCount ?? exam._count?.papers ?? 0
        const cnt    = exam._count?.classes ?? 0
        const schedPct = p && p.paperCount > 0 ? Math.round((p.scheduledCount / p.paperCount) * 100) : 0
        return (
          <div key={exam.id}
            className={cn(
              "group bg-white/70 backdrop-blur-xl rounded-xl border shadow-sm p-4 transition-all hover:shadow-md hover:border-primary/30",
              isSel ? "border-primary/40 ring-1 ring-primary/20" : "border-white/40",
            )}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => onToggle(exam.id)} aria-label="Select"
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors mt-0.5 flex-shrink-0",
                    isSel ? "bg-primary border-primary" : "border-slate-300 hover:border-slate-400",
                  )}>
                  {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
                </button>
                <Link href={`/academics/exams/${exam.id}`} className="font-bold text-sm text-slate-800 hover:text-primary transition-colors truncate">
                  {exam.name}
                </Link>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 cursor-pointer -mr-1 -mt-1">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onEdit(exam)} className="cursor-pointer text-xs">
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onClone(exam)} className="cursor-pointer text-xs">
                    <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(exam)} className="cursor-pointer text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_META[s].pill)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_META[s].dot)} />
                {STATUS_META[s].label}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-slate-500">{exam.academicYear.name}</span>
              {exam.facultyId ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600">
                  <FolderTree className="w-2.5 h-2.5" />{exam.faculty?.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                  <Building2 className="w-2.5 h-2.5" />General
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <Stat n={papers} label="papers" />
              <Stat n={cnt} label="classes" />
              <Stat n={`${schedPct}%`} label="scheduled" />
            </div>

            <ProgressBars p={p} />

            <div className="mt-3 text-[10px] text-slate-500 font-mono tabular-nums flex items-center gap-1">
              <CalendarClock className="w-2.5 h-2.5 text-slate-400" />
              {p?.firstDateBS ? (
                p.lastDateBS && p.lastDateBS !== p.firstDateBS
                  ? `${formatBS(p.firstDateBS)} → ${formatBS(p.lastDateBS)}`
                  : formatBS(p.firstDateBS)
              ) : (
                <span className="italic font-sans text-slate-400">no schedule yet</span>
              )}
              <div className="flex-1" />
              <Link href={`/academics/exams/${exam.id}`}
                className="text-primary font-bold text-[10px] inline-flex items-center gap-0.5 hover:underline">
                Open <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="bg-slate-50/70 rounded-lg py-1.5">
      <div className="text-sm font-black tabular-nums text-slate-900">{n}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  )
}

// ─── Timeline view (BS Gantt) ───────────────────────────────────────────

function TimelineView({
  rows, progressById, onOpen,
}: {
  rows: ExamRow[]; progressById: Map<string, ExamProgressRow>; onOpen: (e: ExamRow) => void
}) {
  // Comparable BS keys (strings already sortable lex when zero-padded year-month-day)
  const dated = rows
    .map(e => ({ e, p: progressById.get(e.id) }))
    .filter(x => x.p?.firstDateBS && x.p?.lastDateBS)
  if (dated.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
        <GanttChart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No scheduled terminals yet</p>
        <p className="text-xs text-muted-foreground">
          The timeline appears once at least one paper has a date.
        </p>
      </div>
    )
  }
  const minBS = dated.reduce((m, x) => x.p!.firstDateBS! < m ? x.p!.firstDateBS! : m, dated[0].p!.firstDateBS!)
  const maxBS = dated.reduce((m, x) => x.p!.lastDateBS!  > m ? x.p!.lastDateBS!  : m, dated[0].p!.lastDateBS!)

  // Days between two BS strings — approximate via dayOfYear comparison; for visual scaling only.
  function bsToDayIndex(bs: string): number {
    const [y, m, d] = bs.split("-").map(n => parseInt(n, 10))
    if (isNaN(y) || isNaN(m) || isNaN(d)) return 0
    return y * 365 + (m - 1) * 30 + (d - 1)
  }
  const minIdx = bsToDayIndex(minBS)
  const maxIdx = bsToDayIndex(maxBS)
  const span   = Math.max(1, maxIdx - minIdx)

  function posPct(bs: string) { return ((bsToDayIndex(bs) - minIdx) / span) * 100 }

  // Unscheduled rows shown at the bottom
  const unscheduled = rows.filter(e => {
    const p = progressById.get(e.id)
    return !p?.firstDateBS
  })

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{formatBS(minBS)}</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-300 font-black">BS timeline</span>
        <span className="inline-flex items-center gap-1">{formatBS(maxBS)}<CalendarClock className="w-3 h-3" /></span>
      </div>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 bottom-0 grid grid-cols-4 pointer-events-none">
          {[0, 1, 2, 3].map(i => <div key={i} className={cn("border-l border-dashed", i === 0 ? "border-transparent" : "border-slate-200")} />)}
        </div>
        <div className="relative space-y-2">
          {dated.map(({ e, p }) => {
            const start = posPct(p!.firstDateBS!)
            const end   = posPct(p!.lastDateBS!)
            const w     = Math.max(2.5, end - start)
            const s     = statusOf(p)
            const barBg = {
              DRAFT:     "bg-slate-400",
              PLANNING:  "bg-amber-500",
              SCHEDULED: "bg-violet-500",
              LIVE:      "bg-rose-500",
              COMPLETED: "bg-emerald-500",
            }[s]
            return (
              <div key={e.id} className="relative h-9 group">
                <button onClick={() => onOpen(e)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded-md text-[10px] font-bold text-white shadow-sm cursor-pointer transition-all overflow-hidden h-7",
                    "hover:shadow-md hover:brightness-110 active:scale-[0.98]",
                    barBg,
                  )}
                  style={{ left: `${start}%`, width: `${w}%`, minWidth: 60 }}>
                  <span className="px-2 truncate inline-block max-w-full leading-7">
                    {e.name}
                  </span>
                </button>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {formatBS(p!.firstDateBS!)}{p!.lastDateBS !== p!.firstDateBS ? ` → ${formatBS(p!.lastDateBS!)}` : ""}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Not scheduled yet</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {unscheduled.map(e => (
              <button key={e.id} onClick={() => onOpen(e)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-colors">
                <Sparkles className="w-2.5 h-2.5 text-slate-400" />
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100 text-[10px]">
        {(["PLANNING", "SCHEDULED", "LIVE", "COMPLETED"] as Status[]).map(s => (
          <span key={s} className="inline-flex items-center gap-1 text-slate-600">
            <span className={cn("w-2 h-2 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
      <CalendarRange className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="font-semibold text-sm mb-1">
        {hasSearch ? "No terminals match your search" : "No terminals in this faculty yet"}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        {hasSearch ? "Try a different name or clear the search." : <>Add one — e.g. <em>Term 1</em>, <em>Final Term</em>.</>}
      </p>
      {!hasSearch && (
        <Button size="sm" onClick={onCreate} className="gap-1.5 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> New Terminal
        </Button>
      )}
    </div>
  )
}

// ─── Clone Drawer ───────────────────────────────────────────────────────

function CloneDrawer({
  schoolId, source, academicYears, onClose,
}: {
  schoolId:      string
  source:        ExamRow
  academicYears: AcademicYearOpt[]
  onClose:       () => void
}) {
  const [name, setName] = useState(`${source.name} (Copy)`)
  const [targetSession, setTargetSession] = useState(source.academicYearId)
  const [pending, startT] = useTransition()

  // Only sessions of the same faculty are valid clone targets (cloneExam enforces)
  const sessionOptions = useMemo(() => academicYears.filter(y => y.facultyId === source.facultyId), [academicYears, source.facultyId])

  function handleClone() {
    if (!name.trim())     { toast.error("Name is required"); return }
    if (!targetSession)   { toast.error("Pick a target session"); return }
    startT(async () => {
      try {
        await cloneExam({ schoolId, sourceExamId: source.id, newName: name.trim(), academicYearId: targetSession })
        toast.success("Terminal duplicated")
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to duplicate")
      }
    })
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Copy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">Duplicate terminal</div>
              <div className="text-xs text-muted-foreground font-normal">Papers, classes & targets copy across</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Duplicate terminal</SheetDescription>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50/70 rounded-lg p-3 text-xs text-slate-600">
            <div className="font-bold text-slate-800 mb-1 truncate">Source · {source.name}</div>
            <div className="text-[11px] flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums">{source.academicYear.name}</span>
              <span className="text-slate-300">·</span>
              {source.facultyId
                ? <span className="inline-flex items-center gap-0.5 text-violet-700"><FolderTree className="w-2.5 h-2.5" />{source.faculty?.name}</span>
                : <span className="inline-flex items-center gap-0.5 text-slate-600"><Building2 className="w-2.5 h-2.5" />General</span>}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">New name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target session</label>
            <Select value={targetSession} onValueChange={setTargetSession}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    <span className="font-mono tabular-nums">{y.name}</span>
                    {y.isCurrent && <span className="text-[10px] text-amber-600 ml-1.5 font-bold">CURRENT</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-400 mt-1">Must belong to the same faculty as the source.</p>
          </div>
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 leading-relaxed">
            <strong>What carries over:</strong> papers (subjects, codes, marks, duration), class assignments, and per-paper targets.<br />
            <strong>What does not:</strong> schedules, seats, invigilators and attendance — those are session-specific.
          </div>
        </div>
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleClone} disabled={pending} className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Copy className="w-3.5 h-3.5" /> {pending ? "Duplicating…" : "Duplicate"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Builder (create/edit) ──────────────────────────────────────────────

function ExamBuilder({
  schoolId, faculties, academicYears, classes, defaultFacultyId, editing, onClose,
}: {
  schoolId:         string
  faculties:        FacultyOpt[]
  academicYears:    AcademicYearOpt[]
  classes:          ClassOpt[]
  defaultFacultyId: string | null
  editing:          ExamRow | null
  onClose:          () => void
}) {
  const isEdit = editing !== null

  const [facultyId, setFacultyId] = useState<string>(
    editing
      ? (editing.facultyId ?? GENERAL)
      : (defaultFacultyId ?? GENERAL),
  )
  const facultyForLookup = facultyId === GENERAL ? null : facultyId

  const sessionOptions = useMemo(() => academicYears.filter(y => {
    if (!facultyForLookup) return y.facultyId === null
    return y.facultyId === facultyForLookup
  }), [academicYears, facultyForLookup])

  const defaultSessionId = sessionOptions[0]?.id ?? ""

  const [name, setName] = useState(editing?.name ?? "")
  const [academicYearId, setAcademicYearId] = useState(
    editing?.academicYearId ?? defaultSessionId,
  )

  const classOptions = useMemo(() => {
    if (!facultyForLookup) return classes.filter(c => c.facultyId === null)
    return classes.filter(c => c.facultyId === facultyForLookup)
  }, [classes, facultyForLookup])

  const [classIds, setClassIds] = useState<string[]>(() =>
    isEdit ? [] : classOptions.map(c => c.id),
  )
  const [classesLoaded, setClassesLoaded] = useState(false)

  useMemo(() => {
    if (!isEdit || classesLoaded || !editing) return
    getExamClasses(editing.id, schoolId).then(ids => {
      setClassIds(ids)
      setClassesLoaded(true)
    }).catch(() => setClassesLoaded(true))
  }, [isEdit, classesLoaded, editing, schoolId])

  function changeFaculty(next: string) {
    setFacultyId(next)
    const nextLookup = next === GENERAL ? null : next
    const nextSession = academicYears.find(y => {
      if (!nextLookup) return y.facultyId === null
      return y.facultyId === nextLookup
    })
    setAcademicYearId(nextSession?.id ?? "")
    const nextClasses = nextLookup
      ? classes.filter(c => c.facultyId === nextLookup)
      : classes.filter(c => c.facultyId === null)
    setClassIds(nextClasses.map(c => c.id))
  }

  function toggleClass(id: string) {
    setClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function pickAllClasses() { setClassIds(classOptions.map(c => c.id)) }
  function clearClasses()   { setClassIds([]) }

  const [pending, startT] = useTransition()

  function handleSave() {
    if (!name.trim())                  { toast.error("Name is required");                    return }
    if (!academicYearId)               { toast.error("Pick a session");                      return }
    startT(async () => {
      try {
        if (isEdit && editing) {
          await updateExam(editing.id, {
            name,
            facultyId: facultyForLookup,
            classIds,
          })
          toast.success("Terminal updated")
        } else {
          await createExam({
            schoolId,
            name,
            academicYearId,
            facultyId: facultyForLookup,
            classIds,
          })
          toast.success("Terminal created")
        }
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarRange className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Terminal" : "New Terminal"}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {isEdit ? "Rename or change which classes sit it" : "Faculty → Session → Name → Classes"}
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Terminal editor</SheetDescription>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faculty</label>
            <Select value={facultyId} onValueChange={changeFaculty} disabled={isEdit}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faculties.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    <FolderTree className="w-3 h-3 text-violet-600 inline mr-1.5" />
                    {f.name}
                  </SelectItem>
                ))}
                <SelectItem value={GENERAL}>
                  <Building2 className="w-3 h-3 text-slate-500 inline mr-1.5" />
                  General <span className="text-[10px] text-slate-400 ml-1">no faculty</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1">Faculty cannot be changed once the terminal exists.</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session (academic year)</label>
            <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={isEdit}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue placeholder={sessionOptions.length === 0 ? "No sessions for this faculty" : "Select session"} />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    <span className="font-mono tabular-nums">{y.name}</span>
                    {y.isCurrent && <span className="text-[10px] text-amber-600 ml-1.5 font-bold">CURRENT</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && sessionOptions.length === 0 && (
              <p className="text-[10px] text-rose-500 mt-1">
                No sessions exist for this faculty.{" "}
                <Link href="/academics/years" className="underline">Create one →</Link>
              </p>
            )}
            {isEdit && (
              <p className="text-[10px] text-slate-400 mt-1">Session cannot be changed once the terminal exists.</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
            <div className="mt-1">
              <SearchableSelect
                value={name}
                onChange={setName}
                options={TERMINAL_NAME_PRESETS}
                placeholder="Pick a preset or type your own…"
                searchPlaceholder="Search presets or type custom name…"
                emptyText="No preset matches — type to use as custom name."
                allowFreeText
                variant="plain"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Pick a common name or type your own (e.g. <em>Mid-Term</em>, <em>Unit Test 1</em>).
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Classes that sit this terminal ({classIds.length}/{classOptions.length})
              </label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={pickAllClasses}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer">All</button>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={clearClasses}
                  className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer">None</button>
              </div>
            </div>
            {classOptions.length === 0 ? (
              <div className="mt-1 bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2.5 text-[11px] text-amber-800">
                No classes in this faculty.{" "}
                <Link href="/academics/classes" className="underline font-semibold">Add classes →</Link>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {classOptions.map(c => {
                  const picked = classIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer text-left",
                        picked
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                        picked ? "bg-emerald-500 border-emerald-600" : "border-slate-300",
                      )}>
                        {picked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className="font-bold truncate">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {!isEdit && classIds.length === 0 && classOptions.length > 0 && (
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                Pick at least one class so the routine knows which columns to show.
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
