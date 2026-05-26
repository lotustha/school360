"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, X, GraduationCap, ArrowRight, Users as UsersIcon, UserCog, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ClassCard } from "./page"

type SortKey = "name" | "outstanding" | "students" | "pct"

interface Props {
  cards:     ClassCard[]
  faculties: Array<{ id: string; name: string }>
}

export function ClassesClient({ cards, faculties }: Props) {
  const [q, setQ]               = useState("")
  const [faculty, setFaculty]   = useState("")  // empty = all
  const [withOutstandingOnly, setWithOutstanding] = useState(false)
  const [sort, setSort]         = useState<SortKey>("name")

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = cards.filter(c => {
      if (faculty === "_none" && c.facultyName) return false
      if (faculty && faculty !== "_none" && c.facultyName !== facultyNameOf(faculties, faculty)) return false
      if (withOutstandingOnly && c.outstanding <= 0) return false
      if (query) {
        const hay = `${c.name} ${c.facultyName ?? ""} ${c.classTeacher ?? ""}`.toLowerCase()
        if (!hay.includes(query)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "outstanding": return b.outstanding - a.outstanding
        case "students":    return b.studentCount - a.studentCount
        case "pct":         return b.pct - a.pct
        case "name":
        default:            return a.name.localeCompare(b.name, undefined, { numeric: true })
      }
    })
    return list
  }, [cards, q, faculty, withOutstandingOnly, sort, faculties])

  const hasFilter = !!q || !!faculty || withOutstandingOnly

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search class, faculty, or teacher…"
            className="pl-10 pr-9 h-10"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={faculty}
          onChange={e => setFaculty(e.target.value)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer min-w-[150px]"
        >
          <option value="">All faculties</option>
          {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          <option value="_none">General</option>
        </select>

        <button
          type="button"
          onClick={() => setWithOutstanding(v => !v)}
          className={cn(
            "h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer transition inline-flex items-center gap-1.5",
            withOutstandingOnly ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white/75 border-slate-200 text-slate-600 hover:border-slate-300",
          )}
        >
          <Filter className="w-3 h-3" />
          {withOutstandingOnly ? "Only outstanding" : "Include caught-up"}
        </button>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
        >
          <option value="name">Sort: Name</option>
          <option value="outstanding">Sort: Highest outstanding</option>
          <option value="students">Sort: Most students</option>
          <option value="pct">Sort: Best collection %</option>
        </select>

        {hasFilter && (
          <button
            type="button"
            onClick={() => { setQ(""); setFaculty(""); setWithOutstanding(false) }}
            className="h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset
          </button>
        )}

        <span className="ml-auto text-[10px] uppercase tracking-widest font-black text-slate-400">
          {filtered.length} of {cards.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No classes match the filters.</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing the filters or searching a different term.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => <ClassCardView key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

function facultyNameOf(faculties: Array<{ id: string; name: string }>, id: string): string | null {
  return faculties.find(f => f.id === id)?.name ?? null
}

function ClassCardView({ c }: { c: ClassCard }) {
  const overdueLooking = c.outstanding > 0
  const billed = c.billed
  return (
    <Link href={`/finance/classes/${c.id}`} className="block group">
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/8 transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1 mr-2">
            <p className="text-base font-bold truncate group-hover:text-primary transition-colors">{c.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {c.facultyName && (
                <span className="text-[9px] uppercase tracking-widest font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{c.facultyName}</span>
              )}
              <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                <UsersIcon className="w-2.5 h-2.5" />
                {c.studentCount}
              </span>
            </div>
            {c.classTeacher && (
              <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1 truncate">
                <UserCog className="w-3 h-3 text-slate-400 flex-shrink-0" />
                {c.classTeacher}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* Collection progress bar */}
        {billed > 0 && (
          <div className="mb-3">
            <div className="flex items-baseline justify-between text-[10px] mb-1">
              <span className="uppercase tracking-widest font-black text-slate-400">Collection</span>
              <span className={cn("font-mono tabular-nums font-bold", c.pct >= 80 ? "text-emerald-700" : c.pct >= 50 ? "text-amber-700" : "text-rose-700")}>{c.pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  c.pct >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : c.pct >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-rose-400 to-rose-500",
                )}
                style={{ width: `${Math.min(100, c.pct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-slate-100">
          <Stat label="Billed"      value={fmt(c.billed)}      tone="slate" />
          <Stat label="Paid"        value={fmt(c.paid)}        tone="emerald" />
          <Stat label="Outstanding" value={fmt(c.outstanding)} tone={overdueLooking ? "rose" : "emerald"} />
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition mt-3 self-end" />
      </div>
    </Link>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" }) {
  const cls = {
    slate:   "text-slate-700",
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
  }[tone]
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      <p className={cn("text-xs font-bold font-mono tabular-nums mt-0.5", cls)}>{value}</p>
    </div>
  )
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0"
  if (n >= 100000) return `${(n / 1000).toFixed(0)}k`
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}
