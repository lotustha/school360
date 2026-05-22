import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getBankReconciliation } from "@/actions/accounting/bank-reconciliation"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS, todayBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

export default async function Print({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ account?: string; asOf?: string; stmt?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  if (!sp.account) notFound()

  const [school, rec] = await Promise.all([
    prisma.school.findUnique({
      where: { slug: domain },
      select: { name: true, address: true, panNumber: true },
    }),
    getBankReconciliation(sp.account, sp.asOf ?? todayBS()),
  ])
  if (!school) notFound()

  const stmtBalance = sp.stmt ? parseFloat(sp.stmt) || 0 : null
  const expected = parseFloat(rec.expectedStatementBalance)
  const diff = stmtBalance !== null ? stmtBalance - expected : null
  const reconciled = diff !== null && Math.abs(diff) < 0.005

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Bank Reconciliation Statement"
      subtitle={`${rec.accountCode} · ${rec.accountName}${rec.bankName ? " · " + rec.bankName : ""} · As at ${formatBS(sp.asOf ?? todayBS())}`}
    >
      <div className="max-w-2xl mx-auto">
        <table className="w-full text-sm border border-slate-400">
          <tbody>
            <PrintLine label="Balance as per Bank Book (closing)" value={rec.bookBalance} bold />
            <PrintLine label="Less: Uncleared deposits (in book, not yet in statement)" value={"(" + rec.unclearedDeposits + ")"} />
            <PrintLine label="Add: Uncleared withdrawals (in book, not yet in statement)" value={rec.unclearedWithdrawals} />
            <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
              <td className="px-3 py-2">Expected balance as per Bank Statement</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">Rs. {rec.expectedStatementBalance}</td>
            </tr>
            {stmtBalance !== null && (
              <>
                <PrintLine label="Actual balance as per Bank Statement" value={stmtBalance.toFixed(2)} bold />
                <tr className={reconciled ? "bg-emerald-50 border-t border-slate-400 font-bold" : "bg-rose-50 border-t border-slate-400 font-bold"}>
                  <td className="px-3 py-2">{reconciled ? "✓ Reconciled" : "Unreconciled difference"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {reconciled ? "Rs. 0.00" : `Rs. ${(diff!).toFixed(2)}`}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Uncleared list (always shown for transparency) */}
        {(parseFloat(rec.unclearedDeposits) > 0 || parseFloat(rec.unclearedWithdrawals) > 0) && (
          <>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-6 mb-2">Uncleared items</p>
            <table className="w-full text-xs border border-slate-400">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400">
                  <th className="px-2 py-1 text-left w-20">Date (BS)</th>
                  <th className="px-2 py-1 text-left w-24">Voucher</th>
                  <th className="px-2 py-1 text-left">Narration</th>
                  <th className="px-2 py-1 text-right w-20">Deposit</th>
                  <th className="px-2 py-1 text-right w-20">Withdrawal</th>
                </tr>
              </thead>
              <tbody>
                {rec.rows.filter(r => !r.cleared).map(r => (
                  <tr key={r.id} className="border-b border-slate-200">
                    <td className="px-2 py-1">{formatBS(r.dateBS)}</td>
                    <td className="px-2 py-1 font-mono">{r.voucherNumber ?? "—"}</td>
                    <td className="px-2 py-1">{r.narration}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="grid grid-cols-2 gap-12 pt-12 mt-8 text-center text-xs">
          <div><div className="border-t border-slate-400 pt-1">Prepared by</div></div>
          <div><div className="border-t border-slate-400 pt-1">Authorised by</div></div>
        </div>
      </div>
    </ReportPrintShell>
  )
}

function PrintLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={"border-b border-slate-200 " + (bold ? "font-bold" : "")}>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{value}</td>
    </tr>
  )
}
