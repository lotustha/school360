import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getVoucher } from "@/actions/accounting/vouchers"
import { listAccounts } from "@/actions/accounting/accounts"
import { VOUCHER_TYPE_LABEL, type VoucherType } from "@/lib/accounting"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { VoucherForm } from "@/components/accounting/voucher-form"
import { VoucherActions } from "./voucher-actions"

export const metadata: Metadata = { title: "Voucher" }

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const v = await getVoucher(id)
  if (!v) notFound()

  // Draft → editable form. Posted/Reversed → read-only detail view.
  if (v.status === "DRAFT") {
    const accounts = await listAccounts()
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-600" />
            Edit Draft {VOUCHER_TYPE_LABEL[v.type as VoucherType]}
          </h1>
          <Link href="/accounting/vouchers">
            <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
        </div>
        <VoucherForm
          type={v.type as VoucherType}
          fiscalYearId={v.fiscalYearId}
          fiscalYearName={v.fiscalYear.name}
          accounts={accounts.map(a => ({
            id: a.id, code: a.code, name: a.name, type: a.type, subType: a.subType, isActive: a.isActive,
          }))}
          initial={{
            id: v.id, type: v.type as VoucherType, fiscalYearId: v.fiscalYearId,
            dateBS: v.dateBS, narration: v.narration,
            partyType: v.partyType as never, partyName: v.partyName, panNumber: v.panNumber,
            vatTaxable: v.vatTaxable?.toString() ?? null,
            vatAmount:  v.vatAmount?.toString()  ?? null,
            tdsBase:    v.tdsBase?.toString()    ?? null,
            tdsPercent: v.tdsPercent?.toString() ?? null,
            tdsAmount:  v.tdsAmount?.toString()  ?? null,
            lines: v.lines.map(l => ({
              accountId: l.accountId,
              debit:     l.debit.toString(),
              credit:    l.credit.toString(),
              narration: l.narration,
            })),
          }}
        />
      </div>
    )
  }

  // Posted / Reversed — read-only
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/accounting/vouchers" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All vouchers
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            {v.number}
            <span className="text-base text-muted-foreground font-normal ml-2">{VOUCHER_TYPE_LABEL[v.type as VoucherType]}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "text-xs font-bold",
            v.status === "POSTED"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
            v.status === "REVERSED" && "bg-slate-100 text-slate-600 border-slate-300",
          )}>{v.status}</Badge>
          <Link href={`/accounting/vouchers/${v.id}/print`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
          {v.status === "POSTED" && !v.reversedBy && (
            <VoucherActions voucherId={v.id} number={v.number ?? ""} />
          )}
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4">
        <div className="grid sm:grid-cols-4 gap-4 text-sm">
          <Info label="Date (BS)" value={formatBS(v.dateBS)} />
          <Info label="Fiscal Year" value={v.fiscalYear.name} />
          <Info label="Party" value={v.partyName || v.partyType || "—"} />
          <Info label="PAN" value={v.panNumber || "—"} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Narration</p>
          <p className="text-sm mt-1">{v.narration}</p>
        </div>

        {(v.vatAmount || v.tdsAmount) && (
          <div className="grid sm:grid-cols-3 gap-3 text-xs bg-slate-50/60 border border-slate-200 rounded-lg p-3">
            {v.vatAmount && <Info label="VAT (13%)" value={`Rs. ${v.vatAmount.toFixed(2)}`} />}
            {v.tdsAmount && <Info label={`TDS @ ${v.tdsPercent?.toFixed(2) ?? "?"}%`} value={`Rs. ${v.tdsAmount.toFixed(2)}`} />}
            {v.tdsBase && <Info label="TDS base" value={`Rs. ${v.tdsBase.toFixed(2)}`} />}
          </div>
        )}

        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Narration</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {v.lines.map(l => (
              <tr key={l.id}>
                <td className="px-3 py-2"><span className="font-mono text-xs text-slate-500">{l.account.code}</span> · {l.account.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{l.narration ?? ""}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{l.debit.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{l.credit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{v.totalAmount.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{v.totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        {v.reversalOf && (
          <p className="text-xs text-slate-600">
            ↪ Reversal of <Link href={`/accounting/vouchers/${v.reversalOf.id}`} className="font-mono font-bold text-primary hover:underline">{v.reversalOf.number}</Link>
          </p>
        )}
        {v.reversedBy && (
          <p className="text-xs text-slate-600">
            ↩ Reversed by <Link href={`/accounting/vouchers/${v.reversedBy.id}`} className="font-mono font-bold text-primary hover:underline">{v.reversedBy.number}</Link>
          </p>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}
