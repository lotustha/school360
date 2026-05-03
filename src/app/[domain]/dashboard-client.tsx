"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"
import Link from "next/link"
import {
  BookOpen, Settings, Users, GraduationCap, TrendingUp, CalendarDays,
  CreditCard, ArrowRight, BarChart3, Bell, CheckCircle2, Clock,
  AlertCircle, ShieldCheck, Wifi, WifiOff, Zap, Package2, Star,
  ChevronRight, Building2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Animation Variants ──────────────────────────────────────────────────────

const SPRING: [number, number, number, number] = [0.22, 1, 0.36, 1]

const container: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const item: Variants = {
  hidden:  { opacity: 0, y: 22, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.45, ease: SPRING } },
}

const cardHover: Variants = {
  rest:  { y: 0, scale: 1 },
  hover: { y: -4, scale: 1.01, transition: { duration: 0.22, ease: "easeOut" } },
}

// ─── Animated Counter ────────────────────────────────────────────────────────
function Counter({ value }: { value: number }) {
  const [display, setDisplay] = React.useState(0)
  const prefersReduced = useReducedMotion()

  React.useEffect(() => {
    if (prefersReduced) { setDisplay(value); return }
    let start = 0
    const step = Math.ceil(value / 24)
    const timer = setInterval(() => {
      start = Math.min(start + step, value)
      setDisplay(start)
      if (start >= value) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [value, prefersReduced])

  return <span className="tabular-nums">{display}</span>
}

// ─── Compliance Badge ─────────────────────────────────────────────────────────
function CompliancePill({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        active
          ? "bg-primary/10 text-primary border-primary/25"
          : "bg-muted/60 text-muted-foreground border-border/50"
      )}
    >
      {active && <ShieldCheck className="w-3 h-3" />}
      {label}
    </motion.span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  school: {
    id: string
    name: string
    slug: string
    themeColor: string | null
    createdAt: Date
    _count: { users: number; classes: number; sections: number; subjects: number; faculties: number }
  }
  trial: { isActive: boolean; daysLeft: number; plan: string }
  activeModules: string[]
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DashboardClient({ data }: { data: DashboardData }) {
  const { school, trial, activeModules } = data
  const prefersReduced = useReducedMotion()

  const statsCards = [
    { label: "Total Users",   value: school._count.users,    icon: Users,         color: "text-blue-600",   bg: "bg-blue-500/8",    border: "border-blue-500/20",   glow: "shadow-blue-500/10" },
    { label: "Classes",       value: school._count.classes,  icon: GraduationCap, color: "text-primary",    bg: "bg-primary/8",     border: "border-primary/20",    glow: "shadow-primary/10" },
    { label: "Sections",      value: school._count.sections, icon: Users,         color: "text-violet-600", bg: "bg-violet-500/8",  border: "border-violet-500/20", glow: "shadow-violet-500/10" },
    { label: "Subjects",      value: school._count.subjects, icon: BookOpen,      color: "text-amber-600",  bg: "bg-amber-500/8",   border: "border-amber-500/20",  glow: "shadow-amber-500/10" },
  ]

  const quickActions = [
    { title: "Academics",  desc: "Faculties, classes, sections, subjects",  href: "/academics",  icon: BookOpen,      gradient: "from-primary/20 to-primary/5",       iconColor: "text-primary",    badge: `${school._count.classes} Classes` },
    { title: "Students",   desc: "Enrollment, profiles, attendance",        href: "/students",   icon: GraduationCap, gradient: "from-blue-500/20 to-blue-500/5",     iconColor: "text-blue-600",   badge: "Manage" },
    { title: "Timetable",  desc: "Class schedules, teacher allocation",     href: "/timetable",  icon: CalendarDays,  gradient: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-600", badge: "Schedule" },
    { title: "Finance",    desc: "Fees, payroll, IRD-compliant billing",    href: "/finance",    icon: CreditCard,    gradient: "from-amber-500/20 to-amber-500/5",   iconColor: "text-amber-600",  badge: "Accounts" },
    { title: "Reports",    desc: "Academic & financial analytics",          href: "/reports",    icon: BarChart3,     gradient: "from-rose-500/20 to-rose-500/5",     iconColor: "text-rose-600",   badge: "Analytics" },
    { title: "Settings",   desc: "Roles, permissions, configuration",       href: "/settings",   icon: Settings,      gradient: "from-slate-500/20 to-slate-500/5",   iconColor: "text-slate-600",  badge: "Config" },
  ]

  const setupChecklist = [
    { label: "Faculties configured", done: school._count.faculties > 0 },
    { label: "Classes added",        done: school._count.classes   > 0 },
    { label: "Sections defined",     done: school._count.sections  > 0 },
    { label: "Subjects configured",  done: school._count.subjects  > 0 },
    { label: "Staff accounts added", done: school._count.users     > 1 },
  ]
  const setupProgress = Math.round(setupChecklist.filter(c => c.done).length / setupChecklist.length * 100)

  const moduleFeatures = [
    { key: "FINANCE_TAX",   label: "Finance & Tax",   icon: CreditCard,  color: "text-amber-600",  bg: "bg-amber-500/8" },
    { key: "EXAM_CAS",      label: "Exam & CAS",      icon: Star,        color: "text-blue-600",   bg: "bg-blue-500/8" },
    { key: "TRANSPORT_GPS", label: "Transport GPS",   icon: TrendingUp,  color: "text-violet-600", bg: "bg-violet-500/8" },
    { key: "MOBILE_APP",    label: "Mobile App",      icon: Zap,         color: "text-primary",    bg: "bg-primary/8" },
    { key: "ONLINE_LEARNING",  label: "Online LMS",  icon: BookOpen,    color: "text-rose-600",   bg: "bg-rose-500/8" },
    { key: "CANTEEN",       label: "Canteen",         icon: Package2,    color: "text-orange-600", bg: "bg-orange-500/8" },
  ]

  const animProps = prefersReduced
    ? {}
    : { variants: container, initial: "hidden", animate: "visible" }

  return (
    <motion.div className="space-y-7 max-w-7xl mx-auto" {...animProps}>

      {/* ── Hero Glass Banner ─────────────────────────────────────── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl iris-overlay">
        <div className="relative z-10 glass rounded-2xl p-7">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30 flex-shrink-0"
                whileHover={{ scale: 1.08, rotate: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Building2 className="w-7 h-7 text-primary-foreground" />
              </motion.div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                  Welcome back
                </p>
                <h1 className="text-2xl font-bold tracking-tight">{school.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Academic Year 2081/82 · {school.slug}.school360.com.np
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/25 hover:bg-primary/15 text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                2081/82
              </Badge>
              {trial.plan === "TRIAL" && (
                <motion.div
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border",
                    trial.daysLeft > 7
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400"
                  )}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                >
                  <Clock className="w-3 h-3" />
                  {trial.daysLeft} days trial left
                </motion.div>
              )}
            </div>
          </div>

          {/* Nepal compliance pills */}
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/20 dark:border-white/8">
            <CompliancePill label="SSF" />
            <CompliancePill label="TDS" />
            <CompliancePill label="IRD" />
            <CompliancePill label="NEB" />
            <CompliancePill label="CDC" />
            <CompliancePill label="MoE" />
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
              "bg-primary/10 text-primary border-primary/25"
            )}>
              <Wifi className="w-3 h-3" /> Offline Ready
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={item}
            initial="rest"
            whileHover="hover"
            animate="rest"
          >
            <motion.div variants={cardHover} className="h-full">
              <div className={cn(
                "glass rounded-xl p-5 h-full border cursor-default",
                stat.border,
                `shadow-lg ${stat.glow}`
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                </div>
                <div className="text-3xl font-bold">
                  <Counter value={stat.value} />
                </div>
                <div className="text-sm font-medium mt-0.5">{stat.label}</div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Quick Access */}
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Access</h2>
            <span className="text-xs text-muted-foreground">All modules</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {quickActions.map((action, i) => (
              <motion.div key={action.title} variants={item} initial="rest" whileHover="hover" animate="rest">
                <motion.div variants={cardHover}>
                  <Link href={action.href} className="block h-full">
                    <div className="glass rounded-xl p-4 h-full border border-white/25 dark:border-white/8 cursor-pointer group">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                          action.gradient
                        )}>
                          <action.icon className={cn("w-5 h-5", action.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="font-semibold text-sm">{action.title}</span>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 flex-shrink-0 bg-white/50 dark:bg-white/8">
                              {action.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{action.desc}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Setup Progress */}
          <motion.div variants={item} className="glass rounded-xl p-5 border border-white/25 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Setup Progress</h3>
              <span className="text-xs font-bold text-primary">{setupProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${setupProgress}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              />
            </div>
            <ul className="space-y-2">
              {setupChecklist.map((chk) => (
                <li key={chk.label} className="flex items-center gap-2.5">
                  {chk.done
                    ? <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    : <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  }
                  <span className={cn("text-xs", chk.done ? "text-foreground" : "text-muted-foreground")}>
                    {chk.label}
                  </span>
                </li>
              ))}
            </ul>
            {setupProgress < 100 && (
              <Link href="/academics">
                <Button size="sm" variant="outline" className="w-full mt-4 text-xs h-8 glass border-primary/20 hover:bg-primary/8">
                  Continue Setup <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </motion.div>

          {/* Notice Board */}
          <motion.div variants={item} className="glass rounded-xl p-5 border border-white/25 dark:border-white/8">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Notice Board</h3>
            </div>
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">No announcements yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Notices will appear here</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Modules Status ───────────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Modules</h2>
          <Link href="/settings/subscription">
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-primary gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {moduleFeatures.map((mod, i) => {
            const isActive = activeModules.includes(mod.key)
            return (
              <motion.div
                key={mod.key}
                variants={item}
                className={cn(
                  "glass rounded-xl p-3.5 border text-center cursor-default transition-opacity",
                  isActive ? "border-white/25 dark:border-white/8" : "opacity-50 border-border/40",
                )}
                whileHover={isActive ? { y: -2, scale: 1.02 } : {}}
                transition={{ duration: 0.18 }}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2", mod.bg)}>
                  <mod.icon className={cn("w-4 h-4", mod.color)} />
                </div>
                <p className="text-[10px] font-semibold leading-tight">{mod.label}</p>
                <div className={cn(
                  "mt-1.5 w-1.5 h-1.5 rounded-full mx-auto",
                  isActive ? "bg-primary animate-pulse-soft" : "bg-muted-foreground/30"
                )} />
              </motion.div>
            )
          })}
        </div>
      </motion.div>

    </motion.div>
  )
}
