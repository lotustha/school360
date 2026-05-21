import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getStaff } from "@/actions/hr"
import { Badge } from "@/components/ui/badge"
import { Wallet, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Payroll" }

export default async function PayrollPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const staff = await getStaff(school.id)
  const configured = staff.filter(s => s.baseSalary != null)
  const total = configured.reduce((sum, s) => sum + (s.baseSalary ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Monthly Gross",   value: `Rs. ${total.toLocaleString()}`, sub: "Total payroll" },
          { label: "Staff Enrolled",  value: `${configured.length} / ${staff.length}`,  sub: "Payroll configured" },
          { label: "Avg. Salary",     value: configured.length > 0 ? `Rs. ${Math.round(total / configured.length).toLocaleString()}` : "—", sub: "Per staff member" },
        ].map(card => (
          <div key={card.label} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Staff payroll table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-white/60">
          <p className="font-semibold text-sm">Payroll Structures</p>
          <p className="text-xs text-muted-foreground">Monthly base salary per staff member</p>
        </div>
        <div className="divide-y divide-slate-100/60">
          {staff.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">No staff added yet.</p>
            </div>
          ) : (
            staff.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-primary/3 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {s.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">{s.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.ssfEnabled && (
                    <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">SSF</Badge>
                  )}
                  {s.baseSalary != null ? (
                    <span className="font-mono font-bold text-sm tabular-nums">
                      Rs. {s.baseSalary.toLocaleString()}
                    </span>
                  ) : (
                    <span className={cn(
                      "flex items-center gap-1 text-xs text-amber-600"
                    )}>
                      <AlertCircle className="w-3.5 h-3.5" /> Not set
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
