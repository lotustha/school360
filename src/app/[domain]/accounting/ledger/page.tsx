import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { listAccounts } from "@/actions/accounting/accounts"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { getAccountLedger } from "@/actions/accounting/reports"
import { formatBS } from "@/lib/nepali-date"

export const metadata: Metadata = { title: "Ledger" }

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; fy?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")

  const fyId = sp.fy ?? current?.id ?? fys[0]?.id
  const accounts = await listAccounts()
  const accountId = sp.account ?? null

  const ledger = accountId ? await getAccountLedger(accountId, fyId!) : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
        <form className="flex items-center gap-2">
          <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
          </select>
          <select name="account" defaultValue={accountId ?? ""} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white min-w-[260px]">
            <option value="">— Select account —</option>
            {accounts.filter(a => a.isActive).map(a => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </select>
          <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md text-xs font-bold cursor-pointer">Open</button>
        </form>
      </div>

      {!ledger ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-10 text-center text-sm text-muted-foreground">
          Pick an account to view its ledger.
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-white/60">
            <p className="text-sm font-bold">
              <span className="font-mono text-xs text-slate-500">{ledger.code}</span> · {ledger.name}
              <span className="ml-3 text-xs text-muted-foreground font-normal">({ledger.type})</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opening: Dr {ledger.openingDebit} / Cr {ledger.openingCredit}
              <span className="ml-3">·  Closing: <strong className="font-mono">{ledger.closingBalance}</strong></span>
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left w-32">Date (BS)</th>
                <th className="px-4 py-3 text-left w-36">Voucher</th>
                <th className="px-4 py-3 text-left">Narration</th>
                <th className="px-4 py-3 text-right w-28">Debit</th>
                <th className="px-4 py-3 text-right w-28">Credit</th>
                <th className="px-4 py-3 text-right w-32">Running</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {ledger.rows.map((r, i) => (
                <tr key={i} className="hover:bg-primary/4">
                  <td className="px-4 py-2 text-xs">{formatBS(r.dateBS)}</td>
                  <td className="px-4 py-2 text-xs">
                    <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono font-bold text-primary hover:underline">
                      {r.voucherNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{r.narration}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-bold">{r.running}</td>
                </tr>
              ))}
              {ledger.rows.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No activity in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
