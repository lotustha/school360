"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Wallet, Calculator } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import { runPayroll } from "@/actions/accounting/payroll-runs"

interface Roster {
  employeeId: string
  name:       string
  role:       string
  panNumber:  string | null
  baseSalary: string
  tdsPercent: string
  ssfEnabled: boolean
}

interface Bank { id: string; name: string; code: string }

interface Props {
  fiscalYearName: string
  roster:         Roster[]
  banks:          Bank[]
}

interface LineState {
  include: boolean
  gross:   string
  tds:     string
  ssf:     string
  remarks: string
}

export function PayrollRunForm({ fiscalYearName, roster, banks }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // Default period to the current BS month name
  const [periodLabel,   setPeriodLabel]   = useState("")
  const [dateBS,        setDateBS]        = useState(todayBS())
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("BANK")
  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? "")
  const [notes,         setNotes]         = useState("")

  // Per-employee state — seeded from PayrollStructure defaults
  const [lines, setLines] = useState<Record<string, LineState>>(() => {
    const seed: Record<string, LineState> = {}
    for (const e of roster) {
      const gross = parseFloat(e.baseSalary) || 0
      const tds   = ((gross * (parseFloat(e.tdsPercent) || 0)) / 100).toFixed(2)
      seed[e.employeeId] = {
        include: gross > 0,
        gross:   e.baseSalary,
        tds,
        ssf:     "0",
        remarks: "",
      }
    }
    return seed
  })

  function updateLine(employeeId: string, patch: Partial<LineState>) {
    setLines(prev => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }))
  }

  const totals = useMemo(() => {
    let gross = 0, tds = 0, ssf = 0
    let count = 0
    for (const e of roster) {
      const l = lines[e.employeeId]
      if (!l?.include) continue
      gross += parseFloat(l.gross || "0") || 0
      tds   += parseFloat(l.tds   || "0") || 0
      ssf   += parseFloat(l.ssf   || "0") || 0
      count++
    }
    return { gross, tds, ssf, net: gross - tds - ssf, count }
  }, [lines, roster])

  const canPost =
    !!periodLabel.trim() &&
    totals.count > 0 &&
    totals.gross > 0 &&
    totals.net >= 0 &&
    (paymentMethod === "CASH" || !!bankAccountId)

  function handlePost() {
    if (!canPost) { toast.error("Period, at least one employee, and a positive net are required"); return }
    const included = roster
      .filter(e => lines[e.employeeId]?.include)
      .map(e => {
        const l = lines[e.employeeId]
        return {
          employeeId: e.employeeId,
          gross:      String(parseFloat(l.gross) || 0),
          tds:        String(parseFloat(l.tds)   || 0),
          ssf:        String(parseFloat(l.ssf)   || 0),
          remarks:    l.remarks.trim() || null,
        }
      })

    start(async () => {
      try {
        const res = await runPayroll({
          periodLabel:   periodLabel.trim(),
          dateBS,
          paymentMethod,
          bankAccountId: paymentMethod === "CASH" ? null : bankAccountId,
          notes:         notes.trim() || null,
          lines: included,
        })
        toast.success(`Posted ${res.runNumber} · voucher ${res.voucherNumber}`)
        router.push(`/hr/payroll/${res.id}`)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  if (roster.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-amber-200/60 shadow-sm p-10 text-center max-w-2xl">
        <p className="text-sm text-amber-700 font-semibold">No staff configured.</p>
        <p className="text-xs text-muted-foreground mt-2">Add employees and configure payroll structures first.</p>
        <Link href="/hr/staff" className="text-xs text-primary font-bold hover:underline">Go to staff →</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Run Payroll</h1>
          <p className="text-sm text-muted-foreground">Posts one Payment Voucher with Dr Salary · Cr TDS · Cr SSF · Cr Cash/Bank.</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">FY {fiscalYearName}</span>
      </div>

      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Period *">
            <Input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. Baisakh 2082" />
          </Field>
          <Field label="Date (BS) *">
            <NepaliDateInput value={dateBS} onChange={setDateBS} />
          </Field>
          <Field label="Pay from *">
            <div className="grid grid-cols-2 gap-1">
              {(["CASH", "BANK"] as const).map(m => (
                <button
                  key={m} type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    paymentMethod === m
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white/75 border-slate-200 text-slate-700 hover:border-primary/40",
                  )}
                >{m}</button>
              ))}
            </div>
          </Field>
        </div>

        {paymentMethod === "BANK" && (
          <Field label="Bank account *">
            {banks.length === 0 ? (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                No bank accounts configured. <Link href="/accounting/bank-accounts" className="underline font-bold">Add one →</Link>
              </div>
            ) : (
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
                {banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
              </select>
            )}
          </Field>
        )}

        <Field label="Notes (optional)">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any internal notes" />
        </Field>
      </div>

      {/* Employee table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between">
          <p className="text-sm font-semibold">Employees · {totals.count} included</p>
          <p className="text-xs text-muted-foreground">Defaults come from each staff member&apos;s payroll structure.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-3 py-2 text-center w-12">Pay</th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left w-24">PAN</th>
              <th className="px-3 py-2 text-right w-28">Gross</th>
              <th className="px-3 py-2 text-right w-28">TDS</th>
              <th className="px-3 py-2 text-right w-28">SSF</th>
              <th className="px-3 py-2 text-right w-28">Net</th>
              <th className="px-3 py-2 text-left w-40">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {roster.map(e => {
              const l = lines[e.employeeId]
              const net = ((parseFloat(l.gross) || 0) - (parseFloat(l.tds) || 0) - (parseFloat(l.ssf) || 0)).toFixed(2)
              return (
                <tr key={e.employeeId} className={cn("hover:bg-slate-50/60 transition-colors", !l.include && "opacity-50")}>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={l.include} onChange={ev => updateLine(e.employeeId, { include: ev.target.checked })} className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-1.5">
                    <p className="font-semibold text-sm">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{e.role}</p>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.panNumber ?? "—"}</td>
                  <td className="px-1 py-1">
                    <input
                      type="text" inputMode="decimal"
                      value={l.gross}
                      onChange={ev => updateLine(e.employeeId, { gross: ev.target.value })}
                      disabled={!l.include}
                      className="w-full text-right font-mono text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text" inputMode="decimal"
                      value={l.tds}
                      onChange={ev => updateLine(e.employeeId, { tds: ev.target.value })}
                      disabled={!l.include}
                      className="w-full text-right font-mono text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text" inputMode="decimal"
                      value={l.ssf}
                      onChange={ev => updateLine(e.employeeId, { ssf: ev.target.value })}
                      disabled={!l.include}
                      className="w-full text-right font-mono text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-emerald-700">{l.include ? net : ""}</td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={l.remarks}
                      onChange={ev => updateLine(e.employeeId, { remarks: ev.target.value })}
                      disabled={!l.include}
                      placeholder="optional"
                      className="w-full text-sm px-2 py-1.5 bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/15 rounded outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">{totals.gross.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{totals.tds.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-violet-700">{totals.ssf.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">{totals.net.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Sticky action bar */}
      <div className="flex items-center justify-end gap-2 sticky bottom-2 z-10">
        <Link href="/hr/payroll">
          <Button variant="outline" disabled={pending} className="cursor-pointer bg-white/95 backdrop-blur shadow-md">Cancel</Button>
        </Link>
        <Button onClick={handlePost} disabled={pending || !canPost} className="cursor-pointer gap-1.5 shadow-lg shadow-primary/30">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          <Wallet className="w-4 h-4" />
          Post Payroll · Net Rs. {totals.net.toFixed(2)}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
