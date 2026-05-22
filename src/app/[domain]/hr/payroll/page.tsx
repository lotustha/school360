import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Plus, Wallet, AlertCircle, Printer, FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getStaff } from "@/actions/hr"
import { listPayrollRuns } from "@/actions/accounting/payroll-runs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatBS } from "@/lib/nepali-date"

export const metadata: Metadata = { title: "Payroll" }

export default async function PayrollPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [staff, runs] = await Promise.all([getStaff(school.id), listPayrollRuns()])
  const configured = staff.filter(s => s.baseSalary != null)
  const total = configured.reduce((sum, s) => sum + (s.baseSalary ?? 0), 0)
  const runsTotal = runs.reduce((a, r) => a + parseFloat(r.totalGross), 0)

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Configured Gross",  value: `Rs. ${total.toLocaleString()}`, sub: "Per-month total" },
          { label: "Staff Enrolled",    value: `${configured.length} / ${staff.length}`, sub: "Payroll configured" },
          { label: "Posted YTD",        value: `Rs. ${runsTotal.toLocaleString()}`, sub: `${runs.length} run${runs.length === 1 ? "" : "s"}` },
        ].map(card => (
          <div key={card.label} className={cn(
            "bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5",
          )}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-amber-500/8">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums">{card.value}</div>
            <div className="text-sm font-semibold mt-0.5">{card.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Warning if some staff have no payroll structure */}
      {configured.length < staff.length && (
        <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            {staff.length - configured.length} staff member{staff.length - configured.length !== 1 ? "s have" : " has"} no payroll structure.
            They&apos;ll be skipped in the run form. <Link href="/hr/staff" className="underline font-bold">Configure →</Link>
          </div>
        </div>
      )}

      {/* Runs list */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
          <div>
            <p className="font-semibold text-sm">Payroll Runs</p>
            <p className="text-xs text-muted-foreground">Each run posts one Payment Voucher with TDS + SSF + net split</p>
          </div>
          <Link href="/hr/payroll/new">
            <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
              <Plus className="w-4 h-4" /> Run Payroll
            </Button>
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-4">No payroll runs yet.</p>
            <Link href="/hr/payroll/new">
              <Button className="gap-1.5 cursor-pointer">
                <Plus className="w-4 h-4" /> Run First Payroll
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Run #</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Date (BS)</th>
                <th className="px-4 py-3 text-center w-16">Staff</th>
                <th className="px-4 py-3 text-right w-28">Gross</th>
                <th className="px-4 py-3 text-right w-28">TDS</th>
                <th className="px-4 py-3 text-right w-28">SSF</th>
                <th className="px-4 py-3 text-right w-28">Net</th>
                <th className="px-4 py-3 text-left w-28">Voucher</th>
                <th className="px-4 py-3 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {runs.map(r => (
                <tr key={r.id} className="hover:bg-primary/4">
                  <td className="px-4 py-2">
                    <Link href={`/hr/payroll/${r.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                      {r.runNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-semibold">{r.periodLabel}</td>
                  <td className="px-4 py-2 text-xs">{formatBS(r.dateBS)}</td>
                  <td className="px-4 py-2 text-center text-xs">{r.employeeCount}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{r.totalGross}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{r.totalTds}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-violet-700">{r.totalSsf}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-bold text-emerald-700">{r.totalNet}</td>
                  <td className="px-4 py-2">
                    {r.voucherId && (
                      <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono text-xs text-primary hover:underline">
                        {r.voucherNumber}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/hr/payroll/${r.id}/print`} target="_blank">
                      <Button size="sm" variant="ghost" className="cursor-pointer text-xs h-7 gap-1">
                        <Printer className="w-3 h-3" /> Print
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

