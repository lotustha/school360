"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, CheckCircle2, Lock, ArrowRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { formatBS, fiscalYearOf } from "@/lib/nepali-date"
import { executeYearEndClose, type YearEndPreview } from "@/actions/accounting/year-end"
import { createFiscalYear, setCurrentFiscalYear } from "@/actions/accounting/fiscal-years"

interface FY  { id: string; name: string; startBS: string; endBS: string; status: string; isCurrent: boolean }

export function YearEndWizard({ preview, allFiscalYears }: { preview: YearEndPreview; allFiscalYears: FY[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState(false)

  // For "create next FY" sub-form when none exists
  const [nextSeedBS, setNextSeedBS] = useState(() => {
    // Default to a day after this FY ends to land in the next FY
    const [y, m] = preview.fiscalYearName.split("/").map(s => parseInt(s, 10))
    if (!isNaN(y)) return `${y + 1}-04-01`
    return ""
  })
  const nextFyPreview = (() => { try { return fiscalYearOf(nextSeedBS) } catch { return null } })()

  const blocked =
    preview.status !== "OPEN" ||
    !preview.nextFiscalYearId

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Year-End Close · FY {preview.fiscalYearName}</h1>
          <p className="text-sm text-muted-foreground">Posts a closing JV (Dr Income · Cr Expense · Capital Fund offset) and rolls Asset / Liability / Capital balances to next FY.</p>
        </div>
        <Badge variant="outline" className={cn(
          "text-xs font-bold",
          preview.status === "OPEN"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
          preview.status === "CLOSED" && "bg-amber-50 text-amber-700 border-amber-200",
        )}>{preview.status}</Badge>
      </div>

      {/* Already closed */}
      {preview.status !== "OPEN" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">This fiscal year is already <strong>{preview.status}</strong>. The closing JV is in /accounting/vouchers.</p>
        </div>
      )}

      {/* Next FY missing */}
      {!preview.nextFiscalYearId && preview.status === "OPEN" && (
        <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">Next fiscal year is required before closing</p>
              <p className="text-xs text-amber-700 mt-1">Carry-forward opening balances need somewhere to land. Create the next FY below, then come back to close.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 items-end pt-2 border-t border-amber-200">
            <div>
              <label className="text-xs font-semibold text-amber-900 mb-1.5 block">A date inside the next FY (BS)</label>
              <NepaliDateInput value={nextSeedBS} onChange={setNextSeedBS} />
            </div>
            {nextFyPreview && (
              <div className="bg-white/70 border border-amber-200 rounded-lg p-2.5">
                <p className="text-[10px] uppercase tracking-widest font-black text-amber-700">Will create</p>
                <p className="text-base font-bold">FY {nextFyPreview.name}</p>
                <p className="text-[11px] text-slate-700">{formatBS(nextFyPreview.startBS)} – {formatBS(nextFyPreview.endBS)}</p>
              </div>
            )}
            <Button
              disabled={pending || !nextFyPreview}
              onClick={() => start(async () => {
                try {
                  const fy = await createFiscalYear({ startBS: nextSeedBS })
                  toast.success(`Created FY ${fy.name}`)
                  router.refresh()
                } catch (e) { toast.error((e as Error).message) }
              })}
              className="cursor-pointer gap-1.5"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Next FY
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={preview.isSurplus ? "Surplus" : "Deficit"} value={`Rs. ${preview.surplusSigned}`} color={preview.isSurplus ? "emerald" : "rose"} />
        <Stat label="Closing JV total" value={`Rs. ${preview.closingTotalDr}`} color="slate" sub={preview.closingTotalDr === preview.closingTotalCr ? "Balanced" : "Off"} />
        <Stat label="Opening balances to roll forward" value={`${preview.rollForward.length} accounts`} color="violet"
          sub={preview.nextFiscalYearName ? `→ FY ${preview.nextFiscalYearName}` : "Next FY not set"} />
      </div>

      {/* AR carry-forward warning — surfaced before close so the accountant
          knows uncollected fees will follow the student into next year. */}
      {parseFloat(preview.arOutstanding) > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 backdrop-blur-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-700 text-base font-black">!</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Rs. {preview.arOutstanding} of student fees are still outstanding ({preview.arUnpaidRowCount} bill{preview.arUnpaidRowCount === 1 ? "" : "s"})
            </p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              These will carry forward into {preview.nextFiscalYearName ? `FY ${preview.nextFiscalYearName}` : "the next FY"} as
              Accounts Receivable. You can still collect them from the parents next year. If any are uncollectable,
              write them off in <a href="/finance/students" className="underline font-bold">/finance/students</a> before
              closing — that way the loss is recognized in this FY&apos;s income statement, not next year&apos;s.
            </p>
          </div>
        </div>
      )}

      {/* Closing JV preview */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60">
          <p className="font-semibold text-sm">Closing Journal Voucher (preview)</p>
          <p className="text-xs text-muted-foreground">Will be posted on {formatBS(preview.closingLines.length > 0 ? "" : "")} the last day of FY {preview.fiscalYearName}.</p>
        </div>
        {preview.closingLines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No income or expense activity — nothing to close.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left w-20">Code</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left w-24">Type</th>
                <th className="px-4 py-3 text-right w-32">Debit (Rs.)</th>
                <th className="px-4 py-3 text-right w-32">Credit (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {preview.closingLines.map(l => (
                <tr key={l.accountId} className={cn(
                  l.type === "EQUITY" && "bg-violet-50/40 font-semibold",
                )}>
                  <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                  <td className="px-4 py-2">{l.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{l.type}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(l.debit) > 0 ? l.debit : ""}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(l.credit) > 0 ? l.credit : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/60 font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{preview.closingTotalDr}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{preview.closingTotalCr}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Roll-forward */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between">
          <p className="font-semibold text-sm">Opening balances → FY {preview.nextFiscalYearName ?? "(next)"}</p>
          <span className="text-[10px] font-bold text-slate-500">Asset / Liability / Capital Fund only</span>
        </div>
        {preview.rollForward.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No carry-forward balances.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left w-20">Code</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left w-24">Type</th>
                <th className="px-4 py-3 text-right w-32">Debit (Rs.)</th>
                <th className="px-4 py-3 text-right w-32">Credit (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {preview.rollForward.map(r => (
                <tr key={r.accountId}>
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.type}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.debit) > 0 ? r.debit : ""}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{parseFloat(r.credit) > 0 ? r.credit : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/60 font-bold">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{preview.rollForwardTotalDr}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{preview.rollForwardTotalCr}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Execute */}
      {!blocked && (
        <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-amber-900">This is a one-way action.</p>
              <p className="text-amber-800 mt-1">Closing posts an immutable JV, writes opening balances into FY {preview.nextFiscalYearName}, and marks FY {preview.fiscalYearName} as <strong>CLOSED</strong>. After closing, no new vouchers can be posted to this FY.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="cursor-pointer" />
            I&apos;ve reviewed the closing JV and opening balances above. Proceed with closing.
          </label>
          <div className="flex justify-end gap-2">
            <Link href="/accounting/fiscal-years">
              <Button variant="outline" disabled={pending} className="cursor-pointer">Cancel</Button>
            </Link>
            <Button
              disabled={pending || !confirm}
              onClick={() => start(async () => {
                try {
                  const res = await executeYearEndClose(preview.fiscalYearId)
                  toast.success(`Closed — JV ${res.closingVoucherNumber}, ${res.openingBalancesWritten} balances rolled to next FY`)
                  router.push(`/accounting/vouchers/${res.closingVoucherId}`)
                } catch (e) { toast.error((e as Error).message) }
              })}
              className="cursor-pointer gap-1.5 shadow-md shadow-primary/30"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Close FY {preview.fiscalYearName} &amp; Roll Forward
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Existing FYs link */}
      <div className="text-xs text-muted-foreground text-center">
        {allFiscalYears.length} fiscal year{allFiscalYears.length === 1 ? "" : "s"} on record. <Link href="/accounting/fiscal-years" className="text-primary font-bold hover:underline">Manage →</Link>
      </div>
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: "emerald" | "rose" | "slate" | "violet"; sub?: string }) {
  const palette = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
    slate:   { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
  }[color]
  return (
    <div className={cn("rounded-xl border p-4", palette.bg, palette.border)}>
      <p className={cn("text-[10px] uppercase tracking-widest font-black", palette.text)}>{label}</p>
      <p className={cn("text-xl font-bold mt-1 font-mono tabular-nums", palette.text)}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}
