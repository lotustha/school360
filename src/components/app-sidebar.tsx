"use client"

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarRail, SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Home, Users, Settings, BookOpen, CreditCard, CalendarDays,
  GraduationCap, BarChart3, Building2, ChevronRight,
  ShoppingCart, UtensilsCrossed, Layers, Bell, Calculator,
} from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const mainNav = [
  { title: "Dashboard",  url: "/",          icon: Home },
  { title: "Students",   url: "/students",  icon: GraduationCap },
  { title: "Academics",  url: "/academics", icon: BookOpen },
  { title: "Attendance", url: "/attendance",icon: CalendarDays },
  { title: "Notices",    url: "/notices",   icon: Bell },
]

const financeNav = [
  { title: "Finance",    url: "/finance",    icon: CreditCard },
  { title: "Accounting", url: "/accounting", icon: Calculator },
  { title: "Canteen",    url: "/canteen",    icon: UtensilsCrossed },
  { title: "Reports",    url: "/reports",    icon: BarChart3 },
]

const adminNav = [
  { title: "HR & Staff",   url: "/hr",          icon: Users },
  { title: "Inventory",    url: "/inventory",   icon: ShoppingCart },
  { title: "LMS",          url: "/lms",         icon: Layers },
  { title: "Settings",     url: "/settings",    icon: Settings },
]

const itemVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
}

function NavItem({ item, index }: { item: { title: string; url: string; icon: React.ElementType }; index: number }) {
  const pathname = usePathname()
  const isActive = pathname === item.url || (item.url !== "/" && pathname?.startsWith(item.url))
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <motion.div variants={itemVariants} transition={{ delay: index * 0.04 }}>
        <SidebarMenuButton asChild tooltip={item.title}>
          <Link
            href={item.url}
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              isActive && "text-primary font-semibold"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200",
              isActive
                ? "bg-primary/15 text-primary shadow-sm shadow-primary/20"
                : "text-muted-foreground group-hover:text-foreground"
            )}>
              <Icon className="size-4" />
            </div>
            <span>{item.title}</span>
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="ml-auto w-1 h-4 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        </SidebarMenuButton>
      </motion.div>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" className="flex items-center gap-3">
                <motion.div
                  className="relative flex aspect-square size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  whileHover={{ scale: 1.08, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Building2 className="size-4" />
                  <div className="absolute inset-0 rounded-xl iris-overlay" />
                </motion.div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-bold text-base tracking-tight">School360</span>
                  <span className="truncate text-[11px] text-muted-foreground">Management System</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item, i) => <NavItem key={item.title} item={item} index={i} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeNav.map((item, i) => <NavItem key={item.title} item={item} index={i + mainNav.length} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item, i) => <NavItem key={item.title} item={item} index={i + mainNav.length + financeNav.length} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-7 rounded-lg ring-2 ring-primary/20">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">School Admin</span>
                <span className="truncate text-muted-foreground text-[11px]">admin@school.edu</span>
              </div>
              <ChevronRight className="ml-auto size-3 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
