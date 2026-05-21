"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ClipboardCheck, BookOpenCheck, Award } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { title: "Evaluations", href: "/academics/evaluations",            icon: ClipboardCheck, match: (p: string) => p === "/academics/evaluations" || (p.startsWith("/academics/evaluations/") && !p.includes("/ledger") && !p.includes("/transcript")) },
  { title: "Class Ledger", href: "/academics/evaluations/ledger",    icon: BookOpenCheck,  match: (p: string) => p.startsWith("/academics/evaluations/ledger") },
  { title: "Transcripts",  href: "/academics/evaluations/transcript",icon: Award,          match: (p: string) => p.startsWith("/academics/evaluations/transcript") },
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
          <Link key={t.title} href={`${t.href}${suffix}`} className="relative">
            {isActive && (
              <motion.div
                layoutId="evaluation-tabs-pill"
                className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              />
            )}
            <span className={cn(
              "relative z-10 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
