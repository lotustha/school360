"use client"

import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const MODULE_TITLES: Record<string, string> = {
  "":          "Dashboard",
  students:    "Students",
  academics:   "Academics",
  attendance:  "Attendance",
  hr:          "HR & Staff",
  finance:     "Finance",
  settings:    "Settings",
  notices:     "Notices",
  reports:     "Reports",
}

export function HeaderBreadcrumb({ domain }: { domain: string }) {
  const pathname = usePathname()
  const segments = pathname.split("/")
  // usePathname() returns the browser URL (e.g. "/academics/classes"), not the rewritten path.
  // The module segment is the first known key found in the path.
  const module   = segments.find(s => s in MODULE_TITLES && s !== "") ?? ""
  const title    = MODULE_TITLES[module] ?? ""

  return (
    <div className="hidden sm:flex items-center gap-2 min-w-0">
      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft flex-shrink-0" />
      <Badge
        variant="secondary"
        className="text-[11px] font-medium capitalize px-2 py-0 h-5
          bg-primary/8 text-primary border-primary/20 hover:bg-primary/12 whitespace-nowrap"
      >
        {domain}
      </Badge>
      {title && title !== "Dashboard" && (
        <>
          <span className="text-slate-300 text-xs">/</span>
          <span className="text-xs font-semibold text-slate-600 truncate">{title}</span>
        </>
      )}
    </div>
  )
}
