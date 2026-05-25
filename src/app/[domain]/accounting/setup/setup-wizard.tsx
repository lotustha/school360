"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2, ArrowRight, Sparkles, Loader2, Calculator, CalendarRange, ListChecks, Scale,
  AlertTriangle, ArrowLeft, Search,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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

const TYPE_TONE: Record<string, string> = {
  ASSET:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  LIABILITY: "bg-rose-50    text-rose-700    border-rose-200",
  EQUITY:    "bg-violet-50  text-violet-700  border-violet-200",
  INCOME:    "bg-sky-50     text-sky-700     border-sky-200",
  EXPENSE:   "bg-amber-50   text-amber-700   border-amber-200",
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
  const fyExists = !!fyPreview && fiscalYears.some(f => f.name === fyPreview.name)

  async function handleCreateFY() {
    start(async () => {
      try {
        const created = await createFiscalYear({ startBS: seedBS })
        await setCurrentFiscalYear(created.id)
        toast.success(`Fiscal Year ${created.name} created and set as current`)
        router.refresh()
        setStep(2)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  async function handleSeedCOA() {
    start(async () => {
      try {
        const res = await seedDefaultCOA()
        toast.success(`Seeded ${res.inserted} accounts (${res.total} total)`)
        router.refresh()
        setStep(3)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  // Step 3 state
  const [openings, setOpenings] = useState<Record<string, { debit: string; credit: string }>>(() => {
    const seed: Record<string, { debit: string; credit: string }> = {}
    for (const o of initialOpenings) seed[o.accountId] = { debit: o.debit, credit: o.credit }
    return seed
  })
  const [obFilter, setObFilter]    = useState("")
  const [obTypeFilter, setObType]  = useState<"ALL" | "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE">("ALL")
  const [hideZero, setHideZero]    = useState(false)

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

  const filteredAccounts = useMemo(() => {
    const q = obFilter.trim().toLowerCase()
    return accounts.filter(a => {
      if (obTypeFilter !== "ALL" && a.type !== obTypeFilter) return false
      if (hideZero) {
        const ob = openings[a.id]
        const hasValue = (parseFloat(ob?.debit ?? "0") || 0) > 0 || (parseFloat(ob?.credit ?? "0") || 0) > 0
        if (!hasValue) return false
      }
      if (!q) return true
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)
    })
  }, [accounts, obFilter, obTypeFilter, hideZero, openings])

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
      } catch (e) { toast.error((e as Error).message) }
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
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  const stepsDone = [step1Done, step2Done, step3Done].filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounting Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One-time wizard to set up your school&apos;s accounting books. Takes about 3 minutes.
        </p>
      </div>

      {/* Stepper */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Progress</p>
          <p className="text-xs font-bold tabular-nums text-slate-700">{stepsDone} / 3 steps complete</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[step1Done, step2Done, step3Done].map((done, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all", done ? "bg-emerald-500" : i < step ? "bg-primary/40" : "bg-slate-200")} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {[
            { n: 1, title: "Fiscal Year",       subtitle: "Create and set as current",      done: step1Done, icon: CalendarRange },
            { n: 2, title: "Chart of Accounts", subtitle: "Seed Nepal-school template",     done: step2Done, icon: ListChecks },
            { n: 3, title: "Opening Balances",  subtitle: "Enter Dr/Cr, must balance",      done: step3Done, icon: Scale },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setStep(s.n as 1 | 2 | 3)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer min-w-0 flex-1",
                    step === s.n ? "bg-primary/10 ring-2 ring-primary/20" : "hover:bg-slate-50",
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                    s.done ? "bg-emerald-500 text-white" : step === s.n ? "bg-primary text-white" : "bg-slate-200 text-slate-600",
                  )}>
                    {s.done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Step {s.n}</p>
                    <p className="text-sm font-bold truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{s.subtitle}</p>
                  </div>
                </button>
                {i < 2 && <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1 — Fiscal Year */}
      {step === 1 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight inline-flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-primary" />
              Step 1 — Create Fiscal Year
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Nepali fiscal year runs <strong>Shrawan 1 → Asar end</strong>. Pick any BS date inside the year you want; we&apos;ll snap to the full window.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">A date inside the FY (BS)</label>
              <NepaliDateInput value={seedBS} onChange={setSeedBS} />
            </div>
            {fyPreview ? (
              <div className={cn(
                "rounded-xl p-4 border",
                fyExists ? "bg-amber-50/60 border-amber-200" : "bg-emerald-50/60 border-emerald-200/60",
              )}>
                <p className={cn(
                  "text-[10px] uppercase tracking-widest font-black",
                  fyExists ? "text-amber-700" : "text-emerald-700",
                )}>
                  {fyExists ? "Already exists" : "Will create"}
                </p>
                <p className="text-2xl font-bold mt-1">FY {fyPreview.name}</p>
                <p className="text-xs text-slate-700 font-mono mt-1.5">
                  {formatBS(fyPreview.startBS)} → {formatBS(fyPreview.endBS)}
                </p>
              </div>
            ) : (
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 inline-flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Invalid date.
              </div>
            )}
          </div>

          {fiscalYears.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Existing fiscal years ({fiscalYears.length})</p>
              <ul className="space-y-1">
                {fiscalYears.map(fy => (
                  <li key={fy.id} className="flex items-center justify-between text-sm gap-2 py-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="font-bold">FY {fy.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">({fy.status})</span>
                    </span>
                    {fy.isCurrent ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> CURRENT
                      </span>
                    ) : (
                      <button
                        onClick={() => start(async () => {
                          await setCurrentFiscalYear(fy.id)
                          toast.success(`${fy.name} set as current`)
                          router.refresh()
                        })}
                        className="text-xs text-primary hover:underline cursor-pointer font-bold"
                      >
                        Set current
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {step1Done && (
              <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer gap-1.5">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={handleCreateFY} disabled={pending || !fyPreview || fyExists}
              className="cursor-pointer gap-1.5"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Create FY {fyPreview?.name}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — COA */}
      {step === 2 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight inline-flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Step 2 — Chart of Accounts
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Seed a Nepal-school template (~40 accounts). Fully editable later — rename, add, or disable any account.
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Calculator className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">No accounts yet. Seed the default template to start.</p>
              <Button onClick={handleSeedCOA} disabled={pending} className="cursor-pointer gap-1.5">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Seed Default Chart of Accounts
              </Button>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map(t => {
                  const count = accounts.filter(a => a.type === t).length
                  return (
                    <div key={t} className={cn("rounded-lg border p-3 text-center", TYPE_TONE[t])}>
                      <p className="text-[10px] uppercase tracking-widest font-black">{t.slice(0, 4)}</p>
                      <p className="text-xl font-black tabular-nums mt-1">{count}</p>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <p className="text-sm">
                  <span className="font-bold text-emerald-700">{accounts.length} accounts</span> ready to use.
                </p>
                <Button variant="outline" size="sm" onClick={handleSeedCOA} disabled={pending} className="cursor-pointer text-xs gap-1.5">
                  {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Re-run seed (idempotent)
                </Button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0">
                    <tr><th className="px-3 py-2 text-left w-16">Code</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left w-24">Type</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.slice(0, 20).map(a => (
                      <tr key={a.id}>
                        <td className="px-3 py-1.5 font-mono text-xs">{a.code}</td>
                        <td className="px-3 py-1.5">{a.name}</td>
                        <td className="px-3 py-1.5">
                          <Badge className={cn("text-[10px] font-black uppercase tracking-widest border", TYPE_TONE[a.type])}>{a.type.slice(0, 3)}</Badge>
                        </td>
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

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="cursor-pointer gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!step2Done} className="cursor-pointer gap-1.5">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Openings */}
      {step === 3 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight inline-flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Step 3 — Opening Balances
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter the opening balance on Shrawan 1. <strong>Total debits must equal total credits.</strong>
              {" "}Tip: Cash, Bank, Receivables → <span className="text-emerald-700 font-bold">Debit</span>.
              {" "}Capital Fund, Payables, Loans → <span className="text-rose-700 font-bold">Credit</span>.
            </p>
          </div>

          {/* Live total cards */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Total Debit</p>
              <p className="font-mono tabular-nums text-xl font-black text-emerald-700">Rs. {totals.dr.toFixed(2)}</p>
            </div>
            <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Total Credit</p>
              <p className="font-mono tabular-nums text-xl font-black text-rose-700">Rs. {totals.cr.toFixed(2)}</p>
            </div>
            <div className={cn(
              "rounded-lg p-3 border",
              totals.balanced ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50/60 border-amber-200",
            )}>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Balance Check</p>
              <p className={cn("font-bold text-xl", totals.balanced ? "text-emerald-700" : "text-amber-700")}>
                {totals.balanced ? "Balanced ✓" : `Off Rs. ${Math.abs(totals.dr - totals.cr).toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
              {(["ALL", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setObType(t)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition",
                    obTypeFilter === t ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
                  )}
                >{t === "ALL" ? "ALL" : t.slice(0, 4)}</button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={obFilter}
                onChange={e => setObFilter(e.target.value)}
                placeholder="Search code / name…"
                className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <label className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="cursor-pointer" />
              Only with values
            </label>
            <span className="ml-auto text-xs text-slate-400 tabular-nums">
              {filteredAccounts.length} of {accounts.length}
            </span>
          </div>

          {/* OB table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-20">Code</th>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left w-20">Type</th>
                  <th className="px-3 py-2 text-right w-32">Debit</th>
                  <th className="px-3 py-2 text-right w-32">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{a.code}</td>
                    <td className="px-3 py-1.5">{a.name}</td>
                    <td className="px-3 py-1.5">
                      <Badge className={cn("text-[9px] font-black uppercase tracking-widest border", TYPE_TONE[a.type])}>{a.type.slice(0, 3)}</Badge>
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text" inputMode="decimal"
                        className="w-full text-right font-mono text-sm bg-transparent px-2 py-1 rounded hover:bg-white/80 focus:bg-white border border-transparent focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15 outline-none text-emerald-700"
                        value={openings[a.id]?.debit ?? ""}
                        placeholder="0.00"
                        onChange={e => updateOpening(a.id, "debit", e.target.value)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="text" inputMode="decimal"
                        className="w-full text-right font-mono text-sm bg-transparent px-2 py-1 rounded hover:bg-white/80 focus:bg-white border border-transparent focus:border-rose-400 focus:ring-2 focus:ring-rose-400/15 outline-none text-rose-700"
                        value={openings[a.id]?.credit ?? ""}
                        placeholder="0.00"
                        onChange={e => updateOpening(a.id, "credit", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                {filteredAccounts.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No accounts match.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50/80">
                <tr className="font-bold border-t-2 border-slate-200">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">{totals.dr.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-rose-700">{totals.cr.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-between gap-2 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleSaveOpenings} disabled={pending} className="cursor-pointer">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft"}
              </Button>
              <Button
                onClick={handleFinalize} disabled={pending || !totals.balanced}
                className="cursor-pointer gap-1.5 shadow-sm shadow-primary/20"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Finalize &amp; Finish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

