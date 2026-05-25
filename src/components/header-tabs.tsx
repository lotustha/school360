"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FolderTree, GraduationCap, Users,
  BookOpen, Wallet, Settings, Shield, Award, ClipboardCheck, CalendarRange, CalendarClock,
  DoorOpen, Receipt, History, Calculator, FileText, Zap, Calendar,
  Coins, Landmark, ArrowLeftRight, Scale, TrendingUp, FileBarChart,
  ListChecks, Truck, Settings2, Layers, Sparkles, ShieldCheck, ClipboardList,
  ChevronDown, NotebookPen, ReceiptText,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type TabItem = { kind?: "link"; label: string; href: string; icon: React.ElementType; exact?: boolean }
type TabGroup = { kind: "group"; label: string; icon: React.ElementType; items: Array<{ label: string; href: string; icon: React.ElementType; exact?: boolean }> }
type Tab = TabItem | TabGroup

const MODULE_CONFIG: Record<string, { title: string; tabs: Tab[] }> = {
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
  finance: {
    title: "Fees",
    tabs: [
      { label: "Overview",   href: "/finance",          icon: LayoutDashboard, exact: true },
      { label: "Heads",      href: "/finance/heads",    icon: ClipboardList },
      { label: "Plans",      href: "/finance/plans",    icon: Layers },
      { label: "Students",   href: "/finance/students", icon: Users },
      { label: "Classes",    href: "/finance/classes",  icon: GraduationCap },
      { label: "Collect",    href: "/finance/collect",  icon: Receipt },
      { label: "History",    href: "/finance/history",  icon: History },
      { label: "Audit Log",  href: "/finance/audit",    icon: ShieldCheck },
      { label: "Accounting", href: "/accounting",       icon: Calculator },
    ],
  },
  accounting: {
    title: "Accounting",
    tabs: [
      { label: "Overview",    href: "/accounting",          icon: LayoutDashboard, exact: true },
      { label: "Quick Entry", href: "/accounting/quick",    icon: Zap },
      { label: "Vouchers",    href: "/accounting/vouchers", icon: ReceiptText },
      { label: "Day Book",    href: "/accounting/day-book", icon: Calendar },
      { kind: "group", label: "Books", icon: BookOpen, items: [
        { label: "Cash Book",           href: "/accounting/cash-book",           icon: Coins },
        { label: "Bank Book",           href: "/accounting/bank-book",           icon: Landmark },
        { label: "Cash + Bank Book",    href: "/accounting/combined-cash-book",  icon: ArrowLeftRight },
        { label: "Bank Reconciliation", href: "/accounting/bank-reconciliation", icon: Scale },
        { label: "General Ledger",      href: "/accounting/ledger",              icon: BookOpen },
        { label: "Subsidiary",          href: "/accounting/subsidiary",          icon: Users },
      ] },
      { kind: "group", label: "Reports", icon: Scale, items: [
        { label: "Trial Balance", href: "/accounting/reports/trial-balance",      icon: Scale },
        { label: "I & E A/c",     href: "/accounting/reports/income-expenditure", icon: TrendingUp },
        { label: "R & P A/c",     href: "/accounting/reports/receipts-payments",  icon: ArrowLeftRight },
        { label: "Balance Sheet", href: "/accounting/reports/balance-sheet",      icon: FileBarChart },
      ] },
      { kind: "group", label: "Masters", icon: ListChecks, items: [
        { label: "Chart of Accounts", href: "/accounting/accounts",      icon: ListChecks },
        { label: "Vendors",           href: "/accounting/vendors",       icon: Truck },
        { label: "Bank Accounts",     href: "/accounting/bank-accounts", icon: Landmark },
        { label: "Fiscal Years",      href: "/accounting/fiscal-years",  icon: CalendarRange },
        { label: "Setup",             href: "/accounting/setup",         icon: Settings2 },
      ] },
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

// Reserved names for the rare touched-but-not-needed icons (silences "unused" lint)
void [NotebookPen]

/**
 * usePathname() returns the browser-visible URL (e.g. "/academics/classes"),
 * NOT the internally-rewritten path. So we find the module key by searching
 * all segments rather than assuming a fixed position.
 *
 * Search order matters when paths nest (e.g. /finance has a tab pointing at
 * /accounting): the FIRST segment match wins. `accounting` is matched first
 * for accounting-prefixed paths because its key appears earlier in the
 * pathname.
 */
function detectModule(pathname: string): { key: string; config: typeof MODULE_CONFIG[string] } | null {
  const segments = pathname.split("/")
  // Prefer the deepest module segment in the URL (e.g. /finance → "finance" wins)
  for (const seg of segments) {
    if (MODULE_CONFIG[seg]) return { key: seg, config: MODULE_CONFIG[seg] }
  }
  return null
}

function getRelative(pathname: string, moduleKey: string): string {
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === moduleKey)
  return idx !== -1 ? "/" + segments.slice(idx).join("/") : `/${moduleKey}`
}

function isLinkActive(href: string, exact: boolean | undefined, relative: string): boolean {
  return exact ? relative === href : relative.startsWith(href)
}

export function HeaderTabs() {
  const pathname = usePathname()
  const detected = detectModule(pathname)

  if (!detected) return null

  const { key, config } = detected
  const relative = getRelative(pathname, key)

  return (
    <div className="flex items-stretch gap-0 border-t border-white/25 overflow-x-auto scrollbar-none">
      {config.tabs.map((tab, i) => {
        if (tab.kind === "group") {
          const Icon = tab.icon
          const groupActive = tab.items.some(it => isLinkActive(it.href, it.exact, relative))
          return (
            <DropdownMenu key={`${tab.label}-${i}`}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 h-9 text-xs font-semibold whitespace-nowrap cursor-pointer",
                    "transition-colors duration-150 border-b-2",
                    groupActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300",
                  )}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  {tab.label}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                {tab.items.map(item => {
                  const ItemIcon = item.icon
                  const itemActive = isLinkActive(item.href, item.exact, relative)
                  return (
                    <DropdownMenuItem key={item.href} asChild className="cursor-pointer">
                      <Link href={item.href} className="flex items-center gap-2 text-sm">
                        <ItemIcon className={cn("w-3.5 h-3.5", itemActive ? "text-primary" : "text-slate-500")} />
                        <span className={cn(itemActive && "font-bold text-primary")}>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        const isActive = isLinkActive(tab.href, tab.exact, relative)
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

export function useModuleTitle(): string | null {
  const pathname = usePathname()
  const detected = detectModule(pathname)
  return detected?.config.title ?? null
}
