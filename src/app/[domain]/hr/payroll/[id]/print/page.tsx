import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getPayrollRun } from "@/actions/accounting/payroll-runs"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

export default async function Print({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const [school, r] = await Promise.all([
    prisma.school.findUnique({
      where: { slug: domain },
      select: { name: true, address: true, panNumber: true },
    }),
    getPayrollRun(id),
  ])
  if (!school || !r) notFound()

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Salary Register"
      subtitle={`${r.runNumber} · ${r.periodLabel} · Date: ${formatBS(r.dateBS)}`}
      landscape
    >
      <table className="w-full text-sm border border-slate-400">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-400">
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-8">#</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Employee</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-24">PAN</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-24">Role</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Gross (Rs.)</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">TDS</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">SSF</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">PF</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">CIT</th>
            <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Net Paid</th>
            <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-32">Signature</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={l.employeeId} className="border-b border-slate-200">
              <td className="px-2 py-1.5 font-mono text-xs text-slate-400">{i + 1}</td>
              <td className="px-2 py-1.5"><strong>{l.employeeName}</strong></td>
              <td className="px-2 py-1.5 font-mono text-xs">{l.panNumber ?? ""}</td>
              <td className="px-2 py-1.5 text-xs">{l.role}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{l.gross}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.tds) > 0 ? l.tds : ""}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.ssf) > 0 ? l.ssf : ""}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.pf) > 0 ? l.pf : ""}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.cit) > 0 ? l.cit : ""}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums font-bold">{l.net}</td>
              <td className="px-2 py-1.5"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
            <td colSpan={4} className="px-2 py-1.5 text-right">Totals</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalGross}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalTds}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalSsf}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalPf}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalCit}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.totalNet}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className="grid grid-cols-3 gap-12 pt-12 text-center text-xs">
        <div><div className="border-t border-slate-400 pt-1">Prepared by</div></div>
        <div><div className="border-t border-slate-400 pt-1">Checked by</div></div>
        <div><div className="border-t border-slate-400 pt-1">Authorised by</div></div>
      </div>

      <p className="text-[10px] text-slate-500 mt-4">
        GL Voucher: <span className="font-mono">{r.voucherNumber ?? "—"}</span>
        {" · "}Paid via {r.paymentMethod}{r.bankName ? ` (${r.bankName})` : ""}
        {(parseFloat(r.totalPfEmployer) > 0 || parseFloat(r.totalCitEmployer) > 0) &&
          ` · Employer contribution: PF Rs. ${r.totalPfEmployer}, CIT Rs. ${r.totalCitEmployer}`}
      </p>
    </ReportPrintShell>
  )
}
