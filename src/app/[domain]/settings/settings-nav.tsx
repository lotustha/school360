"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Users, Settings, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { title: "General", href: "/settings", icon: Settings, description: "School info & preferences", exact: true },
  { title: "Roles", href: "/settings/roles", icon: Shield, description: "Access roles" },
  { title: "Users & Access", href: "/settings/users", icon: Users, description: "Accounts & permissions" },
]

export function SettingsNav() {
  const pathname = usePathname()

  const segments = pathname.split("/")
  const settingsIdx = segments.findIndex((s) => s === "settings")
  const relativePath = settingsIdx !== -1 ? "/" + segments.slice(settingsIdx).join("/") : "/settings"

  return (
    <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto">
      {navItems.map((item) => {
        const isActive = item.exact
          ? relativePath === item.href
          : relativePath.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap lg:whitespace-normal",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
            )}
          >
            <item.icon
              className={cn(
                "w-4 h-4 flex-shrink-0 transition-colors",
                isActive ? "text-primary" : "group-hover:text-primary"
              )}
            />
            <span className="flex-1">{item.title}</span>
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 hidden lg:block transition-opacity",
                isActive ? "opacity-60" : "opacity-0 group-hover:opacity-40"
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
