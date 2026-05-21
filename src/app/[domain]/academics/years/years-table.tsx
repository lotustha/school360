"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  MoreHorizontal, Edit, Trash, Star, CalendarRange, FolderTree, Building2,
  Users, GraduationCap, ClipboardList, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  setCurrentAcademicYear, deleteAcademicYear,
  type AcademicYearWithFaculty,
} from "@/actions/academic-years"
import { formatBS } from "@/lib/nepali-date"
import { YearDrawer } from "./year-drawer"
import { groupYearsByFaculty } from "@/lib/academic-year"

interface Props {
  schoolId:  string
  years:     AcademicYearWithFaculty[]
  faculties: { id: string; name: string }[]
}

export function YearsTable({ schoolId, years, faculties }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [editItem, setEditItem] = useState<AcademicYearWithFaculty | null>(null)

  const groups = groupYearsByFaculty(years, faculties)

  function handleSetCurrent(row: AcademicYearWithFaculty) {
    if (row.isCurrent) return
    startT(async () => {
      try {
        await setCurrentAcademicYear(row.id)
        toast.success(`"${row.name}" set as current`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      }
    })
  }

  function handleDelete(row: AcademicYearWithFaculty) {
    const used = row._counts.students + row._counts.exams + row._counts.evaluations
    if (used > 0) {
      if (!confirm(
        `"${row.name}" is referenced by ${row._counts.students} student(s), ${row._counts.exams} exam(s), ${row._counts.evaluations} evaluation(s). The delete will be refused.\n\nProceed anyway?`,
      )) return
    } else if (!confirm(`Delete session "${row.name}"?`)) return
    startT(async () => {
      try {
        await deleteAcademicYear(row.id)
        toast.success(`Deleted "${row.name}"`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete")
      }
    })
  }

  if (years.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-dashed border-slate-200 p-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 mx-auto mb-4 flex items-center justify-center">
          <CalendarRange className="w-7 h-7 text-amber-500" />
        </div>
        <p className="font-bold text-base mb-1.5 text-slate-800">No sessions yet</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Click <strong className="text-slate-700">Add Session</strong> to create one — pick one or more
          faculties (or School-wide) and one row is created per scope.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map(g => {
          const currentY = g.years.find(y => y.isCurrent)
          const past = g.years.filter(y => !y.isCurrent)
          return (
            <section
              key={g.facultyId ?? "_"}
              className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden"
            >
              {/* Group header */}
              <header className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/80">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                  g.facultyId ? "bg-violet-50" : "bg-slate-100",
                )}>
                  {g.facultyId
                    ? <FolderTree className="w-4 h-4 text-violet-600" />
                    : <Building2 className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-slate-800">{g.facultyName}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {g.years.length} session{g.years.length === 1 ? "" : "s"}
                    {currentY && <> · current: <span className="font-mono text-slate-600">{currentY.name}</span></>}
                  </p>
                </div>
              </header>

              {/* Current session — full bleed amber card */}
              {currentY && (
                <SessionRow
                  year={currentY}
                  prominent
                  pending={pending}
                  onEdit={() => setEditItem(currentY)}
                  onDelete={() => handleDelete(currentY)}
                  onSetCurrent={() => handleSetCurrent(currentY)}
                />
              )}

              {/* Past sessions */}
              {past.length > 0 && (
                <div className="border-t border-slate-100">
                  {past.map(y => (
                    <SessionRow
                      key={y.id}
                      year={y}
                      pending={pending}
                      onEdit={() => setEditItem(y)}
                      onDelete={() => handleDelete(y)}
                      onSetCurrent={() => handleSetCurrent(y)}
                    />
                  ))}
                </div>
              )}

              {!currentY && past.length === 0 && (
                <div className="px-5 py-6 text-center text-xs text-slate-400">
                  No sessions in this scope.
                </div>
              )}
            </section>
          )
        })}
      </div>

      {editItem && (
        <YearDrawer
          schoolId={schoolId}
          faculties={faculties}
          editItem={{
            id:          editItem.id,
            name:        editItem.name,
            facultyId:   editItem.facultyId,
            startDateBS: editItem.startDateBS,
            endDateBS:   editItem.endDateBS,
            isCurrent:   editItem.isCurrent,
          }}
          open={true}
          onOpenChange={(o) => { if (!o) setEditItem(null) }}
        />
      )}
    </>
  )
}

// ─── Session row ────────────────────────────────────────────────────────────

function SessionRow({
  year, prominent = false, pending, onEdit, onDelete, onSetCurrent,
}: {
  year:         AcademicYearWithFaculty
  prominent?:   boolean
  pending:      boolean
  onEdit:       () => void
  onDelete:     () => void
  onSetCurrent: () => void
}) {
  const used = year._counts.students + year._counts.exams + year._counts.evaluations
  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-5 py-3 transition-colors",
        prominent
          ? "bg-gradient-to-r from-amber-50/70 via-amber-50/30 to-white border-y border-amber-100/70"
          : "hover:bg-slate-50/60 border-b border-slate-100 last:border-b-0",
      )}
    >
      {/* Name + range */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <code className={cn(
          "font-mono font-black tabular-nums tracking-tight",
          prominent ? "text-base text-amber-800" : "text-sm text-slate-700",
        )}>
          {year.name}
        </code>
        <span className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 font-medium">
          {tryFormatBS(year.startDateBS)}
          <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
          {tryFormatBS(year.endDateBS)}
        </span>
      </div>

      {/* Usage chips */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <UsageChip n={year._counts.students}    icon={<Users         className="w-2.5 h-2.5" />} />
        <UsageChip n={year._counts.exams}       icon={<GraduationCap className="w-2.5 h-2.5" />} />
        <UsageChip n={year._counts.evaluations} icon={<ClipboardList className="w-2.5 h-2.5" />} />
        {used === 0 && (
          <span className="text-[10px] text-slate-300 italic px-1">unused</span>
        )}
      </div>

      {/* Status pill */}
      {prominent ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-amber-500/30">
          <Star className="w-2.5 h-2.5 fill-white stroke-white" />
          Current
        </span>
      ) : (
        <button
          onClick={onSetCurrent}
          disabled={pending}
          className="text-[10px] text-slate-400 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-md font-semibold cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-amber-200"
        >
          Make current
        </button>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            className={cn(
              "h-7 w-7 cursor-pointer transition-opacity",
              prominent ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer gap-2">
            <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit
          </DropdownMenuItem>
          {!year.isCurrent && (
            <DropdownMenuItem onClick={onSetCurrent} className="cursor-pointer gap-2">
              <Star className="w-3.5 h-3.5 text-amber-500" /> Mark current
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2"
          >
            <Trash className="w-3.5 h-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function UsageChip({ n, icon }: { n: number; icon: React.ReactNode }) {
  if (n === 0) return null
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tabular-nums"
      title={`${n}`}
    >
      {icon}
      {n}
    </span>
  )
}

function tryFormatBS(bs: string): string {
  try { return formatBS(bs) } catch { return bs }
}
