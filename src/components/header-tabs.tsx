"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FolderTree, GraduationCap, Users,
  BookOpen, Wallet, Settings, Shield, Award, ClipboardCheck, CalendarRange, CalendarClock,
  DoorOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TabItem = { label: string; href: string; icon: React.ElementType; exact?: boolean }

const MODULE_CONFIG: Record<string, { title: string; tabs: TabItem[] }> = {
  academics: {
    title: "Academics",
    tabs: [
      { label: "Overview",    href: "/academics",             icon: LayoutDashboard, exact: true },
      { label: "Faculties",   href: "/academics/faculties",   icon: FolderTree },
      { label: "Sessions",    href: "/academics/years",       icon: CalendarRange },
      { label: "Classes",     href: "/academics/classes",     icon: GraduationCap },
      { label: "Sections",    href: "/academics/sections",    icon: Users },
      { label: "Subjects",    href: "/academics/subjects",    icon: BookOpen },
      { label: "Routine",     href: "/academics/routine",     icon: CalendarClock },
      { label: "Exams",       href: "/academics/exams",       icon: CalendarRange },
      { label: "Evaluations", href: "/academics/evaluations", icon: ClipboardCheck },
      { label: "Grading",     href: "/academics/grading",     icon: Award },
    ],
  },
  hr: {
    title: "HR & Staff",
    tabs: [
      { label: "Overview", href: "/hr",         icon: LayoutDashboard, exact: true },
      { label: "Staff",    href: "/hr/staff",   icon: Users },
      { label: "Payroll",  href: "/hr/payroll", icon: Wallet },
    ],
  },
  settings: {
    title: "Settings",
    tabs: [
      { label: "General",        href: "/settings",        icon: Settings, exact: true },
      { label: "Roles",          href: "/settings/roles",  icon: Shield },
      { label: "Users & Access", href: "/settings/users",  icon: Users },
      { label: "Rooms",          href: "/settings/rooms",  icon: DoorOpen },
    ],
  },
}

/**
 * usePathname() returns the browser-visible URL (e.g. "/academics/classes"),
 * NOT the internally-rewritten path. So we find the module key by searching
 * all segments rather than assuming a fixed position.
 */
function detectModule(pathname: string): { key: string; config: typeof MODULE_CONFIG[string] } | null {
  const segments = pathname.split("/")
  for (const key of Object.keys(MODULE_CONFIG)) {
    if (segments.includes(key)) {
      return { key, config: MODULE_CONFIG[key] }
    }
  }
  return null
}

/** Extract the portion of the path starting from the module segment. */
function getRelative(pathname: string, moduleKey: string): string {
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === moduleKey)
  return idx !== -1 ? "/" + segments.slice(idx).join("/") : `/${moduleKey}`
}

export function HeaderTabs() {
  const pathname = usePathname()
  const detected = detectModule(pathname)

  if (!detected) return null

  const { key, config } = detected
  const relative = getRelative(pathname, key)

  return (
    <div className="flex items-stretch gap-0 border-t border-white/25 overflow-x-auto scrollbar-none">
      {config.tabs.map(tab => {
        const isActive = tab.exact ? relative === tab.href : relative.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex items-center gap-1.5 px-4 h-9 text-xs font-semibold whitespace-nowrap",
              "transition-colors duration-150 border-b-2",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
            )}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

/** Returns the human-readable module title for the current path (for the header breadcrumb). */
export function useModuleTitle(): string | null {
  const pathname = usePathname()
  const detected = detectModule(pathname)
  return detected?.config.title ?? null
}
