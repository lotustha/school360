"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const navItems = [
  { title: "Overview", href: "/hr",         icon: LayoutDashboard, exact: true },
  { title: "Staff",    href: "/hr/staff",   icon: Users },
  { title: "Payroll",  href: "/hr/payroll", icon: Wallet },
]

export function HRNav() {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === "hr")
  const relative = idx !== -1 ? "/" + segments.slice(idx).join("/") : "/hr"

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-xl p-1 inline-flex gap-0.5 overflow-x-auto max-w-full">
      {navItems.map(item => {
        const isActive = item.exact ? relative === item.href : relative.startsWith(item.href)
        return (
          <Link key={item.title} href={item.href} className="relative">
            {isActive && (
              <motion.div
                layoutId="hr-nav-pill"
                className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              />
            )}
            <span className={cn(
              "relative z-10 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
              <item.icon className="w-3.5 h-3.5" />
              {item.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
