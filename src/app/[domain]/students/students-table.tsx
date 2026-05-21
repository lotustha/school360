"use client"

import Link from "next/link"
import { useTransition, useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  MoreHorizontal, Eye, UserX, ShieldCheck, BadgeCheck, Phone,
  ArrowUp, ArrowDown, ArrowUpDown, Search, Accessibility, HeartHandshake,
  GripVertical,
} from "lucide-react"
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, horizontalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar-img"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { updateStudentStatus } from "@/actions/students"

export type StudentRow = {
  id:                string
  admissionNo:       string
  rollNumber:        string | null
  name:              string
  avatarUrl:         string | null
  fullNameNepali:    string | null
  email:             string
  className:         string
  sectionName:       string | null
  gender:            string
  status:            string
  nebRegistrationNo: string | null
  symbolNumber:      string | null
  dobBS:             string | null
  disabilityStatus:  string | null
  scholarshipType:   string | null
  guardian:          string | null
  guardianPhone:     string | null
  guardianRelation:  string | null
}

export type ColumnKey =
  | "index" | "admissionNo" | "name" | "rollNumber" | "classSection"
  | "gender" | "dob" | "guardian" | "phone" | "email"
  | "nebReg" | "symbolNo" | "indicators" | "status" | "actions"

type ColumnDef = {
  key:             ColumnKey
  label:           string
  sortField?:      string
  defaultVisible:  boolean
  sticky?:         boolean
  width?:          string
  reorderable?:    boolean
}

export const COLUMNS: ColumnDef[] = [
  { key: "index",        label: "#",            defaultVisible: true,  sticky: true,  width: "w-10",            reorderable: false },
  { key: "admissionNo",  label: "Adm No",       sortField: "admissionNo",       defaultVisible: true,  sticky: true,  width: "min-w-[110px]", reorderable: false },
  { key: "name",         label: "Name",         sortField: "name",              defaultVisible: true,  sticky: true,  width: "min-w-[180px]", reorderable: false },
  { key: "rollNumber",   label: "Roll",         sortField: "rollNumber",        defaultVisible: true,  width: "w-16" },
  { key: "classSection", label: "Class · Sec",  sortField: "className",         defaultVisible: true,  width: "min-w-[130px]" },
  { key: "gender",       label: "Gender",       sortField: "gender",            defaultVisible: true,  width: "w-20" },
  { key: "dob",          label: "DOB (BS)",     defaultVisible: false, width: "w-24" },
  { key: "guardian",     label: "Guardian",     defaultVisible: true,  width: "min-w-[140px]" },
  { key: "phone",        label: "Phone",        defaultVisible: true,  width: "min-w-[120px]" },
  { key: "email",        label: "Email",        defaultVisible: false, width: "min-w-[180px]" },
  { key: "nebReg",       label: "NEB Reg",      sortField: "nebRegistrationNo", defaultVisible: false, width: "min-w-[130px]" },
  { key: "symbolNo",     label: "Symbol No",    sortField: "symbolNumber",      defaultVisible: false, width: "min-w-[110px]" },
  { key: "indicators",   label: "Flags",        defaultVisible: true,  width: "w-20" },
  { key: "status",       label: "Status",       sortField: "status",            defaultVisible: true,  width: "w-24" },
  { key: "actions",      label: "",             defaultVisible: true,  width: "w-10",            reorderable: false },
]
export const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map(c => [c.key, c])) as Record<ColumnKey, ColumnDef>

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LEFT:      { label: "Left",      cls: "bg-slate-50 text-slate-600 border-slate-200" },
  GRADUATED: { label: "Graduated", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SUSPENDED: { label: "Suspended", cls: "bg-rose-50 text-rose-700 border-rose-200" },
}

interface Props {
  schoolId:    string
  rows:        StudentRow[]
  columnOrder: ColumnKey[]
  onReorder:   (next: ColumnKey[]) => void
  pageOffset:  number
}

export function StudentsTable({ schoolId, rows, columnOrder, onReorder, pageOffset }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startT] = useTransition()

  const sortParam = searchParams.get("sort") ?? ""
  const sortList = parseSort(sortParam)

  function toggleSort(field: string, additive: boolean) {
    const current = sortList.find(s => s.field === field)
    let next: SortItem[]
    if (!current) {
      const newItem: SortItem = { field, dir: "asc" }
      next = additive ? [...sortList, newItem] : [newItem]
    } else if (current.dir === "asc") {
      next = sortList.map(s => s.field === field ? { ...s, dir: "desc" as const } : s)
    } else {
      next = sortList.filter(s => s.field !== field)
    }
    const params = new URLSearchParams(searchParams.toString())
    if (next.length === 0) params.delete("sort")
    else                   params.set("sort", next.map(s => `${s.field}:${s.dir}`).join(","))
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  function changeStatus(id: string, status: "ACTIVE" | "LEFT" | "GRADUATED" | "SUSPENDED") {
    startT(async () => {
      try {
        await updateStudentStatus(schoolId, id, status)
        toast.success(`Marked as ${status.toLowerCase()}`)
        router.refresh()
      } catch {
        toast.error("Failed to update status")
      }
    })
  }

  // Drag-reorder setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const reorderableKeys = columnOrder.filter(k => COLUMN_BY_KEY[k].reorderable !== false)

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = columnOrder.indexOf(active.id as ColumnKey)
    const newIdx = columnOrder.indexOf(over.id as ColumnKey)
    if (oldIdx < 0 || newIdx < 0) return
    onReorder(arrayMove(columnOrder, oldIdx, newIdx))
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-12 text-center">
        <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No students match</p>
        <p className="text-xs text-muted-foreground">Try a different search or clear filters.</p>
      </div>
    )
  }

  // Resolve each rendered column's sticky-left offset based on actual order
  const stickyLefts = computeStickyLefts(columnOrder)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-xl">
              <SortableContext items={reorderableKeys} strategy={horizontalListSortingStrategy}>
                {columnOrder.map(k => {
                  const col = COLUMN_BY_KEY[k]
                  return col.reorderable === false
                    ? <FixedTh key={k} col={col} sortList={sortList} toggleSort={toggleSort} stickyLeft={stickyLefts[k]} />
                    : <SortableTh key={k} col={col} sortList={sortList} toggleSort={toggleSort} />
                })}
              </SortableContext>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const status = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.ACTIVE
              return (
                <tr key={s.id} className="group hover:bg-primary/5 transition-colors">
                  {columnOrder.map(k => {
                    const col = COLUMN_BY_KEY[k]
                    return (
                      <td key={k}
                        className={cn(
                          "px-2.5 py-2 border-b border-slate-100 align-middle whitespace-nowrap",
                          col.sticky && "sticky bg-white/95 group-hover:bg-primary/5 backdrop-blur-xl z-10",
                        )}
                        style={col.sticky ? { left: stickyLefts[k] } : undefined}
                      >
                        {renderCell(k, s, i + pageOffset + 1, status, pending, changeStatus)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}

// ─── Header components ───────────────────────────────────────────────────────

function FixedTh({
  col, sortList, toggleSort, stickyLeft,
}: {
  col:        ColumnDef
  sortList:   SortItem[]
  toggleSort: (field: string, additive: boolean) => void
  stickyLeft?: string
}) {
  return (
    <th
      onClick={col.sortField ? (e) => toggleSort(col.sortField!, e.shiftKey) : undefined}
      className={cn(
        "text-left px-2.5 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap select-none",
        col.sortField && "cursor-pointer hover:text-slate-800 hover:bg-slate-100/60",
        col.sticky && "sticky bg-slate-50/80 backdrop-blur-xl z-20",
        col.width,
      )}
      style={col.sticky ? { left: stickyLeft } : undefined}
    >
      <div className="flex items-center gap-1">
        <span>{col.label}</span>
        {col.sortField && <SortIcon field={col.sortField} sortList={sortList} />}
      </div>
    </th>
  )
}

function SortableTh({
  col, sortList, toggleSort,
}: {
  col:        ColumnDef
  sortList:   SortItem[]
  toggleSort: (field: string, additive: boolean) => void
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: col.key })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 30 : undefined,
  }

  return (
    <th ref={setNodeRef} style={style}
      onClick={col.sortField ? (e) => toggleSort(col.sortField!, e.shiftKey) : undefined}
      className={cn(
        "group/th text-left px-2.5 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap select-none",
        col.sortField && "cursor-pointer hover:text-slate-800 hover:bg-slate-100/60",
        col.width,
      )}>
      <div className="flex items-center gap-1">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary opacity-0 group-hover/th:opacity-100 transition-opacity flex-shrink-0">
          <GripVertical className="w-3 h-3" />
        </button>
        <span>{col.label}</span>
        {col.sortField && <SortIcon field={col.sortField} sortList={sortList} />}
      </div>
    </th>
  )
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function renderCell(
  key:    ColumnKey,
  s:      StudentRow,
  index:  number,
  status: { label: string; cls: string },
  pending: boolean,
  changeStatus: (id: string, status: "ACTIVE" | "LEFT" | "GRADUATED" | "SUSPENDED") => void,
) {
  switch (key) {
    case "index":
      return <span className="text-[10px] text-slate-400 tabular-nums">{index}</span>
    case "admissionNo":
      return <code className="text-[11px] text-slate-700 font-mono">{s.admissionNo}</code>
    case "name":
      return (
        <Link href={`/students/${s.id}`}
          className="flex items-center gap-2 font-semibold text-slate-800 hover:text-primary transition-colors">
          <Avatar name={s.name} url={s.avatarUrl} size={24} />
          <span className="min-w-0">
            <span className="block truncate">{s.name}</span>
            {s.fullNameNepali && <span className="block text-[10px] text-slate-500 font-medium truncate">{s.fullNameNepali}</span>}
          </span>
        </Link>
      )
    case "rollNumber":
      return s.rollNumber ? <span className="text-slate-700 tabular-nums">{s.rollNumber}</span> : <span className="text-slate-300">—</span>
    case "classSection":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {s.className}{s.sectionName && <span className="opacity-70"> · {s.sectionName}</span>}
        </span>
      )
    case "gender":
      return <span className="text-slate-600">{s.gender}</span>
    case "dob":
      return s.dobBS ? <span className="text-slate-600 tabular-nums">{s.dobBS}</span> : <span className="text-slate-300">—</span>
    case "guardian":
      return s.guardian ? (
        <span>
          {s.guardian}
          {s.guardianRelation && <span className="text-[10px] text-slate-400 ml-1">({s.guardianRelation})</span>}
        </span>
      ) : <span className="text-slate-300">—</span>
    case "phone":
      return s.guardianPhone ? (
        <a href={`tel:${s.guardianPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <Phone className="w-2.5 h-2.5" /> {s.guardianPhone}
        </a>
      ) : <span className="text-slate-300">—</span>
    case "email":
      return <span className="text-slate-600 truncate block max-w-[180px]">{s.email}</span>
    case "nebReg":
      return s.nebRegistrationNo ? <code className="text-[10px] font-mono text-slate-600">{s.nebRegistrationNo}</code> : <span className="text-slate-300">—</span>
    case "symbolNo":
      return s.symbolNumber ? <code className="text-[10px] font-mono text-slate-600">{s.symbolNumber}</code> : <span className="text-slate-300">—</span>
    case "indicators":
      return (
        <div className="flex items-center gap-1">
          {s.disabilityStatus && s.disabilityStatus !== "NONE" && (
            <span title={`Disability: ${s.disabilityStatus}`}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <Accessibility className="w-2.5 h-2.5" />
            </span>
          )}
          {s.scholarshipType && s.scholarshipType !== "NONE" && (
            <span title={`Scholarship: ${s.scholarshipType}`}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              <HeartHandshake className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      )
    case "status":
      return <Badge className={cn("text-[10px] font-bold border", status.cls)}>{status.label}</Badge>
    case "actions":
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={pending}
              className="h-7 w-7 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href={`/students/${s.id}`}>
                <Eye className="w-3.5 h-3.5 text-slate-500" /> View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {s.status !== "ACTIVE" && (
              <DropdownMenuItem onClick={() => changeStatus(s.id, "ACTIVE")} className="cursor-pointer gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Mark Active
              </DropdownMenuItem>
            )}
            {s.status !== "GRADUATED" && (
              <DropdownMenuItem onClick={() => changeStatus(s.id, "GRADUATED")} className="cursor-pointer gap-2">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-600" /> Mark Graduated
              </DropdownMenuItem>
            )}
            {s.status !== "LEFT" && (
              <DropdownMenuItem onClick={() => changeStatus(s.id, "LEFT")} className="cursor-pointer gap-2">
                <UserX className="w-3.5 h-3.5 text-slate-500" /> Mark Left
              </DropdownMenuItem>
            )}
            {s.status !== "SUSPENDED" && (
              <DropdownMenuItem onClick={() => changeStatus(s.id, "SUSPENDED")} className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                <UserX className="w-3.5 h-3.5" /> Suspend
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SortItem = { field: string; dir: "asc" | "desc" }

export function parseSort(s: string): SortItem[] {
  if (!s) return []
  return s.split(",").map(part => {
    const [field, dir] = part.split(":")
    return { field, dir: dir === "desc" ? "desc" as const : "asc" as const }
  }).filter(it => !!it.field)
}

function SortIcon({ field, sortList }: { field: string; sortList: SortItem[] }) {
  const idx  = sortList.findIndex(s => s.field === field)
  const item = sortList[idx]
  if (!item) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
  return (
    <span className="inline-flex items-center gap-0.5 text-primary">
      {item.dir === "asc" ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {sortList.length > 1 && <span className="text-[9px] font-black tabular-nums">{idx + 1}</span>}
    </span>
  )
}

function stickyWidthPx(key: ColumnKey): number {
  switch (key) {
    case "index":       return 40
    case "admissionNo": return 110
    case "name":        return 220
    default:            return 0
  }
}

// Pre-compute sticky-left offsets in order. We only walk leading sticky cols.
function computeStickyLefts(columnOrder: ColumnKey[]): Partial<Record<ColumnKey, string>> {
  const out: Partial<Record<ColumnKey, string>> = {}
  let px = 0
  for (const k of columnOrder) {
    const c = COLUMN_BY_KEY[k]
    if (!c.sticky) break
    out[k] = `${px}px`
    px += stickyWidthPx(k)
  }
  return out
}

// ─── Column preferences hook (visibility + order combined) ───────────────────

export const STORAGE_COLS_KEY = "school360.students.cols"

export function useColumnOrder(): [ColumnKey[], (keys: ColumnKey[]) => void] {
  const initial = COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
  const [order, setOrder] = useState<ColumnKey[]>(initial)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_COLS_KEY)
      if (!raw) return
      const arr = JSON.parse(raw) as ColumnKey[]
      if (!Array.isArray(arr) || arr.length === 0) return
      // Validate and migrate: drop unknown keys, append any newly-introduced
      // default-visible keys that the persisted set doesn't yet know about.
      const known = new Set(COLUMNS.map(c => c.key))
      const filtered = arr.filter(k => known.has(k))
      const seen = new Set(filtered)
      const appended = COLUMNS
        .filter(c => c.defaultVisible && !seen.has(c.key))
        .map(c => c.key)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrder([...filtered, ...appended])
    } catch { /* ignore */ }
  }, [])
  function update(next: ColumnKey[]) {
    setOrder(next)
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_COLS_KEY, JSON.stringify(next)) } catch {}
    }
  }
  return [order, update]
}
