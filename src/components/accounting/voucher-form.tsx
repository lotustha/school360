"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Save, CheckCircle2, Loader2, AlertCircle, Calculator } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { PartyAutocomplete } from "@/components/accounting/party-autocomplete"
import { AccountPicker } from "@/components/accounting/account-picker"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import {
  createDraftVoucher, updateDraftVoucher, postVoucher,
} from "@/actions/accounting/vouchers"
import {
  VOUCHER_TYPE_LABEL, CONTRA_SUBTYPES,
  type VoucherType, type PartyType,
} from "@/lib/accounting"

interface Account {
  id:       string
  code:     string
  name:     string
  type:     string
  subType:  string | null
  isActive: boolean
}

interface Line {
  accountId: string
  debit:     string
  credit:    string
  narration: string
}

export interface VoucherFormInitial {
  id?:          string
  type:         VoucherType
  fiscalYearId: string
  dateBS?:      string
  narration?:   string
  partyType?:   PartyType | null
  partyId?:     string | null
  partyName?:   string | null
  panNumber?:   string | null
  vatTaxable?:  string | null
  vatAmount?:   string | null
  tdsBase?:     string | null
  tdsPercent?:  string | null
  tdsAmount?:   string | null
  lines?: Array<{ accountId: string; debit: string; credit: string; narration?: string | null }>
}

interface Props {
  type:         VoucherType
  fiscalYearId: string
  fiscalYearName: string
  accounts:     Account[]
  initial?:     VoucherFormInitial
}

const EMPTY_LINE: Line = { accountId: "", debit: "", credit: "", narration: "" }

export function VoucherForm({ type, fiscalYearId, fiscalYearName, accounts, initial }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const isEdit = !!initial?.id

  // ─── Form state ────────────────────────────────────────────────────────
  const [dateBS, setDateBS]       = useState(initial?.dateBS ?? todayBS())
  const [narration, setNarration] = useState(initial?.narration ?? "")
  const [partyType, setPartyType] = useState<PartyType | "">(initial?.partyType ?? "")
  const [partyName, setPartyName] = useState(initial?.partyName ?? "")
  const [panNumber, setPanNumber] = useState(initial?.panNumber ?? "")
  const [vatTaxable, setVatTaxable] = useState(initial?.vatTaxable ?? "")
  const [vatAmount,  setVatAmount]  = useState(initial?.vatAmount  ?? "")
  const [tdsBase,    setTdsBase]    = useState(initial?.tdsBase    ?? "")
  const [tdsPercent, setTdsPercent] = useState(initial?.tdsPercent ?? "")
  const [tdsAmount,  setTdsAmount]  = useState(initial?.tdsAmount  ?? "")

  const [lines, setLines] = useState<Line[]>(() =>
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map(l => ({
          accountId: l.accountId,
          debit:     l.debit ?? "",
          credit:    l.credit ?? "",
          narration: l.narration ?? "",
        }))
      : [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
  )

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines(prev => [...prev, { ...EMPTY_LINE }]) }
  function removeLine(idx: number) {
    setLines(prev => prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev)
  }

  // ─── Account filter (Contra restriction) ───────────────────────────────
  const allowedAccounts = useMemo(() => {
    const active = accounts.filter(a => a.isActive)
    if (type === "CV") {
      return active.filter(a => a.subType && CONTRA_SUBTYPES.has(a.subType as never))
    }
    return active
  }, [accounts, type])

  // ─── Balance computation ───────────────────────────────────────────────
  const totals = useMemo(() => {
    let dr = 0, cr = 0
    for (const l of lines) {
      dr += parseFloat(l.debit  || "0") || 0
      cr += parseFloat(l.credit || "0") || 0
    }
    return { dr, cr, diff: dr - cr, balanced: Math.abs(dr - cr) < 0.005 && dr > 0 }
  }, [lines])

  // ─── Auto TDS calc ─────────────────────────────────────────────────────
  function recomputeTdsAmount(base: string, pct: string) {
    const b = parseFloat(base || "0") || 0
    const p = parseFloat(pct  || "0") || 0
    return ((b * p) / 100).toFixed(2)
  }

  function payload() {
    return {
      fiscalYearId,
      type,
      dateBS,
      narration: narration.trim(),
      partyType: (partyType || null) as PartyType | null,
      partyName: partyName.trim() || null,
      panNumber: panNumber.trim() || null,
      vatTaxable: vatTaxable || null,
      vatAmount:  vatAmount  || null,
      tdsBase:    tdsBase    || null,
      tdsPercent: tdsPercent || null,
      tdsAmount:  tdsAmount  || null,
      lines: lines
        .filter(l => l.accountId && (parseFloat(l.debit || "0") || parseFloat(l.credit || "0")))
        .map(l => ({
          accountId: l.accountId,
          debit:     String(parseFloat(l.debit  || "0") || 0),
          credit:    String(parseFloat(l.credit || "0") || 0),
          narration: l.narration.trim() || null,
        })),
    }
  }

  function validate(): string | null {
    if (!narration.trim()) return "Narration is required"
    const p = payload()
    if (p.lines.length < 2) return "At least 2 lines required"
    for (const l of p.lines) {
      const d = parseFloat(l.debit), c = parseFloat(l.credit)
      if (d > 0 && c > 0) return "A line cannot have both debit and credit"
      if (d === 0 && c === 0) return "Each line must have a debit or a credit"
    }
    return null
  }

  async function handleSave(thenPost: boolean) {
    const err = validate()
    if (err) { toast.error(err); return }
    if (thenPost && !totals.balanced) { toast.error("Voucher is not balanced — adjust before posting"); return }

    start(async () => {
      try {
        let id = initial?.id
        if (isEdit && id) {
          await updateDraftVoucher(id, payload())
        } else {
          const v = await createDraftVoucher(payload())
          id = v.id
        }
        if (thenPost) {
          const posted = await postVoucher(id!)
          toast.success(`Voucher posted as ${posted.number}`)
          router.push(`/accounting/vouchers/${id}`)
        } else {
          toast.success("Draft saved")
          if (!isEdit) router.push(`/accounting/vouchers/${id}`)
          else router.refresh()
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{isEdit ? "Edit Draft" : "New Voucher"}</p>
            <p className="text-xl font-bold tracking-tight">{VOUCHER_TYPE_LABEL[type]}</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">FY {fiscalYearName}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date (BS)</label>
            <NepaliDateInput value={dateBS} onChange={setDateBS} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Party type</label>
            <select
              value={partyType}
              onChange={e => setPartyType(e.target.value as PartyType | "")}
              className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              <option value="">— None —</option>
              <option value="STUDENT">Student</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="VENDOR">Vendor</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <PartyAutocomplete
          name={partyName}
          pan={panNumber}
          onPick={({ name, pan }) => { setPartyName(name); setPanNumber(pan) }}
          onNameChange={setPartyName}
          onPanChange={setPanNumber}
          voucherType={type}
        />

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Narration *</label>
          <Input
            value={narration}
            onChange={e => setNarration(e.target.value)}
            placeholder="Reason for this voucher"
          />
        </div>

        {/* VAT / TDS — optional */}
        <details className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40">
          <summary className="px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
            VAT &amp; TDS (optional)
          </summary>
          <div className="p-4 grid sm:grid-cols-3 gap-3 border-t border-slate-200">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">VAT taxable amount</label>
              <Input
                value={vatTaxable}
                onChange={e => {
                  setVatTaxable(e.target.value)
                  const v = parseFloat(e.target.value || "0") || 0
                  setVatAmount((v * 0.13).toFixed(2))
                }}
                placeholder="0.00"
                className="font-mono text-right"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">VAT amount (13%)</label>
              <Input value={vatAmount} onChange={e => setVatAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
            </div>
            <div className="invisible" />

            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">TDS base</label>
              <Input value={tdsBase} onChange={e => { setTdsBase(e.target.value); setTdsAmount(recomputeTdsAmount(e.target.value, tdsPercent)) }} placeholder="0.00" className="font-mono text-right" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">TDS %</label>
              <Input value={tdsPercent} onChange={e => { setTdsPercent(e.target.value); setTdsAmount(recomputeTdsAmount(tdsBase, e.target.value)) }} placeholder="1.5 / 10 / 15" className="font-mono text-right" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">TDS amount</label>
              <Input value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
            </div>
          </div>
        </details>
      </div>

      {/* Line items */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Line items</p>
            <p className="text-xs text-muted-foreground">Σ debits must equal Σ credits</p>
          </div>
          {type === "CV" && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 bg-violet-100 px-2 py-1 rounded-md">
              Contra: Cash / Bank only
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Narration (optional)</th>
              <th className="px-3 py-2 text-right w-32">Debit</th>
              <th className="px-3 py-2 text-right w-32">Credit</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-50/40">
                <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{i + 1}</td>
                <td className="px-1 py-1">
                  <AccountPicker
                    value={line.accountId}
                    onChange={id => updateLine(i, { accountId: id })}
                    accounts={allowedAccounts}
                    placeholder="Select account…"
                    compact
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={line.narration}
                    onChange={e => updateLine(i, { narration: e.target.value })}
                    className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded text-sm outline-none"
                    placeholder="optional"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text" inputMode="decimal"
                    value={line.debit}
                    onChange={e => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                    className="w-full text-right font-mono text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text" inputMode="decimal"
                    value={line.credit}
                    onChange={e => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                    className="w-full text-right font-mono text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                    aria-label="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/60 border-t border-slate-200">
            <tr className="font-bold">
              <td colSpan={3} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{totals.dr.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{totals.cr.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 cursor-pointer text-xs">
            <Plus className="w-3.5 h-3.5" /> Add line
          </Button>

          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold",
            totals.balanced
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200",
          )}>
            {totals.balanced
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Balanced</>
              : <><AlertCircle className="w-3.5 h-3.5" /> Off by Rs. {Math.abs(totals.diff).toFixed(2)}</>}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-end gap-2 sticky bottom-2 z-10">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={pending} className="cursor-pointer gap-1.5 bg-white/95 backdrop-blur shadow-md">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={pending || !totals.balanced} className="cursor-pointer gap-1.5 shadow-lg shadow-primary/30">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          Save &amp; Post
        </Button>
      </div>
    </div>
  )
}
