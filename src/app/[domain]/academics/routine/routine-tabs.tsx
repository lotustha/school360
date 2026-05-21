"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarClock, Grid3X3, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/academics/routine",          label: "Schedules",            icon: CalendarClock, exact: true },
  { href: "/academics/routine/compact",  label: "Period × Class",       icon: Grid3X3       },
  { href: "/academics/routine/teachers", label: "Teacher week",         icon: UserCog       },
]

export function RoutineTabs() {
  const pathname = usePathname()
  // pathname may include the domain prefix; we only care about the suffix.
  const norm = pathname.replace(/^\/[^/]+/, "") // strip leading "/{domain}"
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-1.5 inline-flex items-center gap-1">
      {TABS.map(t => {
        const Icon = t.icon
        const active = t.exact ? norm === t.href : norm.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
              active
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
