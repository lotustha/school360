"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, CalendarRange, Grid3X3, UserCog, ClipboardCheck, FileBarChart2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { suffix: "",              label: "Overview",     icon: LayoutDashboard,  exact: true },
  { suffix: "/routine",      label: "Routine",      icon: CalendarRange    },
  { suffix: "/seats",        label: "Seats",        icon: Grid3X3          },
  { suffix: "/invigilators", label: "Invigilators", icon: UserCog          },
  { suffix: "/attendance",   label: "Attendance",   icon: ClipboardCheck   },
  { suffix: "/reports",      label: "Reports",      icon: FileBarChart2    },
]

export function ExamTabs({ examId }: { examId: string }) {
  const pathname = usePathname()
  // pathname includes leading "/{domain}" — strip it for comparisons.
  const norm = pathname.replace(/^\/[^/]+/, "")
  const base = `/academics/exams/${examId}`

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-xl p-1 inline-flex gap-0.5 overflow-x-auto max-w-full">
      {TABS.map(t => {
        const Icon = t.icon
        const exact = "exact" in t && t.exact === true
        const href = base + t.suffix
        const active = exact
          ? norm === href || norm === href + "/"
          : norm.startsWith(href + "/") || norm === href

        return (
          <Link
            key={t.suffix}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
              active
                ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/40"
                : "font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100/70",
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
