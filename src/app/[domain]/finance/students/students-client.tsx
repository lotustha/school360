"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, X, GraduationCap, UserRound, Hash, BadgeCheck, Loader2, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { searchStudents, type StudentSearchRow } from "@/actions/accounting/fee-payments"

interface ClassOpt { id: string; name: string; facultyName: string | null }
interface FacultyOpt { id: string; name: string }

export function StudentsClient({
  classes, faculties, recent,
}: {
  classes:   ClassOpt[]
  faculties: FacultyOpt[]
  recent:    StudentSearchRow[]
}) {
  const [q, setQ]                 = useState("")
  const [classId, setClassId]     = useState("")
  const [facultyId, setFacultyId] = useState("")
  const [results, setResults]     = useState<StudentSearchRow[]>([])
  const [loading, setLoading]     = useState(false)

  // Filter classes by selected faculty (and reset class if it leaves the faculty)
  const classOptions = useMemo(() => {
    if (!facultyId) return classes
    const fac = faculties.find(f => f.id === facultyId)
    if (!fac) return classes
    return classes.filter(c => c.facultyName === fac.name)
  }, [classes, faculties, facultyId])

  // Reset classId if it's not in classOptions anymore
  useEffect(() => {
    if (classId && !classOptions.some(c => c.id === classId)) setClassId("")
  }, [classOptions, classId])

  // Main results list — refreshes when q/class/faculty change
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 1 && !classId && !facultyId) { setResults([]); return }
      setLoading(true)
      try { setResults(await searchStudents(q, { take: 80, classId: classId || undefined, facultyId: facultyId || undefined })) }
      catch { setResults([]) }
      finally { setLoading(false) }
    }, 220)
    return () => clearTimeout(t)
  }, [q, classId, facultyId])

  const hasFilter = !!q || !!classId || !!facultyId

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, admission no, or roll number…"
            className="pl-10 pr-9 h-11"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={facultyId}
          onChange={e => setFacultyId(e.target.value)}
          className="h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer min-w-[150px]"
        >
          <option value="">All faculties</option>
          {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <select
          value={classId}
          onChange={e => setClassId(e.target.value)}
          className="h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer min-w-[160px]"
        >
          <option value="">All classes</option>
          {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {hasFilter && (
          <button
            type="button"
            onClick={() => { setQ(""); setClassId(""); setFacultyId("") }}
            className="h-11 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Recently collected from — server-side, scoped to the signed-in user */}
      {recent.length > 0 && !hasFilter && (
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl border border-white/40 p-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Recently collected from
          </p>
          <div className="flex flex-wrap gap-2">
            {recent.map(s => {
              const initials = s.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
              return (
                <Link
                  key={s.id}
                  href={`/finance/students/${s.id}`}
                  className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-white rounded-full border border-slate-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer max-w-[260px]"
                >
                  {s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatarUrl} alt={s.name} className="w-6 h-6 rounded-full object-cover ring-1 ring-white flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center ring-1 ring-white flex-shrink-0">
                      <span className="text-[9px] font-bold text-emerald-700">{initials}</span>
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 truncate">{s.name}</span>
                  {s.className && (
                    <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{s.className}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {!hasFilter ? (
          <div className="p-16 text-center">
            <UserRound className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">Search or pick a class/faculty to list students.</p>
            <p className="text-xs text-slate-400 mt-1">Tip: type a name, admission no, or roll number — top matches appear instantly below.</p>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-slate-300 mb-3 animate-spin" />
            <p className="text-sm text-slate-600">Searching…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-16 text-center">
            <UserRound className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">No students matched.</p>
            <p className="text-xs text-slate-400 mt-1">Try a different name, admission no, roll number, or change the filters.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {results.map(s => (
                <li key={s.id}>
                  <Link
                    href={`/finance/students/${s.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <Avatar name={s.name} url={s.avatarUrl} size={10} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold truncate">{s.name}</p>
                        {s.nameNepali && <span className="text-[11px] text-slate-500 font-medium">· {s.nameNepali}</span>}
                        {s.gender === "FEMALE" && <BadgeCheck className="w-3 h-3 text-pink-500" aria-label="Female" />}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-0.5"><Hash className="w-2.5 h-2.5 text-slate-300" />{s.admissionNo}</span>
                        {s.rollNumber && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>Roll {s.rollNumber}</span>
                          </>
                        )}
                        {s.gender && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="capitalize">{s.gender.toLowerCase()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {s.className && (
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {s.className}
                        </span>
                      )}
                      {s.facultyName && (
                        <span className="text-[10px] uppercase tracking-widest font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                          {s.facultyName}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-widest font-black text-slate-400 border-t border-slate-100 bg-slate-50/50">
              <span>Showing {results.length} student{results.length === 1 ? "" : "s"}</span>
              {results.length === 80 && <span className="text-amber-600">Limited to first 80 — refine your search to see more</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: 9 | 10 }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
  // Hardcoded so Tailwind's JIT can see the class names at build time.
  const cls = size === 9 ? "w-9 h-9" : "w-10 h-10"
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={cn(cls, "rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0")} />
  }
  return (
    <div className={cn(cls, "rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0")}>
      <span className="text-[11px] font-bold text-emerald-700">{initials}</span>
    </div>
  )
}
