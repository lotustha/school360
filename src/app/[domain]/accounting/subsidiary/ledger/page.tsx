import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPartyLedger, type PartyKind } from "@/actions/accounting/subsidiary-ledger"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"

export const metadata: Metadata = { title: "Party Ledger" }

const VALID_TYPES: PartyKind[] = ["STUDENT", "EMPLOYEE", "VENDOR", "OTHER"]

export default async function PartyLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; name?: string; fy?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  if (!sp.name) notFound()
  const kind = (sp.type as PartyKind) ?? "VENDOR"
  if (!VALID_TYPES.includes(kind)) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const ledger = await getPartyLedger(kind, sp.name, fyId, sp.from, sp.to)

  return (
    <div className="space-y-5">
      <Link href={`/accounting/subsidiary?type=${kind}&fy=${fyId}`} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> All {kind.toLowerCase()}s
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{ledger.partyName}</h1>
          <p className="text-xs text-muted-foreground">{kind} ledger · {ledger.rows.length} entries</p>
        </div>
        <Badge variant="outline" className={cn(
          "font-mono text-sm",
          parseFloat(ledger.closingBalance) > 0  && "bg-emerald-50 text-emerald-700 border-emerald-200",
          parseFloat(ledger.closingBalance) < 0  && "bg-rose-50 text-rose-700 border-rose-200",
        )}>
          Closing: Rs. {Math.abs(parseFloat(ledger.closingBalance)).toFixed(2)} {parseFloat(ledger.closingBalance) > 0 ? "Dr" : parseFloat(ledger.closingBalance) < 0 ? "Cr" : ""}
        </Badge>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-4 py-3 text-left w-32">Date (BS)</th>
              <th className="px-4 py-3 text-left w-36">Voucher</th>
              <th className="px-4 py-3 text-left">Account · Narration</th>
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
                <td className="px-4 py-2 text-xs">
                  <span className="font-mono text-slate-500">{r.accountCode}</span>{" "}
                  · {r.accountName}
                  <span className="block text-[11px] text-muted-foreground">{r.narration}</span>
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{r.running}</td>
              </tr>
            ))}
            {ledger.rows.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No activity in this period.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{ledger.totalDebit}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{ledger.totalCredit}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{ledger.closingBalance}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
