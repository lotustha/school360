"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { label: "Subjects", href: "/academics/subjects",        icon: BookOpen, exact: true },
  { label: "Groups",   href: "/academics/subjects/groups", icon: Layers },
]

export function SubjectsSubNav() {
  const pathname = usePathname()
  const segments = pathname.split("/")
  const idx      = segments.findIndex(s => s === "academics")
  const relative = idx !== -1 ? "/" + segments.slice(idx).join("/") : "/academics/subjects"

  return (
    <div className="inline-flex items-center gap-1 bg-slate-100/70 rounded-lg p-1">
      {items.map(item => {
        const isActive = item.exact ? relative === item.href : relative.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
