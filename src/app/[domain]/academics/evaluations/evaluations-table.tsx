"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardCheck, Plus, Sparkles, Search, Download, Copy, Trash2, Pencil,
  Lock, Unlock, Eye, EyeOff, MoreHorizontal, Check, X, Hash, Award,
  GraduationCap, BookOpen, LayoutList, GanttChart, AlertCircle, ArrowRight,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  updateEvaluation, deleteEvaluation, cloneEvaluation,
  bulkUpdateEvaluations, bulkDeleteEvaluations,
} from "@/actions/evaluations"
import type { EvaluationRow } from "./evaluations-columns"
import { EvaluationFormSheet, type EvaluationFormValue } from "./evaluation-form-sheet"

interface Props {
  schoolId:               string
  evaluations:            EvaluationRow[]
  faculties:              { id: string; name: string }[]
  classes:                { id: string; name: string; facultyId: string | null }[]
  academicYears:          { id: string; name: string; isCurrent: boolean; facultyId: string | null }[]
  /** Pre-fill the New Evaluation form from the page's global filter. */
  defaultFacultyId?:      string | null
  defaultAcademicYearId?: string | null
  /** When the URL has ?class=…, the resolved class row — surfaced as a clear-able chip. */
  activeClass?:           { id: string; name: string; facultyId: string | null } | null
}

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "LOCKED" | "FINAL"
type ViewMode    = "list" | "timeline"

const STATUS_META: Record<StatusFilter, { label: string; pill: string; dot: string }> = {
  ALL:       { label: "All",       pill: "bg-slate-50 text-slate-700 border-slate-200",      dot: "bg-slate-400"   },
  DRAFT:     { label: "Draft",     pill: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500"   },
  PUBLISHED: { label: "Published", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  LOCKED:    { label: "Locked",    pill: "bg-slate-100 text-slate-700 border-slate-200",      dot: "bg-slate-500"   },
  FINAL:     { label: "Final",     pill: "bg-violet-50 text-violet-700 border-violet-200",    dot: "bg-violet-500"  },
}

export function EvaluationsTable({
  schoolId, evaluations, faculties, classes, academicYears,
  defaultFacultyId       = null,
  defaultAcademicYearId  = null,
  activeClass            = null,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startT] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<EvaluationFormValue | null>(null)
  const [cloning,  setCloning]  = useState<EvaluationRow | null>(null)
  const [search,   setSearch]   = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [view,     setView]     = useState<ViewMode>("list")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // KPI roll-up
  const kpis = useMemo(() => {
    let drafts = 0, published = 0, locked = 0, finals = 0
    let resultsTotal = 0, denomTotal = 0
    for (const e of evaluations) {
      const denom = e.subjectsCount
      const num   = denom > 0 ? Math.min(e.resultsEntered, denom) : 0
      resultsTotal += num
      denomTotal   += denom
      if (e.publishAt) published++
      else            drafts++
      if (e.isLocked)  locked++
      if (e.isFinal)   finals++
    }
    return {
      total:     evaluations.length,
      drafts, published, locked, finals,
      avgPct:    denomTotal > 0 ? Math.round((resultsTotal / denomTotal) * 100) : 0,
    }
  }, [evaluations])

  // Status + search filter (timeline view ignores status)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return evaluations.filter(e => {
      if (q && !e.name.toLowerCase().includes(q) && !(e.description ?? "").toLowerCase().includes(q)) return false
      switch (statusFilter) {
        case "DRAFT":     return !e.publishAt
        case "PUBLISHED": return !!e.publishAt
        case "LOCKED":    return e.isLocked
        case "FINAL":     return e.isFinal
        default:          return true
      }
    })
  }, [evaluations, search, statusFilter])

  function clearClassFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("class")
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleDelete(row: EvaluationRow) {
    if (!confirm(`Delete "${row.name}"? All SubjectEvaluations, components, and marks cascade-delete.`)) return
    startT(async () => {
      try {
        await deleteEvaluation(row.id)
        toast.success("Evaluation deleted")
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  function handleToggleLock(row: EvaluationRow) {
    startT(async () => {
      try {
        await updateEvaluation(row.id, { isLocked: !row.isLocked })
        toast.success(row.isLocked ? "Evaluation unlocked" : "Evaluation locked")
        router.refresh()
      } catch { toast.error("Failed to toggle lock") }
    })
  }

  function handleTogglePublish(row: EvaluationRow) {
    const next = row.publishAt ? null : new Date().toISOString()
    startT(async () => {
      try {
        await updateEvaluation(row.id, { publishAt: next })
        toast.success(next ? "Results published" : "Results unpublished")
        router.refresh()
      } catch { toast.error("Failed to update publish state") }
    })
  }

  function handleEdit(row: EvaluationRow) {
    const firstClass = row.classes[0]
    const facultyId = firstClass
      ? classes.find(c => c.id === firstClass.id)?.facultyId ?? null
      : null
    setEditing({
      id:             row.id,
      name:           row.name,
      description:    row.description,
      sequenceNumber: row.sequenceNumber,
      classIds:       row.classes.map(c => c.id),
      academicYearId: row.academicYearId,
      facultyId,
      isFinal:        row.isFinal,
      publishAt:      row.publishAt,
    })
  }

  function handleBulkPublish(publish: boolean) {
    if (selected.size === 0) return
    startT(async () => {
      try {
        const res = await bulkUpdateEvaluations({
          schoolId,
          ids: [...selected],
          publishAt: publish ? "now" : "clear",
        })
        toast.success(`${res.updated} ${publish ? "published" : "unpublished"}`)
        setSelected(new Set())
        router.refresh()
      } catch { toast.error("Bulk update failed") }
    })
  }

  function handleBulkLock(lock: boolean) {
    if (selected.size === 0) return
    startT(async () => {
      try {
        const res = await bulkUpdateEvaluations({ schoolId, ids: [...selected], isLocked: lock })
        toast.success(`${res.updated} ${lock ? "locked" : "unlocked"}`)
        setSelected(new Set())
        router.refresh()
      } catch { toast.error("Bulk update failed") }
    })
  }

  function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} evaluation${selected.size === 1 ? "" : "s"}? All their SubjectEvaluations, components, and marks cascade-delete.`)) return
    startT(async () => {
      try {
        const res = await bulkDeleteEvaluations(schoolId, [...selected])
        toast.success(`Deleted ${res.deleted} evaluation${res.deleted === 1 ? "" : "s"}`)
        setSelected(new Set())
        router.refresh()
      } catch { toast.error("Bulk delete failed") }
    })
  }

  function exportXlsx(rows: EvaluationRow[], filename: string) {
    const COL = ["Name", "Description", "Sequence", "Final", "Session", "Classes", "Subjects", "Components", "Results", "Results %", "Status", "Published at", "Created"]
    const aoa: (string | number)[][] = [COL]
    for (const r of rows) {
      const pct = r.subjectsCount > 0 ? Math.round((Math.min(r.resultsEntered, r.subjectsCount) / r.subjectsCount) * 100) : 0
      const status = r.publishAt ? "Published" : r.isLocked ? "Locked draft" : "Draft"
      aoa.push([
        r.name,
        r.description ?? "",
        r.sequenceNumber,
        r.isFinal ? "Yes" : "",
        r.academicYearName,
        r.classes.map(c => c.name).join(", "),
        r.subjectsCount,
        r.componentsTotal,
        r.resultsEntered,
        pct,
        status,
        r.publishAt ? new Date(r.publishAt).toISOString().slice(0, 10) : "",
        new Date(r.createdAt).toISOString().slice(0, 10),
      ])
    }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, "Evaluations")
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

  return (
    <div className="space-y-3">
      <KpiStrip kpis={kpis} />

      {/* Search + view + actions */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Search className="w-3 h-3" /> Search
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find by name or description"
              className="h-9 text-xs bg-white border-slate-200 pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">View</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden h-9">
            <ViewBtn active={view === "list"}     onClick={() => setView("list")}     icon={<LayoutList className="w-3.5 h-3.5" />} label="List" />
            <ViewBtn active={view === "timeline"} onClick={() => setView("timeline")} icon={<GanttChart className="w-3.5 h-3.5" />} label="Sequence" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={filtered.length === 0}
              onClick={() => exportXlsx(filtered, "evaluations.xlsx")}
              className="gap-1.5 cursor-pointer text-xs h-9">
              <Download className="w-3.5 h-3.5" /> XLSX
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9">
              <Plus className="w-3.5 h-3.5" /> New Evaluation
            </Button>
          </div>
        </div>
      </div>

      {/* Active class chip + status chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeClass && (
          <div className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/30">
            <GraduationCap className="w-3 h-3" />
            <span>Class: {activeClass.name}</span>
            <button onClick={clearClassFilter} aria-label="Clear class filter"
              className="ml-0.5 w-4 h-4 rounded-full hover:bg-primary/15 inline-flex items-center justify-center cursor-pointer">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
        {(["ALL", "DRAFT", "PUBLISHED", "LOCKED", "FINAL"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer",
              statusFilter === s
                ? cn(STATUS_META[s].pill, "ring-1 ring-current shadow-sm")
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </button>
        ))}
        <div className="flex-1" />
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <ClipboardCheck className="w-3 h-3" />
          {filtered.length} of {evaluations.length}
        </Badge>
      </div>

      {/* Bulk action bar (sticky when selected) */}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleBulkPublish(true)}
              className="gap-1.5 cursor-pointer text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <Eye className="w-3.5 h-3.5" /> Publish
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleBulkPublish(false)}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <EyeOff className="w-3.5 h-3.5" /> Unpublish
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleBulkLock(true)}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <Lock className="w-3.5 h-3.5" /> Lock
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleBulkLock(false)}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <Unlock className="w-3.5 h-3.5" /> Unlock
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportXlsx(filtered.filter(e => selected.has(e.id)), "evaluations-selected.xlsx")}
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

      {filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} hasFilter={statusFilter !== "ALL" || !!search} />
      ) : view === "list" ? (
        <ListView
          rows={filtered}
          selected={selected}
          onToggle={toggleSelected}
          onSelectAll={toggleSelectAll}
          onEdit={handleEdit}
          onClone={setCloning}
          onDelete={handleDelete}
          onToggleLock={handleToggleLock}
          onTogglePublish={handleTogglePublish}
          pending={pending}
        />
      ) : (
        <TimelineView rows={filtered} onOpen={(id) => router.push(`/academics/evaluations/${id}`)} />
      )}

      {(creating || editing !== null) && (
        <EvaluationFormSheet
          key={editing?.id ?? "new"}
          open={true}
          onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null) } }}
          schoolId={schoolId}
          faculties={faculties}
          classes={classes}
          academicYears={academicYears}
          editing={editing}
          defaultFacultyId={defaultFacultyId}
          defaultAcademicYearId={defaultAcademicYearId}
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

function KpiStrip({ kpis }: { kpis: { total: number; drafts: number; published: number; locked: number; finals: number; avgPct: number } }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi label="Total"     value={kpis.total}     icon={<ClipboardCheck className="w-3.5 h-3.5" />} accent="violet" />
      <Kpi label="Drafts"    value={kpis.drafts}    icon={<Pencil        className="w-3.5 h-3.5" />} accent="amber" />
      <Kpi label="Published" value={kpis.published} icon={<Eye           className="w-3.5 h-3.5" />} accent="emerald" />
      <Kpi label="Locked"    value={kpis.locked}    icon={<Lock          className="w-3.5 h-3.5" />} accent="slate" />
      <Kpi label="Finals"    value={kpis.finals}    icon={<Award         className="w-3.5 h-3.5" />} accent="rose" />
      <Kpi label="Avg results" value={`${kpis.avgPct}%`} icon={<Sparkles className="w-3.5 h-3.5" />} accent="sky" />
    </div>
  )
}

function Kpi({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent: "violet" | "amber" | "emerald" | "slate" | "rose" | "sky" }) {
  const ic = { violet: "text-violet-600", amber: "text-amber-600", emerald: "text-emerald-600", slate: "text-slate-600", rose: "text-rose-600", sky: "text-sky-600" }[accent]
  const dot = { violet: "bg-violet-500", amber: "bg-amber-500", emerald: "bg-emerald-500", slate: "bg-slate-500", rose: "bg-rose-500", sky: "bg-sky-500" }[accent]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", ic)}>
          {icon}{label}
        </span>
        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      </div>
      <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
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

// ─── List view ──────────────────────────────────────────────────────────

function ListView({
  rows, selected, onToggle, onSelectAll, onEdit, onClone, onDelete, onToggleLock, onTogglePublish, pending,
}: {
  rows:            EvaluationRow[]
  selected:        Set<string>
  onToggle:        (id: string) => void
  onSelectAll:     () => void
  onEdit:          (e: EvaluationRow) => void
  onClone:         (e: EvaluationRow) => void
  onDelete:        (e: EvaluationRow) => void
  onToggleLock:    (e: EvaluationRow) => void
  onTogglePublish: (e: EvaluationRow) => void
  pending:         boolean
}) {
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_64px] gap-3 px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 items-center">
        <button onClick={onSelectAll} aria-label="Select all"
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors",
            allSelected ? "bg-primary border-primary" : "border-slate-300 hover:border-slate-400",
          )}>
          {allSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
        </button>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evaluation · Session</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classes</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subjects</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Results progress</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">⋯</div>
      </div>
      <div className="divide-y divide-slate-100/60">
        {rows.map(r => {
          const isSel = selected.has(r.id)
          const denom = r.subjectsCount
          const num   = denom > 0 ? Math.min(r.resultsEntered, denom) : 0
          const pct   = denom === 0 ? 0 : Math.round((num / denom) * 100)
          const visibleClasses = r.classes.slice(0, 4)
          const restClasses    = r.classes.length - visibleClasses.length
          return (
            <div key={r.id}
              className={cn(
                "grid grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_64px] gap-3 px-4 py-3 items-center transition-colors group",
                isSel ? "bg-primary/5" : "hover:bg-primary/5",
              )}>
              <button onClick={() => onToggle(r.id)} aria-label="Select"
                className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors",
                  isSel ? "bg-primary border-primary" : "border-slate-300 hover:border-slate-400",
                )}>
                {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
              </button>
              <div className="min-w-0">
                <Link
                  href={`/academics/evaluations/${r.id}`}
                  className="font-semibold text-sm truncate flex items-center gap-1.5 text-slate-800 hover:text-primary transition-colors"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm",
                    r.isFinal ? "bg-emerald-100" : "bg-blue-100",
                  )}>
                    <ClipboardCheck className={cn("w-3.5 h-3.5", r.isFinal ? "text-emerald-600" : "text-blue-600")} />
                  </div>
                  <span className="truncate">{r.name}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />Seq {r.sequenceNumber}</span>
                  <span className="text-slate-300">·</span>
                  <span className={cn(
                    "inline-flex items-center gap-0.5 font-mono tabular-nums",
                    r.isCurrentYear ? "text-emerald-700 font-bold" : "text-slate-500",
                  )}>
                    {r.academicYearName}
                    {r.isCurrentYear && <span className="text-[9px] font-black ml-0.5">CURRENT</span>}
                  </span>
                  {r.isFinal && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">
                        <Award className="w-2.5 h-2.5" />Final
                      </span>
                    </>
                  )}
                  {r.description && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="truncate text-violet-700">{r.description}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {r.classes.length === 0 ? (
                  <span className="text-[10px] text-slate-300 italic">no classes</span>
                ) : (
                  <>
                    {visibleClasses.map(c => (
                      <span key={c.id} title={c.facultyName ? `${c.name} · ${c.facultyName}` : c.name}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                        {c.name}
                      </span>
                    ))}
                    {restClasses > 0 && (
                      <span title={r.classes.slice(4).map(c => c.name).join(", ")}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        +{restClasses}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div>
                {r.subjectsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <BookOpen className="w-2.5 h-2.5" />{r.subjectsCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-300 italic">none</span>
                )}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full transition-all",
                    pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-slate-200",
                  )} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-500 w-9 text-right tabular-nums">{pct}%</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => onTogglePublish(r)} disabled={pending}
                  title={r.publishAt ? "Click to unpublish" : "Click to publish"}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer",
                    r.publishAt
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
                  )}>
                  {r.publishAt
                    ? <><Eye    className="w-2.5 h-2.5" /> Published</>
                    : <><EyeOff className="w-2.5 h-2.5" /> Draft</>}
                </button>
                {r.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
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
                    <DropdownMenuItem asChild>
                      <Link href={`/academics/evaluations/${r.id}`} className="cursor-pointer text-xs gap-2">
                        <ClipboardCheck className="w-3.5 h-3.5" /> Open
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(r)} className="cursor-pointer text-xs gap-2">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onClone(r)} className="cursor-pointer text-xs gap-2">
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onToggleLock(r)} className="cursor-pointer text-xs gap-2">
                      {r.isLocked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(r)} disabled={pending}
                      className="cursor-pointer text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50 gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
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

// ─── Timeline (sequence) view ───────────────────────────────────────────

function TimelineView({ rows, onOpen }: { rows: EvaluationRow[]; onOpen: (id: string) => void }) {
  // Group by session, then order each lane by sequenceNumber. Finals always pinned right.
  const lanes = useMemo(() => {
    const m = new Map<string, EvaluationRow[]>()
    for (const r of rows) {
      const k = r.academicYearName
      const arr = m.get(k) ?? []
      arr.push(r)
      m.set(k, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.isFinal && !b.isFinal) return 1
        if (!a.isFinal && b.isFinal) return -1
        return a.sequenceNumber - b.sequenceNumber
      })
    }
    return [...m.entries()]
  }, [rows])

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 space-y-4">
      {lanes.map(([sessionName, lane]) => (
        <div key={sessionName}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session</span>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border",
              lane[0]?.isCurrentYear
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-700 border-slate-200",
            )}>
              <span className="font-mono tabular-nums">{sessionName}</span>
              {lane[0]?.isCurrentYear && <span className="text-[9px] font-black">CURRENT</span>}
            </span>
            <span className="text-[10px] text-slate-400 font-mono tabular-nums">{lane.length}</span>
          </div>
          <div className="relative pl-4">
            <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
            <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
              {lane.map((r, i) => {
                const denom = r.subjectsCount
                const num   = denom > 0 ? Math.min(r.resultsEntered, denom) : 0
                const pct   = denom === 0 ? 0 : Math.round((num / denom) * 100)
                const status: StatusFilter = r.publishAt ? "PUBLISHED" : r.isLocked ? "LOCKED" : "DRAFT"
                return (
                  <button key={r.id} onClick={() => onOpen(r.id)}
                    className={cn(
                      "group relative flex-shrink-0 w-[200px] text-left rounded-xl border bg-white p-3 transition-all cursor-pointer hover:shadow-md hover:border-primary/30",
                      r.isFinal ? "border-emerald-300" : "border-slate-200",
                    )}>
                    <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary z-10" />
                    {i < lane.length - 1 && (
                      <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 z-0" />
                    )}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Hash className="w-2.5 h-2.5" />Seq {r.sequenceNumber}
                      </span>
                      {r.isFinal && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Award className="w-2 h-2" /> FINAL
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-slate-800 truncate group-hover:text-primary transition-colors">{r.name}</div>
                    {r.description && (
                      <div className="text-[10px] text-violet-700 truncate mt-0.5">{r.description}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn(
                          "h-full rounded-full",
                          pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-slate-200",
                        )} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[9px] font-bold border", STATUS_META[status].pill)}>
                        <span className={cn("w-1 h-1 rounded-full", STATUS_META[status].dot)} />
                        {STATUS_META[status].label}
                      </span>
                      <span className="text-[9px] text-slate-400">{r.classes.length} cls · {r.subjectsCount} subj</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────

function EmptyState({ onCreate, hasFilter }: { onCreate: () => void; hasFilter: boolean }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
      <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="font-semibold text-sm mb-1">
        {hasFilter ? "No evaluations match these filters" : "No evaluations match these filters"}
      </p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
        {hasFilter
          ? "Try changing the filters above, or create the first evaluation for this faculty."
          : "Create the first evaluation for this faculty + session."}
      </p>
      <Button size="sm" onClick={onCreate} className="gap-1.5 cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> New Evaluation
      </Button>
    </div>
  )
}

// ─── Clone Drawer ───────────────────────────────────────────────────────

function CloneDrawer({
  schoolId, source, academicYears, onClose,
}: {
  schoolId:      string
  source:        EvaluationRow
  academicYears: { id: string; name: string; isCurrent: boolean; facultyId: string | null }[]
  onClose:       () => void
}) {
  const [name, setName] = useState(`${source.name} (Copy)`)
  const [seq,  setSeq]  = useState(source.sequenceNumber + 1)
  const [targetSession, setTargetSession] = useState(source.academicYearId)
  const [isFinal, setIsFinal] = useState(source.isFinal)
  const [pending, startT] = useTransition()

  function handleClone() {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (!targetSession) { toast.error("Pick a target session"); return }
    startT(async () => {
      try {
        await cloneEvaluation({
          schoolId,
          sourceId:          source.id,
          newName:           name.trim(),
          newSequenceNumber: seq,
          academicYearId:    targetSession,
          isFinal,
        })
        toast.success("Evaluation duplicated")
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
              <div className="text-base font-semibold">Duplicate evaluation</div>
              <div className="text-xs text-muted-foreground font-normal">Classes, subjects & components copy across</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Duplicate evaluation</SheetDescription>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50/70 rounded-lg p-3 text-xs text-slate-600">
            <div className="font-bold text-slate-800 mb-1 truncate">Source · {source.name}</div>
            <div className="text-[11px] flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums">{source.academicYearName}</span>
              <span className="text-slate-300">·</span>
              <span>Seq {source.sequenceNumber}</span>
              <span className="text-slate-300">·</span>
              <span>{source.classes.length} class{source.classes.length === 1 ? "" : "es"}</span>
              <span className="text-slate-300">·</span>
              <span>{source.subjectsCount} subj.</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">New name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sequence #</label>
              <Input type="number" min={1} value={seq} onChange={e => setSeq(parseInt(e.target.value, 10) || 1)}
                className="mt-1 h-10 text-sm bg-white border-slate-200 rounded-lg font-mono tabular-nums" />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFinal} onChange={e => setIsFinal(e.target.checked)} className="w-4 h-4 cursor-pointer" />
                <span className="text-xs font-semibold inline-flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-600" /> Mark as final
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target session</label>
            <Select value={targetSession} onValueChange={setTargetSession}>
              <SelectTrigger className="mt-1 h-10 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    <span className="font-mono tabular-nums">{y.name}</span>
                    {y.isCurrent && <span className="text-[10px] text-emerald-600 ml-1.5 font-bold">CURRENT</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>What carries over:</strong> class set, SubjectEvaluations (internal/external max, order),
              and per-subject components (label, marks, source).<br />
              <strong>What does not:</strong> entered marks/results, publish state, lock state, and attendance window —
              the clone is a fresh draft.
            </div>
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
