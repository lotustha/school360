"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  GlobalFiltersBar,
  type FacultyOpt, type ClassOpt, type AcademicYearOpt,
} from "@/components/ui/global-filters-bar"

interface Props {
  faculties:     FacultyOpt[]
  classes:       ClassOpt[]
  academicYears: AcademicYearOpt[]
  initialQuery:  string
  totalCount:    number
}

export function SubjectsToolbar({
  faculties, classes, academicYears, initialQuery, totalCount,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)

  // Debounced search
  useEffect(() => {
    if (query === initialQuery) return
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) params.set("q", query.trim())
      else              params.delete("q")
      params.delete("page")
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search subjects by name, code, short name or teacher…"
            className="h-9 pl-9 pr-9 text-sm bg-white border-slate-200 rounded-lg"
          />
          {query && (
            <button onClick={() => setQuery("")}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] font-bold gap-1 h-9 px-2.5">
          {totalCount} result{totalCount === 1 ? "" : "s"}
        </Badge>
      </div>

      <GlobalFiltersBar
        show={["facultyId", "academicYearId", "classId"]}
        faculties={faculties}
        academicYears={academicYears}
        classes={classes}
      />
    </div>
  )
}
