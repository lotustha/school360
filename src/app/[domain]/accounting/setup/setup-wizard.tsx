"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ArrowRight, Sparkles, Loader2, Calculator } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS, fiscalYearOf, formatBS } from "@/lib/nepali-date"
import { createFiscalYear, setCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { seedDefaultCOA } from "@/actions/accounting/accounts"
import { upsertOpeningBalances, finalizeOpeningBalances } from "@/actions/accounting/opening-balances"

interface FY  { id: string; name: string; startBS: string; endBS: string; status: string; isCurrent: boolean }
interface Acc { id: string; code: string; name: string; type: string; isSystem: boolean }
interface OB  { accountId: string; debit: string; credit: string }

interface Props {
  fiscalYears:     FY[]
  currentFyId:     string | null
  accounts:        Acc[]
  initialOpenings: OB[]
}

export function SetupWizard({ fiscalYears, currentFyId, accounts, initialOpenings }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const step1Done = fiscalYears.length > 0 && !!currentFyId
  const step2Done = accounts.length > 0
  const step3Done = initialOpenings.length > 0

  const initialStep = !step1Done ? 1 : !step2Done ? 2 : 3
  const [step, setStep] = useState<1 | 2 | 3>(initialStep as 1 | 2 | 3)

  // Step 1 state
  const [seedBS, setSeedBS] = useState<string>(() => todayBS())
  const fyPreview = useMemo(() => {
    try { return fiscalYearOf(seedBS) } catch { return null }
  }, [seedBS])

  async function handleCreateFY() {
    start(async () => {
      try {
        const created = await createFiscalYear({ startBS: seedBS })
        await setCurrentFiscalYear(created.id)
        toast.success(`Fiscal Year ${created.name} created and set as current`)
        router.refresh()
        setStep(2)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  async function handleSeedCOA() {
    start(async () => {
      try {
        const res = await seedDefaultCOA()
        toast.success(`Seeded ${res.inserted} accounts (${res.total} total)`)
        router.refresh()
        setStep(3)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  // Step 3 state
  const [openings, setOpenings] = useState<Record<string, { debit: string; credit: string }>>(() => {
    const seed: Record<string, { debit: string; credit: string }> = {}
    for (const o of initialOpenings) seed[o.accountId] = { debit: o.debit, credit: o.credit }
    return seed
  })

  function updateOpening(accountId: string, field: "debit" | "credit", value: string) {
    setOpenings(prev => ({
      ...prev,
      [accountId]: {
        debit:  field === "debit"  ? value : (prev[accountId]?.debit  ?? "0"),
        credit: field === "credit" ? value : (prev[accountId]?.credit ?? "0"),
      },
    }))
  }

  const totals = useMemo(() => {
    let dr = 0, cr = 0
    for (const v of Object.values(openings)) {
      dr += parseFloat(v.debit  || "0") || 0
      cr += parseFloat(v.credit || "0") || 0
    }
    return { dr, cr, balanced: Math.abs(dr - cr) < 0.005 }
  }, [openings])

  // Awaitable save — used by both Save Draft and Finalize so we can sequence them.
  async function persistOpenings() {
    if (!currentFyId) throw new Error("No current fiscal year")
    const rows = Object.entries(openings).map(([accountId, v]) => ({
      accountId,
      debit:  String(parseFloat(v.debit)  || 0),
      credit: String(parseFloat(v.credit) || 0),
    }))
    await upsertOpeningBalances({ fiscalYearId: currentFyId, rows })
    return rows.length
  }

  function handleSaveOpenings() {
    start(async () => {
      try {
        const n = await persistOpenings()
        toast.success(`Saved ${n} opening balance row${n === 1 ? "" : "s"}`)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  function handleFinalize() {
    if (!currentFyId) return
    start(async () => {
      try {
        await persistOpenings()
        await finalizeOpeningBalances(currentFyId)
        toast.success("Opening balances are balanced — setup complete!")
        router.push("/accounting")
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="flex items-center justify-between gap-2">
          {[
            { n: 1, title: "Fiscal Year",       done: step1Done },
            { n: 2, title: "Chart of Accounts", done: step2Done },
            { n: 3, title: "Opening Balances",  done: step3Done },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(s.n as 1 | 2 | 3)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer",
                  step === s.n ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black",
                  s.done ? "bg-emerald-500 text-white" : step === s.n ? "bg-primary text-white" : "bg-slate-200 text-slate-600",
                )}>
                  {s.done ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Step {s.n}</p>
                  <p className="text-sm font-semibold">{s.title}</p>
                </div>
              </button>
              {i < 2 && <ArrowRight className="w-4 h-4 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Fiscal Year */}
      {step === 1 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Step 1 — Create Fiscal Year</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The Nepali fiscal year runs <strong>Shrawan 1 to Asar end</strong>. Pick any BS date inside the year you want to create —
              we&apos;ll snap it to the full window automatically.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">A date inside the FY</label>
              <NepaliDateInput value={seedBS} onChange={setSeedBS} />
            </div>
            {fyPreview && (
              <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Will create</p>
                <p className="text-2xl font-bold mt-1">FY {fyPreview.name}</p>
                <p className="text-xs text-slate-700 mt-1.5">
                  {formatBS(fyPreview.startBS)} – {formatBS(fyPreview.endBS)}
                </p>
              </div>
            )}
          </div>

          {fiscalYears.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-600 mb-2">Existing fiscal years</p>
              <ul className="space-y-1">
                {fiscalYears.map(fy => (
                  <li key={fy.id} className="flex items-center justify-between text-sm">
                    <span>{fy.name} <span className="text-xs text-muted-foreground">({fy.status})</span></span>
                    {fy.isCurrent ? (
                      <span className="text-xs font-bold text-emerald-700">CURRENT</span>
                    ) : (
                      <button
                        onClick={() => start(async () => {
                          await setCurrentFiscalYear(fy.id)
                          toast.success(`${fy.name} set as current`)
                          router.refresh()
                        })}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        Set current
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {step1Done && (
              <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer">
                Continue to Chart of Accounts <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
            <Button onClick={handleCreateFY} disabled={pending || !fyPreview} className="cursor-pointer gap-1.5">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Create FY {fyPreview?.name}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: COA */}
      {step === 2 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Step 2 — Chart of Accounts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Seed a Nepal-school template (~40 accounts: Cash, Bank, Tuition Income, Salary Expense, Capital Fund, TDS Payable, etc.).
              Fully editable later — you can rename, add, or disable any account.
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Calculator className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">No accounts yet. Click below to seed the default template.</p>
              <Button onClick={handleSeedCOA} disabled={pending} className="cursor-pointer gap-1.5">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Seed Default Chart of Accounts
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm">
                  <span className="font-bold text-emerald-700">{accounts.length} accounts</span> already exist.
                </p>
                <Button variant="outline" size="sm" onClick={handleSeedCOA} disabled={pending} className="cursor-pointer text-xs">
                  Re-run seed (idempotent)
                </Button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                    <tr><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Type</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.slice(0, 20).map(a => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5 font-mono text-xs">{a.code}</td>
                        <td className="px-3 py-1.5">{a.name}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{a.type}</td>
                      </tr>
                    ))}
                    {accounts.length > 20 && (
                      <tr><td colSpan={3} className="px-3 py-1.5 text-xs text-center text-muted-foreground">… and {accounts.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="cursor-pointer">Back</Button>
            <Button onClick={() => setStep(3)} disabled={!step2Done} className="cursor-pointer gap-1.5">
              Continue to Opening Balances <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Opening balances */}
      {step === 3 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Step 3 — Opening Balances</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the opening balance for each account on Shrawan 1. Total debits must equal total credits.
              Tip: Cash, Bank, Receivables → <strong>Debit</strong>. Capital Fund, Payables, Loans → <strong>Credit</strong>.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                <tr>
                  <th className="px-3 py-2 text-left w-20">Code</th>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left w-20">Type</th>
                  <th className="px-3 py-2 text-right w-32">Debit</th>
                  <th className="px-3 py-2 text-right w-32">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 font-mono text-xs">{a.code}</td>
                    <td className="px-3 py-1.5">{a.name}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{a.type}</td>
                    <td className="px-1 py-1">
                      <input
                        type="text" inputMode="decimal"
                        className="w-full text-right font-mono text-sm bg-transparent px-2 py-1 rounded hover:bg-white/80 focus:bg-white border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
                        value={openings[a.id]?.debit ?? ""}
                        placeholder="0.00"
                        onChange={e => updateOpening(a.id, "debit", e.target.value)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text" inputMode="decimal"
                        className="w-full text-right font-mono text-sm bg-transparent px-2 py-1 rounded hover:bg-white/80 focus:bg-white border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
                        value={openings[a.id]?.credit ?? ""}
                        placeholder="0.00"
                        onChange={e => updateOpening(a.id, "credit", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80">
                <tr className="font-bold">
                  <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{totals.dr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{totals.cr.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className={cn(
                    "px-3 py-2 text-center text-xs font-bold",
                    totals.balanced ? "text-emerald-700 bg-emerald-50/60" : "text-rose-700 bg-rose-50/60",
                  )}>
                    {totals.balanced
                      ? `✓ Balanced (Dr = Cr = ${totals.dr.toFixed(2)})`
                      : `Off by Rs. ${Math.abs(totals.dr - totals.cr).toFixed(2)} — adjust to balance before finalizing`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer">Back</Button>
            <Button variant="outline" onClick={handleSaveOpenings} disabled={pending} className="cursor-pointer">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft"}
            </Button>
            <Button onClick={handleFinalize} disabled={pending || !totals.balanced} className="cursor-pointer gap-1.5">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finalize &amp; Finish
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
