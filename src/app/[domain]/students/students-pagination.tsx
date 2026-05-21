"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const STORAGE_PS_KEY = "school360.students.pageSize"

interface Props {
  page:       number
  pageSize:   number     // numeric resolved size (used for arithmetic). When "all", parent passes totalCount.
  pageSizeParam: string  // raw value: "25" | "50" | "100" | "all"
  totalCount: number
}

const SIZES = [
  { value: "25",  label: "25 / page"  },
  { value: "50",  label: "50 / page"  },
  { value: "100", label: "100 / page" },
  { value: "all", label: "Show all"   },
]

export function StudentsPagination({ page, pageSize, pageSizeParam, totalCount }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const isAll        = pageSizeParam === "all"
  const totalPages   = isAll ? 1 : Math.max(1, Math.ceil(totalCount / pageSize))

  function goto(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete("page")
    else        params.set("page", String(p))
    router.replace(`${pathname}?${params.toString()}`)
  }

  function changeSize(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "25") params.delete("pageSize")
    else                params.set("pageSize", value)
    params.delete("page")
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_PS_KEY, value) } catch {}
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  const start = isAll ? 1 : (page - 1) * pageSize + 1
  const end   = isAll ? totalCount : Math.min(page * pageSize, totalCount)

  const pages: (number | "…")[] = []
  function add(n: number) { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n) }
  add(1)
  if (page - 2 > 2) pages.push("…")
  for (let i = page - 1; i <= page + 1; i++) add(i)
  if (page + 2 < totalPages - 1) pages.push("…")
  add(totalPages)

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[11px] text-slate-500">
        Showing <strong className="text-slate-700 tabular-nums">{start}</strong>–<strong className="text-slate-700 tabular-nums">{end}</strong> of <strong className="text-slate-700 tabular-nums">{totalCount}</strong>
      </p>

      <div className="flex items-center gap-2">
        <Select value={pageSizeParam} onValueChange={changeSize}>
          <SelectTrigger className="h-7 text-[11px] gap-1 px-2 min-w-[100px] bg-white/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white/95 backdrop-blur-xl">
            {SIZES.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-[11px]">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isAll && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => goto(page - 1)}
              className="h-7 w-7 cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {pages.map((p, i) => p === "…" ? (
              <span key={`gap-${i}`} className="text-[11px] text-slate-400 px-1">…</span>
            ) : (
              <button key={p} onClick={() => goto(p)}
                className={cn(
                  "min-w-[28px] h-7 px-2 rounded-md text-[11px] font-bold tabular-nums cursor-pointer transition-colors",
                  p === page
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >{p}</button>
            ))}
            <Button size="icon" variant="ghost" disabled={page === totalPages} onClick={() => goto(page + 1)}
              className="h-7 w-7 cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
