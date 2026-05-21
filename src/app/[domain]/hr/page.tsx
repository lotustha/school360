import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Users, GraduationCap, Wallet, UserCog, ArrowRight, Plus, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getHRStats, getStaff } from "@/actions/hr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Overview" }

const ROLE_LABEL: Record<string, string> = {
  TEACHER:      "Teacher",
  STAFF:        "Staff",
  SCHOOL_ADMIN: "Admin",
}

export default async function HROverviewPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [stats, recentStaff] = await Promise.all([
    getHRStats(school.id),
    getStaff(school.id).then(s => s.slice(0, 6)),
  ])

  const isEmpty = stats.total === 0

  const statCards = [
    {
      title: "Total Staff",
      value: stats.total,
      desc:  "Active employees",
      icon:  Users,
      color: "text-primary",
      bg:    "bg-primary/8",
      border:"border-primary/20",
      href:  "/hr/staff",
    },
    {
      title: "Teachers",
      value: stats.teachers,
      desc:  "Teaching staff",
      icon:  GraduationCap,
      color: "text-emerald-600",
      bg:    "bg-emerald-500/8",
      border:"border-emerald-500/20",
      href:  "/hr/staff",
    },
    {
      title: "Admin & Support",
      value: stats.admin,
      desc:  "Non-teaching staff",
      icon:  UserCog,
      color: "text-violet-600",
      bg:    "bg-violet-500/8",
      border:"border-violet-500/20",
      href:  "/hr/staff",
    },
    {
      title: "Monthly Payroll",
      value: `Rs. ${stats.totalMonthlyPayroll.toLocaleString()}`,
      desc:  `${stats.payrollConfigured} staff configured`,
      icon:  Wallet,
      color: "text-amber-600",
      bg:    "bg-amber-500/8",
      border:"border-amber-500/20",
      href:  "/hr/payroll",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <Link key={stat.title} href={stat.href} className="block group">
            <div className={cn(
              "bg-white/70 backdrop-blur-xl rounded-xl border p-5 transition-all duration-200",
              "hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/8 cursor-pointer",
              stat.border
            )}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div className="text-3xl font-bold tabular-nums">{stat.value}</div>
              <div className="text-sm font-semibold mt-0.5">{stat.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 border-dashed p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2 tracking-tight">No staff added yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Add teachers and admin staff to get started. Each staff member gets a login account and can be assigned a payroll structure.
          </p>
          <Link href="/hr/staff">
            <Button className="gap-1.5 cursor-pointer shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Add First Staff Member
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Recent staff panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
              <div>
                <p className="font-semibold text-sm">Staff Members</p>
                <p className="text-xs text-muted-foreground">Recent additions</p>
              </div>
              <Link href="/hr/staff">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="p-3">
              <ul className="space-y-1">
                {recentStaff.map(s => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-primary/4 transition-colors cursor-default">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {s.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{s.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={cn(
                      "text-[10px] font-bold",
                      s.role === "TEACHER"      && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                      s.role === "SCHOOL_ADMIN" && "bg-violet-50  text-violet-700  border border-violet-200",
                      s.role === "STAFF"        && "bg-slate-50   text-slate-600   border border-slate-200",
                    )}>
                      {ROLE_LABEL[s.role] ?? s.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payroll summary panel */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
              <div>
                <p className="font-semibold text-sm">Payroll Summary</p>
                <p className="text-xs text-muted-foreground">Monthly breakdown</p>
              </div>
              <Link href="/hr/payroll">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-primary cursor-pointer">
                  Manage <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100/80">
                <span className="text-sm text-muted-foreground">Total monthly gross</span>
                <span className="font-bold text-sm tabular-nums">
                  Rs. {stats.totalMonthlyPayroll.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-100/80">
                <span className="text-sm text-muted-foreground">Staff with payroll</span>
                <span className="font-bold text-sm tabular-nums">
                  {stats.payrollConfigured} / {stats.total}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">Avg. salary</span>
                <span className="font-bold text-sm tabular-nums">
                  {stats.payrollConfigured > 0
                    ? `Rs. ${Math.round(stats.totalMonthlyPayroll / stats.payrollConfigured).toLocaleString()}`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning: unconfigured payroll */}
      {!isEmpty && stats.payrollConfigured < stats.total && (
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-5">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Payroll not configured for all staff</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                {stats.total - stats.payrollConfigured} staff member{stats.total - stats.payrollConfigured !== 1 ? "s" : ""} don&apos;t have a payroll structure yet.
              </p>
              <Link href="/hr/payroll" className="inline-block mt-3">
                <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 cursor-pointer">
                  Configure Payroll
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
