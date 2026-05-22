"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, BookOpen, ListChecks, Calendar,
  Scale, Settings2, CalendarRange, Zap, Coins, Landmark,
  TrendingUp, ArrowLeftRight, FileBarChart, Truck, Users,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

type NavItem = { title: string; href: string; icon: React.ElementType; exact?: boolean }
type NavGroup = { title: string; icon: React.ElementType; items: NavItem[] }

// Frequently-used items live as top-level tabs.
const primary: NavItem[] = [
  { title: "Overview",    href: "/accounting",          icon: LayoutDashboard, exact: true },
  { title: "Quick Entry", href: "/accounting/quick",    icon: Zap },
  { title: "Vouchers",    href: "/accounting/vouchers", icon: FileText },
  { title: "Day Book",    href: "/accounting/day-book", icon: Calendar },
]

// Less-frequent items grouped into dropdowns.
const groups: NavGroup[] = [
  {
    title: "Books", icon: BookOpen,
    items: [
      { title: "Cash Book",              href: "/accounting/cash-book",            icon: Coins },
      { title: "Bank Book",              href: "/accounting/bank-book",            icon: Landmark },
      { title: "Cash + Bank Book",       href: "/accounting/combined-cash-book",   icon: ArrowLeftRight },
      { title: "Bank Reconciliation",    href: "/accounting/bank-reconciliation",  icon: Scale },
      { title: "General Ledger",         href: "/accounting/ledger",               icon: BookOpen },
      { title: "Subsidiary (Parties)",   href: "/accounting/subsidiary",           icon: Users },
    ],
  },
  {
    title: "Reports", icon: Scale,
    items: [
      { title: "Trial Balance", href: "/accounting/reports/trial-balance",      icon: Scale },
      { title: "I & E A/c",     href: "/accounting/reports/income-expenditure", icon: TrendingUp },
      { title: "R & P A/c",     href: "/accounting/reports/receipts-payments",  icon: ArrowLeftRight },
      { title: "Balance Sheet", href: "/accounting/reports/balance-sheet",      icon: FileBarChart },
    ],
  },
  {
    title: "Masters", icon: ListChecks,
    items: [
      { title: "Chart of Accounts", href: "/accounting/accounts",      icon: ListChecks },
      { title: "Vendors",           href: "/accounting/vendors",       icon: Truck },
      { title: "Bank Accounts",     href: "/accounting/bank-accounts", icon: Landmark },
      { title: "Fiscal Years",      href: "/accounting/fiscal-years",  icon: CalendarRange },
      { title: "Setup",             href: "/accounting/setup",         icon: Settings2 },
    ],
  },
]

export function AccountingNav() {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === "accounting")
  const relative = idx !== -1 ? "/" + segments.slice(idx).join("/") : "/accounting"

  function isMatch(item: NavItem) {
    return item.exact ? relative === item.href : relative.startsWith(item.href)
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-xl p-1 inline-flex gap-0.5 max-w-full overflow-x-auto no-print print:hidden">
      {primary.map(item => {
        const active = isMatch(item)
        return (
          <Link key={item.title} href={item.href} className="relative">
            {active && (
              <motion.div
                layoutId="accounting-nav-pill"
                className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              />
            )}
            <span className={cn(
              "relative z-10 flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
              <item.icon className="w-3.5 h-3.5" />
              {item.title}
            </span>
          </Link>
        )
      })}

      {groups.map(group => {
        const active = group.items.some(i => isMatch(i))
        const Icon = group.icon
        return (
          <DropdownMenu key={group.title}>
            <DropdownMenuTrigger asChild>
              <button className="relative">
                {active && (
                  <motion.div
                    layoutId="accounting-nav-pill"
                    className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                <span className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}>
                  <Icon className="w-3.5 h-3.5" />
                  {group.title}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px] bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
              {group.items.map(item => {
                const itemActive = isMatch(item)
                return (
                  <DropdownMenuItem key={item.title} asChild className="cursor-pointer">
                    <Link href={item.href} className="flex items-center gap-2 text-sm">
                      <item.icon className={cn("w-3.5 h-3.5", itemActive ? "text-primary" : "text-slate-500")} />
                      <span className={cn(itemActive && "font-bold text-primary")}>{item.title}</span>
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
