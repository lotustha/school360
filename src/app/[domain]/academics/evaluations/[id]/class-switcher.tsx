"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  classes:       { id: string; name: string }[]
  activeClassId: string
}

export function ClassSwitcher({ classes, activeClassId }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function select(classId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("classId", classId)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (classes.length <= 1) return null

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-2 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
        <GraduationCap className="w-3.5 h-3.5" />
        <span className="font-medium">Viewing class</span>
      </div>
      {classes.map(c => (
        <button
          key={c.id}
          onClick={() => select(c.id)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer",
            activeClassId === c.id
              ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
              : "bg-white/70 text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
