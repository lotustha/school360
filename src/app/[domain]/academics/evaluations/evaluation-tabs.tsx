"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ClipboardCheck, BookOpenCheck, Award, FileBarChart } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { title: "Evaluations", href: "/academics/evaluations",            icon: ClipboardCheck, match: (p: string) => p === "/academics/evaluations" || (p.startsWith("/academics/evaluations/") && !p.includes("/ledger") && !p.includes("/transcript") && !p.includes("/reports")) },
  { title: "Class Ledger", href: "/academics/evaluations/ledger",    icon: BookOpenCheck,  match: (p: string) => p.startsWith("/academics/evaluations/ledger") },
  { title: "Transcripts",  href: "/academics/evaluations/transcript",icon: Award,          match: (p: string) => p.startsWith("/academics/evaluations/transcript") },
  { title: "Reports",      href: "/academics/evaluations/reports",   icon: FileBarChart,   match: (p: string) => p.startsWith("/academics/evaluations/reports") },
]

export function EvaluationTabs() {
  const pathname = usePathname()
  const search   = useSearchParams()

  // Normalize tenant-prefixed path to relative path under /academics/evaluations
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === "academics")
  const relative = idx !== -1 ? "/" + segments.slice(idx).join("/") : "/academics/evaluations"

  // Preserve filter params across tab switches
  const queryString = search.toString()
  const suffix      = queryString ? `?${queryString}` : ""

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-xl p-1 inline-flex gap-0.5 overflow-x-auto max-w-full">
      {tabs.map(t => {
        const isActive = t.match(relative)
        return (
          <Link
            key={t.title}
            href={`${t.href}${suffix}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/40"
                : "font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100/70",
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.title}
          </Link>
        )
      })}
    </div>
  )
}
