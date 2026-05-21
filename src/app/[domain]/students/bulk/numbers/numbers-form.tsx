"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Hash, FileBadge, GraduationCap, Users, ArrowUpDown,
  AlertTriangle, GripVertical, Check, Loader2, RotateCcw, Info,
} from "lucide-react"
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { bulkAssignNumbers, type AssignField } from "@/actions/students-bulk"

export type SectionOption = { id: string; name: string }
export type ClassOption = { id: string; name: string; facultyName?: string | null; sections: SectionOption[] }
export type StudentOption = {
  id:           string
  name:         string
  admissionNo:  string
  classId:      string
  sectionId:    string | null
  rollNumber:   string | null
  symbolNumber: string | null
  dobBS:        string | null
}

type OrderRule = "nameAsc" | "nameDesc" | "dobAsc" | "current" | "custom"

interface Props {
  schoolId: string
  classes:  ClassOption[]
  students: StudentOption[]
}

const BOARD_GRADE_RE = /\b(9|10|11|12|nine|ten|eleven|twelve)\b/i

export function NumbersForm({ schoolId, classes, students }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [committing, setCommitting] = useState(false)

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [field, setField] = useState<AssignField>("rollNumber")
  const [classId, setClassId] = useState<string>("")
  const [sectionId, setSectionId] = useState<string>("")
  const [order, setOrder] = useState<OrderRule>("nameAsc")
  const [startAt, setStartAt] = useState<string>("1")
  const [prefix, setPrefix] = useState<string>("")
  const [pad, setPad] = useState<string>("2")
  const [customIds, setCustomIds] = useState<string[]>([])

  const cls = classes.find(c => c.id === classId)
  const sections = cls?.sections ?? []
  const isBoardClass = cls ? BOARD_GRADE_RE.test(cls.name) : false

  // ─── Scoped + ordered student list ─────────────────────────────────────────
  const scopedStudents = useMemo<StudentOption[]>(() => {
    if (!classId) return []
    return students.filter(s =>
      s.classId === classId &&
      (sectionId ? s.sectionId === sectionId : true),
    )
  }, [students, classId, sectionId])

  const ordered = useMemo<StudentOption[]>(() => {
    const arr = [...scopedStudents]
    switch (order) {
      case "nameAsc":  arr.sort((a, b) => a.name.localeCompare(b.name)); break
      case "nameDesc": arr.sort((a, b) => b.name.localeCompare(a.name)); break
      case "dobAsc":   arr.sort((a, b) => (a.dobBS ?? "").localeCompare(b.dobBS ?? "")); break
      case "current": {
        const valOf = (s: StudentOption): number => {
          const v = field === "rollNumber" ? s.rollNumber : s.symbolNumber
          const n = v ? parseInt(v.replace(/\D+/g, ""), 10) : NaN
          return Number.isNaN(n) ? 1e9 : n
        }
        arr.sort((a, b) => valOf(a) - valOf(b))
        break
      }
      case "custom": {
        const idx = new Map(customIds.map((id, i) => [id, i]))
        arr.sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999))
        break
      }
    }
    return arr
  }, [scopedStudents, order, field, customIds])

  // When the user enters custom mode, seed the order from whatever is currently shown.
  function pickOrder(next: OrderRule) {
    if (next === "custom" && customIds.length === 0) {
      setCustomIds(ordered.map(s => s.id))
    }
    setOrder(next)
  }

  // ─── Number formatter ──────────────────────────────────────────────────────
  const startNum = Math.max(0, parseInt(startAt, 10) || 0)
  const padN = Math.max(0, Math.min(8, parseInt(pad, 10) || 0))

  function formatN(n: number): string {
    const s = String(n)
    return `${prefix}${padN > 0 ? s.padStart(padN, "0") : s}`
  }

  // ─── Preview rows with diff + conflict detection ───────────────────────────
  type PreviewRow = {
    student:    StudentOption
    oldValue:   string | null
    newValue:   string
    changed:    boolean
    conflict:   string | null   // human-readable description
  }

  const preview = useMemo<PreviewRow[]>(() => {
    const idsBeingAssigned = new Set(ordered.map(s => s.id))

    // Build a map of every IN-SCOPE student NOT being reassigned, by current value,
    // so we can spot would-be collisions in the preview.
    const inScopeOthers = scopedStudents.filter(s => !idsBeingAssigned.has(s.id))
    const otherValueMap = new Map<string, string>()    // value → owner name
    for (const s of inScopeOthers) {
      const v = field === "rollNumber" ? s.rollNumber : s.symbolNumber
      if (v) otherValueMap.set(v.trim().toLowerCase(), s.name)
    }

    // Track new-value duplicates within the batch.
    const newValueCount = new Map<string, number>()
    ordered.forEach((_, i) => {
      const v = formatN(startNum + i).trim().toLowerCase()
      newValueCount.set(v, (newValueCount.get(v) ?? 0) + 1)
    })

    return ordered.map((s, i) => {
      const oldValue = field === "rollNumber" ? s.rollNumber : s.symbolNumber
      const newValue = formatN(startNum + i)
      const lcNew = newValue.trim().toLowerCase()
      let conflict: string | null = null
      if (newValueCount.get(lcNew)! > 1) {
        conflict = "Duplicate of another row in this batch"
      } else if (otherValueMap.has(lcNew)) {
        conflict = `Already held by ${otherValueMap.get(lcNew)} in this class`
      }
      return {
        student:  s,
        oldValue,
        newValue,
        changed:  (oldValue ?? "") !== newValue,
        conflict,
      }
    })
  }, [ordered, scopedStudents, field, startNum, prefix, padN])  // eslint-disable-line react-hooks/exhaustive-deps

  const changedCount  = preview.filter(p => p.changed).length
  const conflictCount = preview.filter(p => p.conflict).length

  // ─── DnD for custom order ──────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = ordered.map(s => s.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    setCustomIds(arrayMove(ids, oldIdx, newIdx))
  }

  // ─── Commit ────────────────────────────────────────────────────────────────
  function reset() {
    setStartAt("1"); setPrefix(""); setPad("2"); setOrder("nameAsc"); setCustomIds([])
  }

  function commit() {
    if (!classId) { toast.error("Pick a class first."); return }
    if (preview.length === 0) { toast.error("No students in this scope."); return }
    if (conflictCount > 0) {
      toast.error(`${conflictCount} conflict${conflictCount === 1 ? "" : "s"} — resolve before committing.`)
      return
    }
    if (changedCount === 0) {
      toast.info("Nothing to change — every student already has these values.")
      return
    }

    setCommitting(true)
    const assignments = preview
      .filter(p => p.changed)
      .map(p => ({ studentId: p.student.id, value: p.newValue }))

    startT(async () => {
      try {
        const res = await bulkAssignNumbers(
          schoolId, classId, sectionId || null, field, assignments,
        )
        if (res.success) {
          toast.success(`Updated ${res.count} student${res.count === 1 ? "" : "s"}`)
          router.refresh()
          router.push("/students")
        } else {
          toast.error(res.error)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Commit failed")
      } finally {
        setCommitting(false)
      }
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Field tabs */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3">
        <div className="grid grid-cols-2 gap-2">
          <FieldTab
            active={field === "rollNumber"}
            onClick={() => setField("rollNumber")}
            icon={Hash}
            title="Roll Numbers"
            subtitle="Class register order"
          />
          <FieldTab
            active={field === "symbolNumber"}
            onClick={() => setField("symbolNumber")}
            icon={FileBadge}
            title="Symbol Numbers"
            subtitle="SEE / NEB board exam IDs"
          />
        </div>
        {field === "symbolNumber" && classId && !isBoardClass && (
          <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Symbol numbers are normally only used for board exams (SEE / NEB). The selected class
              <strong> {cls?.name}</strong> doesn&apos;t look like a board class — you can still
              assign, but double-check first.
            </span>
          </div>
        )}
      </div>

      {/* Scope + rule */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 space-y-4">
        <SectionLabel>1. Scope</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledControl icon={GraduationCap} label="Class">
            <Select value={classId} onValueChange={v => { setClassId(v); setSectionId(""); setCustomIds([]) }}>
              <SelectTrigger className="h-10 bg-white text-sm"><SelectValue placeholder="Select class…" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.facultyName && <span className="ml-2 text-[10px] text-slate-400">{c.facultyName}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledControl>
          <LabeledControl icon={Users} label="Section (optional)">
            <Select
              value={sectionId || "ALL"}
              onValueChange={v => { setSectionId(v === "ALL" ? "" : v); setCustomIds([]) }}
              disabled={!classId || sections.length === 0}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder={sections.length ? "All sections" : "—"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sections in this class</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </LabeledControl>
        </div>

        <SectionLabel>2. Order</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledControl icon={ArrowUpDown} label="Sort by">
            <Select value={order} onValueChange={v => pickOrder(v as OrderRule)} disabled={!classId}>
              <SelectTrigger className="h-10 bg-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nameAsc">Name A → Z</SelectItem>
                <SelectItem value="nameDesc">Name Z → A</SelectItem>
                <SelectItem value="dobAsc">Date of birth (oldest first)</SelectItem>
                <SelectItem value="current">Current {field === "rollNumber" ? "roll" : "symbol"} number</SelectItem>
                <SelectItem value="custom">Custom (drag rows below)</SelectItem>
              </SelectContent>
            </Select>
          </LabeledControl>
        </div>

        <SectionLabel>3. Number format</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LabeledControl label="Start at">
            <Input type="number" min="0" value={startAt} onChange={e => setStartAt(e.target.value)}
              className="h-10 bg-white text-sm font-mono" disabled={!classId} />
          </LabeledControl>
          <LabeledControl label="Prefix (optional)">
            <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="e.g. SEE-"
              className="h-10 bg-white text-sm font-mono" disabled={!classId} />
          </LabeledControl>
          <LabeledControl label="Zero-pad digits">
            <Input type="number" min="0" max="8" value={pad} onChange={e => setPad(e.target.value)}
              className="h-10 bg-white text-sm font-mono" disabled={!classId} />
          </LabeledControl>
        </div>

        {classId && (
          <div className="bg-slate-50/80 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>
              First student becomes <code className="font-mono font-bold text-slate-800">{formatN(startNum)}</code>,
              then <code className="font-mono font-bold text-slate-800">{formatN(startNum + 1)}</code>,
              <code className="font-mono font-bold text-slate-800"> {formatN(startNum + 2)}</code>, …
            </span>
          </div>
        )}
      </div>

      {/* Preview table */}
      {classId && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-sm">Preview</h3>
            <span className="text-xs text-muted-foreground">
              {preview.length} student{preview.length === 1 ? "" : "s"} in scope
            </span>
            <div className="flex-1" />
            <Pill color={changedCount > 0 ? "amber" : "slate"}>
              {changedCount} change{changedCount === 1 ? "" : "s"}
            </Pill>
            {conflictCount > 0 && (
              <Pill color="rose">
                {conflictCount} conflict{conflictCount === 1 ? "" : "s"}
              </Pill>
            )}
          </div>

          {preview.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No students in this scope.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50/80 backdrop-blur-xl sticky top-0 z-10">
                    <tr>
                      <th className="w-8 px-2 py-2 border-b border-slate-200" />
                      <th className="w-10 text-right px-2 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">#</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Name</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden sm:table-cell">Adm No</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Current</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">→ New</th>
                      <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SortableContext
                      items={ordered.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                      disabled={order !== "custom"}
                    >
                      {preview.map((p, i) => (
                        <PreviewTr key={p.student.id} row={p} index={i + 1} draggable={order === "custom"} />
                      ))}
                    </SortableContext>
                  </tbody>
                </table>
              </div>
            </DndContext>
          )}
        </div>
      )}

      {/* Bottom action bar */}
      {classId && preview.length > 0 && (
        <div className="sticky bottom-4 bg-white/90 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 flex-wrap">
          <div className="text-xs text-slate-600">
            <strong className="text-slate-900">{changedCount}</strong> change{changedCount === 1 ? "" : "s"} ready
            {conflictCount > 0 && (
              <span className="text-rose-600 ml-2 font-medium">
                · {conflictCount} blocking conflict{conflictCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 cursor-pointer text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={commit}
            disabled={committing || conflictCount > 0 || changedCount === 0}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold"
          >
            {committing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />}
            Commit {changedCount} change{changedCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldTab({
  active, onClick, icon: Icon, title, subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border p-3 transition-all cursor-pointer",
        active
          ? "bg-primary/5 border-primary/40 ring-2 ring-primary/15 shadow-sm"
          : "bg-white border-slate-200 hover:border-primary/30 hover:bg-slate-50",
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          active ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-500",
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className={cn("text-sm font-bold", active ? "text-primary" : "text-slate-800")}>{title}</div>
          <div className="text-[10px] text-slate-500">{subtitle}</div>
        </div>
      </div>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{children}</p>
  )
}

function LabeledControl({
  icon: Icon, label, children,
}: {
  icon?: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      {children}
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: "amber" | "rose" | "slate" }) {
  const cls =
    color === "amber" ? "bg-amber-50 text-amber-700 border-amber-200" :
    color === "rose"  ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-slate-50 text-slate-600 border-slate-200"
  return (
    <span className={cn("text-[10px] font-bold border rounded-full px-2.5 py-0.5", cls)}>
      {children}
    </span>
  )
}

function PreviewTr({
  row, index, draggable,
}: {
  row: { student: StudentOption; oldValue: string | null; newValue: string; changed: boolean; conflict: string | null }
  index: number
  draggable: boolean
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.student.id })

  const style: React.CSSProperties = draggable
    ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
    : {}

  return (
    <tr
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={cn(
        "border-b border-slate-100 last:border-0",
        row.conflict ? "bg-rose-50/40" :
        row.changed  ? "bg-amber-50/30" :
                       "bg-white",
      )}
    >
      <td className="w-8 px-2 py-2 align-middle">
        {draggable ? (
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-primary">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </td>
      <td className="w-10 px-2 py-2 text-right text-[10px] tabular-nums text-slate-400">{index}</td>
      <td className="px-3 py-2 font-medium text-slate-800">{row.student.name}</td>
      <td className="px-3 py-2 text-[11px] text-slate-500 font-mono hidden sm:table-cell">{row.student.admissionNo}</td>
      <td className="px-3 py-2 font-mono">
        {row.oldValue ? (
          <span className="text-slate-500">{row.oldValue}</span>
        ) : (
          <span className="text-slate-300 italic text-[10px]">—</span>
        )}
      </td>
      <td className="px-3 py-2 font-mono">
        <span className={cn(
          "inline-block px-2 py-0.5 rounded",
          row.conflict ? "bg-rose-100 text-rose-700" :
          row.changed  ? "bg-amber-100 text-amber-800 font-bold" :
                         "text-slate-400",
        )}>
          {row.newValue}
        </span>
      </td>
      <td className="px-3 py-2 text-[11px]">
        {row.conflict ? (
          <span className="text-rose-700 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {row.conflict}
          </span>
        ) : row.changed ? (
          <span className="text-amber-700">Will change</span>
        ) : (
          <span className="text-slate-300 italic">No change</span>
        )}
      </td>
    </tr>
  )
}
