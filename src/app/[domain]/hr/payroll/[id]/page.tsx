import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPayrollRun } from "@/actions/accounting/payroll-runs"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Payroll Run" }

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const r = await getPayrollRun(id)
  if (!r) notFound()

  return (
    <div className="space-y-5">
      <Link href="/hr/payroll" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> All runs
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {r.runNumber}
            <span className="text-base text-muted-foreground font-normal ml-2">{r.periodLabel}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Date: {formatBS(r.dateBS)} · Paid via {r.paymentMethod}{r.bankName ? ` · ${r.bankName}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "text-xs font-bold",
            r.status === "POSTED" && "bg-emerald-50 text-emerald-700 border-emerald-200",
          )}>{r.status}</Badge>
          {r.voucherId && (
            <Link href={`/accounting/vouchers/${r.voucherId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer text-xs">
                <span className="font-mono">{r.voucherNumber}</span>
              </Button>
            </Link>
          )}
          <Link href={`/hr/payroll/${r.id}/print`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total Gross" value={`Rs. ${r.totalGross}`} color="slate" />
        <Stat label="TDS"        value={`Rs. ${r.totalTds}`}   color="rose" />
        <Stat label="SSF"        value={`Rs. ${r.totalSsf}`}   color="violet" />
        <Stat label="PF"         value={`Rs. ${r.totalPf}`}    color="indigo" />
        <Stat label="CIT"        value={`Rs. ${r.totalCit}`}   color="indigo" />
        <Stat label="Net Paid"   value={`Rs. ${r.totalNet}`}   color="emerald" />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60">
          <p className="font-semibold text-sm">Salary Register</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left w-24">PAN</th>
              <th className="px-4 py-3 text-right w-24">Gross</th>
              <th className="px-4 py-3 text-right w-20">TDS</th>
              <th className="px-4 py-3 text-right w-20">SSF</th>
              <th className="px-4 py-3 text-right w-20">PF</th>
              <th className="px-4 py-3 text-right w-20" title="Employer PF match">PF (Er)</th>
              <th className="px-4 py-3 text-right w-20">CIT</th>
              <th className="px-4 py-3 text-right w-20" title="Employer CIT contribution">CIT (Er)</th>
              <th className="px-4 py-3 text-right w-24">Net</th>
              <th className="px-4 py-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {r.lines.map(l => (
              <tr key={l.employeeId} className="hover:bg-primary/4">
                <td className="px-4 py-2">
                  <p className="font-semibold">{l.employeeName}</p>
                  <p className="text-[11px] text-muted-foreground">{l.role}</p>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{l.panNumber ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{l.gross}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{parseFloat(l.tds) > 0 ? l.tds : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-violet-700">{parseFloat(l.ssf) > 0 ? l.ssf : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-indigo-700">{parseFloat(l.pf) > 0 ? l.pf : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">{parseFloat(l.pfEmployer) > 0 ? l.pfEmployer : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-indigo-700">{parseFloat(l.cit) > 0 ? l.cit : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-400">{parseFloat(l.citEmployer) > 0 ? l.citEmployer : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums font-bold text-emerald-700">{l.net}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{l.remarks ?? ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.totalGross}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-700">{r.totalTds}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-violet-700">{r.totalSsf}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-indigo-700">{r.totalPf}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">{r.totalPfEmployer}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-indigo-700">{r.totalCit}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">{r.totalCitEmployer}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{r.totalNet}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {(parseFloat(r.totalPfEmployer) > 0 || parseFloat(r.totalCitEmployer) > 0) && (
        <p className="text-xs text-muted-foreground">
          Employer contribution (extra cost, not deducted from net): PF Rs. {r.totalPfEmployer} · CIT Rs. {r.totalCitEmployer} — posted to <strong>Employer Contributions</strong> expense.
        </p>
      )}

      {r.notes && (
        <div className="bg-slate-50/60 border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Notes</p>
          <p className="text-sm mt-1">{r.notes}</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: "slate" | "rose" | "violet" | "emerald" | "indigo" }) {
  const palette = {
    slate:   { bg: "bg-slate-100",   text: "text-slate-700" },
    rose:    { bg: "bg-rose-50",     text: "text-rose-700"  },
    violet:  { bg: "bg-violet-50",   text: "text-violet-700"},
    emerald: { bg: "bg-emerald-50",  text: "text-emerald-700"},
    indigo:  { bg: "bg-indigo-50",   text: "text-indigo-700"},
  }[color]
  return (
    <div className={cn("rounded-xl border border-white/40 shadow-sm p-4", palette.bg)}>
      <p className={cn("text-[10px] uppercase tracking-widest font-black", palette.text)}>{label}</p>
      <p className={cn("text-xl font-bold mt-1 font-mono", palette.text)}>{value}</p>
    </div>
  )
}
