"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  MoreHorizontal, Edit, Trash2, Users, Star, Search,
  CalendarCheck, CalendarX2, ArrowUp, ArrowDown, ArrowUpDown, Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar-img"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { deleteSubject, setSubjectYearStatus } from "@/actions/academics"
import { SubjectDrawer } from "./subject-drawer"
import { SubjectTeachersDialog } from "./subject-teachers-dialog"

export type SubjectRow = {
  id:                  string
  name:                string
  shortName:           string | null
  code:                string
  classId:             string
  className:           string
  facultyId:           string | null
  facultyName:         string | null
  /** School-wide default CH (set at subject creation). */
  creditHours:         number | null
  internalCreditHours: number | null
  externalCreditHours: number | null
  /** Per-year overrides for the page's edit-context year. Null = no override
   *  stored — resolver falls back to the Subject defaults above. */
  yearCreditHours:         number | null
  yearInternalCreditHours: number | null
  yearExternalCreditHours: number | null
  type:                "REGULAR" | "OPTIONAL" | "EXTRA"
  yearStatuses:        Record<string, boolean>
  assignedTeachers:    { id: string; fullName: string; avatarUrl: string | null; isPrimary: boolean }[]
}

type ClassOpt        = { id: string; name: string; facultyName: string | null; facultyId: string | null }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null }
type SourceClass     = { id: string; name: string; subjects: { id: string; name: string; code: string; creditHours: number | null }[] }
type TeacherOpt      = { id: string; fullName: string; role: string }

interface Props {
  rows:                 SubjectRow[]
  schoolId:             string
  classes:              ClassOpt[]
  academicYears:        AcademicYearOpt[]
  sourceClasses:        SourceClass[]
  teachers:             TeacherOpt[]
  /** When set, the drawer's CH fields edit the per-year override row for
   *  THIS year (via upsertSubjectYearConfig). When null, they edit the
   *  Subject-level defaults instead. */
  editContextYearId:    string | null
  editContextYearName:  string | null
}

export function SubjectsTable({
  rows, schoolId, classes, academicYears, sourceClasses, teachers,
  editContextYearId, editContextYearName,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [pending, startT] = useTransition()
  const [editItem,    setEditItem]    = useState<SubjectRow | null>(null)
  const [teachersFor, setTeachersFor] = useState<SubjectRow | null>(null)

  const sortParam = searchParams.get("sort") ?? ""
  const sortList = parseSort(sortParam)

  function toggleSort(field: string, additive: boolean) {
    const current = sortList.find(s => s.field === field)
    let next: SortItem[]
    if (!current) {
      next = additive ? [...sortList, { field, dir: "asc" }] : [{ field, dir: "asc" }]
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

  function handleDelete(row: SubjectRow) {
    if (!confirm(`Delete subject "${row.name}"?`)) return
    startT(async () => {
      try {
        await deleteSubject(row.id)
        toast.success(`"${row.name}" deleted`)
        router.refresh()
      } catch {
        toast.error("Failed to delete subject")
      }
    })
  }

  if (rows.length === 0) {
    return (
      <>
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-12 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No subjects match</p>
          <p className="text-xs text-muted-foreground">Try a different search or clear the filters.</p>
        </div>
        {editItem && (
          <SubjectDrawer
            schoolId={schoolId}
            classes={classes}
            sourceClasses={sourceClasses}
            editItem={editItem}
            editContextYearId={editContextYearId}
            editContextYearName={editContextYearName}
            open={true}
            onOpenChange={(o) => { if (!o) setEditItem(null) }}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80 backdrop-blur-xl">
              <Th width="w-10">#</Th>
              <Th sortField="code" toggleSort={toggleSort} sortList={sortList} width="w-20">Code</Th>
              <Th sortField="name" toggleSort={toggleSort} sortList={sortList} width="min-w-[220px]">Subject</Th>
              <Th sortField="className" toggleSort={toggleSort} sortList={sortList} width="min-w-[140px]">Class · Faculty</Th>
              <Th width="w-24">Type</Th>
              <Th sortField="credit" toggleSort={toggleSort} sortList={sortList} width="w-16">Credit</Th>
              <Th width="min-w-[200px]">Teachers</Th>
              {academicYears.length > 0 && <Th width="min-w-[180px]">Years Active</Th>}
              <Th width="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="group hover:bg-primary/5 transition-colors">
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle text-[10px] text-slate-400 tabular-nums">{i + 1}</td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <code className="text-[11px] text-slate-700 font-mono">{r.code}</code>
                </td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-800">{r.name}</span>
                    {r.shortName && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                        {r.shortName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {r.className}
                  </span>
                  {r.facultyName && (
                    <span className="text-[10px] text-slate-400 ml-1.5">{r.facultyName}</span>
                  )}
                </td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <SubjectTypeChip type={r.type} />
                </td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  {r.creditHours != null ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-700 font-mono tabular-nums">
                      <Clock className="w-2.5 h-2.5" /> {r.creditHours}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <TeacherStack
                    teachers={r.assignedTeachers}
                    onManage={() => setTeachersFor(r)}
                  />
                </td>
                {academicYears.length > 0 && (
                  <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                    <YearChips
                      years={uniqueByName(academicYears.filter(y =>
                        y.facultyId === r.facultyId && y.isCurrent
                      ))}
                      statuses={r.yearStatuses}
                      subjectId={r.id}
                      pending={pending}
                    />
                  </td>
                )}
                <td className="px-2.5 py-2 border-b border-slate-100 align-middle">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={pending}
                        className="h-7 w-7 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                      <DropdownMenuItem onClick={() => setEditItem(r)} className="cursor-pointer gap-2">
                        <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Subject
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTeachersFor(r)} className="cursor-pointer gap-2">
                        <Users className="w-3.5 h-3.5 text-primary" /> Manage Teachers
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(r)}
                        className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editItem && (
        <SubjectDrawer
          schoolId={schoolId}
          classes={classes}
          sourceClasses={sourceClasses}
          editItem={editItem}
          editContextYearId={editContextYearId}
          editContextYearName={editContextYearName}
          open={true}
          onOpenChange={(o) => { if (!o) setEditItem(null) }}
        />
      )}
      {teachersFor && (
        <SubjectTeachersDialog
          key={teachersFor.id}
          subjectId={teachersFor.id}
          subjectName={teachersFor.name}
          teachers={teachers}
          onClose={() => setTeachersFor(null)}
        />
      )}
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SubjectTypeChip({ type }: { type: SubjectRow["type"] }) {
  const styles = {
    REGULAR:  "bg-slate-50 text-slate-700 border-slate-200",
    OPTIONAL: "bg-violet-50 text-violet-700 border-violet-200",
    EXTRA:    "bg-amber-50 text-amber-700 border-amber-200",
  } as const
  const labels = { REGULAR: "Regular", OPTIONAL: "Optional", EXTRA: "Extra" } as const
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[type]}`}>
      {labels[type]}
    </span>
  )
}

function TeacherStack({
  teachers, onManage,
}: {
  teachers: SubjectRow["assignedTeachers"]
  onManage: () => void
}) {
  if (teachers.length === 0) {
    return (
      <button onClick={onManage}
        className="text-[11px] text-rose-600 hover:underline cursor-pointer flex items-center gap-1">
        <Users className="w-3 h-3" /> No teacher — assign
      </button>
    )
  }
  const primary = teachers.find(t => t.isPrimary)
  const ordered = primary
    ? [primary, ...teachers.filter(t => !t.isPrimary)]
    : teachers
  const shown = ordered.slice(0, 4)
  const extra = ordered.length - shown.length
  return (
    <button onClick={onManage}
      title="Manage teachers"
      className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 -mx-1 px-1 py-0.5 rounded transition-colors">
      <div className="flex -space-x-1.5">
        {shown.map(t => (
          <span key={t.id} className="relative">
            <Avatar name={t.fullName} url={t.avatarUrl} size={22} ring title={t.fullName} />
            {t.isPrimary && (
              <Star className="w-2.5 h-2.5 fill-amber-500 stroke-amber-500 absolute -bottom-0.5 -right-0.5 drop-shadow-sm" />
            )}
          </span>
        ))}
      </div>
      {extra > 0 && <span className="text-[10px] font-bold text-slate-500">+{extra}</span>}
      <span className="text-[10px] text-slate-500 ml-1 hidden md:inline truncate max-w-[120px]">
        {primary?.fullName ?? teachers[0].fullName}
      </span>
    </button>
  )
}

function YearChips({
  years, statuses, subjectId, pending: parentPending,
}: {
  years:     AcademicYearOpt[]
  statuses:  Record<string, boolean>
  subjectId: string
  pending:   boolean
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState(statuses)
  const [pending, startT] = useTransition()

  function toggleYear(yearId: string) {
    if (parentPending) return
    const cur  = optimistic[yearId] ?? true
    const next = !cur
    setOptimistic(prev => ({ ...prev, [yearId]: next }))
    startT(async () => {
      try {
        await setSubjectYearStatus(subjectId, yearId, next)
        router.refresh()
      } catch {
        setOptimistic(prev => ({ ...prev, [yearId]: cur }))
        toast.error("Failed to toggle")
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-1">
      {years.map(y => {
        const isActive = optimistic[y.id] ?? true
        return (
          <button
            key={y.id}
            type="button"
            onClick={() => toggleYear(y.id)}
            disabled={pending || parentPending}
            title={`${y.name} — click to ${isActive ? "disable" : "enable"}`}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer",
              isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200",
              y.isCurrent && isActive && "ring-1 ring-emerald-400",
            )}
          >
            {isActive ? <CalendarCheck className="w-2.5 h-2.5" /> : <CalendarX2 className="w-2.5 h-2.5" />}
            {y.name}
          </button>
        )
      })}
    </div>
  )
}

function Th({
  children, sortField, sortList = [], toggleSort, width,
}: {
  children?:   React.ReactNode
  sortField?:  string
  sortList?:   SortItem[]
  toggleSort?: (field: string, additive: boolean) => void
  width?:      string
}) {
  return (
    <th
      onClick={sortField && toggleSort ? (e) => toggleSort(sortField, e.shiftKey) : undefined}
      className={cn(
        "text-left px-2.5 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap select-none",
        sortField && "cursor-pointer hover:text-slate-800 hover:bg-slate-100/60",
        width,
      )}>
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sortField && <SortIcon field={sortField} sortList={sortList} />}
      </div>
    </th>
  )
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

type SortItem = { field: string; dir: "asc" | "desc" }

function uniqueByName<T extends { name: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of arr) {
    if (seen.has(x.name)) continue
    seen.add(x.name)
    out.push(x)
  }
  return out
}

function parseSort(s: string): SortItem[] {
  if (!s) return []
  return s.split(",").map(part => {
    const [field, dir] = part.split(":")
    return { field, dir: dir === "desc" ? "desc" as const : "asc" as const }
  }).filter(it => !!it.field)
}

