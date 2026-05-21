import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { getTrialBalance } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { ReportExportButton } from "@/components/accounting/report-export-button"

export const metadata: Metadata = { title: "Trial Balance" }

export default async function TrialBalancePage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; asOf?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")

  const fyId = sp.fy ?? current?.id ?? fys[0]?.id
  if (!fyId) redirect("/accounting/setup")

  const tb = await getTrialBalance(fyId, sp.asOf)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
        <div className="flex items-center gap-2">
          <form action="" className="flex items-center gap-2">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            <Button type="submit" size="sm" variant="outline" className="cursor-pointer text-xs">Apply</Button>
          </form>
          <ReportExportButton kind="trial-balance" data={tb} schoolName={school.name} />
          <Link href={`/accounting/reports/trial-balance/print?fy=${fyId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm">
            <span className="font-semibold">As at:</span> <span className="font-mono">{formatBS(tb.asOfBS)}</span>
          </p>
          <span className={cn(
            "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md",
            tb.balanced ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200",
          )}>
            {tb.balanced ? <><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</> : <><XCircle className="w-3.5 h-3.5" /> NOT balanced</>}
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-4 py-3 text-left w-24">Code</th>
              <th className="px-4 py-3 text-left">Account</th>
              <th className="px-4 py-3 text-left w-24">Type</th>
              <th className="px-4 py-3 text-right w-32">Debit (Rs.)</th>
              <th className="px-4 py-3 text-right w-32">Credit (Rs.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {tb.rows.map(r => (
              <tr key={r.accountId} className="hover:bg-primary/4 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-2">
                  <Link href={`/accounting/ledger?account=${r.accountId}&fy=${fyId}`} className="hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.type}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
              </tr>
            ))}
            {tb.rows.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-sm text-muted-foreground">No postings yet.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{tb.totalDebit}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{tb.totalCredit}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
