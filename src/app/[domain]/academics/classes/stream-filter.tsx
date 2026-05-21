"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Layers } from "lucide-react"

interface StreamFilterProps {
  faculties: { id: string; name: string }[]
}

export function StreamFilter({ faculties }: StreamFilterProps) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const active      = searchParams.get("stream") ?? "all"

  if (faculties.length === 0) return null

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") params.delete("stream")
    else params.set("stream", value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
        <Layers className="w-3.5 h-3.5" />
        <span className="font-medium">Stream</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => select("all")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer",
            active === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
              : "bg-white/70 text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary"
          )}
        >
          All
        </button>
        {faculties.map(f => (
          <button
            key={f.id}
            onClick={() => select(f.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer",
              active === f.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
                : "bg-white/70 text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary"
            )}
          >
            {f.name}
          </button>
        ))}
        {/* Separator + "General" for classes with no faculty */}
        <button
          onClick={() => select("none")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer",
            active === "none"
              ? "bg-slate-700 text-white border-slate-700 shadow-sm"
              : "bg-white/70 text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700"
          )}
        >
          General
        </button>
      </div>
    </div>
  )
}
