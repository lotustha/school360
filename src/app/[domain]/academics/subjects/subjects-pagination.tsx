"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  page:       number
  pageSize:   number
  totalCount: number
}

export function SubjectsPagination({ page, pageSize, totalCount }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const totalPages   = Math.max(1, Math.ceil(totalCount / pageSize))
  if (totalPages <= 1) return null

  function goto(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p <= 1) params.delete("page")
    else        params.set("page", String(p))
    router.replace(`${pathname}?${params.toString()}`)
  }

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, totalCount)

  // Build a compact page list: always 1, current ±1, last; ellipsis between
  const pages: (number | "…")[] = []
  function add(n: number) { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n) }
  add(1)
  if (page - 2 > 2) pages.push("…")
  for (let i = page - 1; i <= page + 1; i++) add(i)
  if (page + 2 < totalPages - 1) pages.push("…")
  add(totalPages)

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
      <p className="text-[11px] text-slate-500">
        Showing <strong className="text-slate-700 tabular-nums">{start}</strong>–<strong className="text-slate-700 tabular-nums">{end}</strong> of <strong className="text-slate-700 tabular-nums">{totalCount}</strong>
      </p>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" disabled={page === 1} onClick={() => goto(page - 1)}
          className="h-7 w-7 cursor-pointer">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        {pages.map((p, i) => p === "…" ? (
          <span key={`gap-${i}`} className="text-[11px] text-slate-400 px-1">…</span>
        ) : (
          <button
            key={p}
            onClick={() => goto(p)}
            className={cn(
              "min-w-[28px] h-7 px-2 rounded-md text-[11px] font-bold tabular-nums cursor-pointer transition-colors",
              p === page
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {p}
          </button>
        ))}
        <Button size="icon" variant="ghost" disabled={page === totalPages} onClick={() => goto(page + 1)}
          className="h-7 w-7 cursor-pointer">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
