"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Receipt, Search, Printer, Plus, Trash2, Wand2, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import { recordFeePayment, searchStudents } from "@/actions/accounting/fee-payments"
import { previewAllocation, type AllocationPreview } from "@/actions/billing/allocations"
import { AccountPicker } from "@/components/accounting/account-picker"

interface Acc  { id: string; code: string; name: string }
interface Bank { id: string; name: string; code: string }
interface Student { id: string; name: string; admissionNo: string; className: string | null; avatarUrl: string | null }

interface Props {
  fiscalYearName:     string
  incomeAccounts:     Acc[]
  banks:              Bank[]
  preselectedStudent: Student | null
}

type Method = "CASH" | "BANK" | "CHEQUE" | "ONLINE"

interface FeeLine {
  key:          string  // stable React key
  feeAccountId: string
  amount:       string
  remarks:      string
}

function newLine(defaultAccountId = ""): FeeLine {
  return {
    key: Math.random().toString(36).slice(2),
    feeAccountId: defaultAccountId,
    amount: "",
    remarks: "",
  }
}

export function CollectFeeClient({ fiscalYearName, incomeAccounts, banks, preselectedStudent }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [dateBS,        setDateBS]       = useState(todayBS())
  const [studentQ,      setStudentQ]     = useState(preselectedStudent
    ? `${preselectedStudent.name} · ${preselectedStudent.admissionNo}${preselectedStudent.className ? " · " + preselectedStudent.className : ""}`
    : "")
  const [student,       setStudent]      = useState<Student | null>(preselectedStudent)
  const [suggestions,   setSuggestions]  = useState<Student[]>([])
  const [showSuggest,   setShowSuggest]  = useState(false)
  const [lines,         setLines]        = useState<FeeLine[]>(() => [newLine(incomeAccounts[0]?.id ?? "")])
  const [method,        setMethod]       = useState<Method>("CASH")
  const [bankAccountId, setBankAccountId]= useState(banks[0]?.id ?? "")
  const [remarks,       setRemarks]      = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  // Bill-allocation mode (auto-FIFO settle outstanding bills) vs free-form line entry
  const [autoMode, setAutoMode]       = useState(true)   // default ON when student has outstanding bills
  const [autoAmount, setAutoAmount]   = useState("")     // single total when in autoMode
  const [billPreview, setBillPreview] = useState<AllocationPreview | null>(null)
  const [previewing, setPreviewing]   = useState(false)
  /** Per-row manual overrides. Key=studentFeeId, value=override amount string. */
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const pickerAccounts = useMemo(
    () => incomeAccounts.map(a => ({ ...a, type: "INCOME" })),
    [incomeAccounts],
  )

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0),
    [lines],
  )

  function updateLine(key: string, patch: Partial<FeeLine>) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  }
  function addLine() {
    setLines(prev => [...prev, newLine()])
  }
  function removeLine(key: string) {
    setLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.key !== key))
  }

  // Debounced bill-allocation preview when student + autoAmount are set.
  // Clears manual overrides whenever amount/student changes so the new auto-split is honored.
  useEffect(() => {
    if (!student || !autoMode) { setBillPreview(null); return }
    const amt = parseFloat(autoAmount || "0")
    if (amt <= 0) { setBillPreview(null); return }
    setPreviewing(true)
    const t = setTimeout(async () => {
      try {
        const r = await previewAllocation(student.id, String(amt))
        setBillPreview(r)
        setOverrides({})  // reset any per-row overrides on fresh preview
      } catch { setBillPreview(null) }
      finally { setPreviewing(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [student, autoAmount, autoMode])

  /** Effective allocations = overrides win where present, else auto-FIFO. */
  const effectiveAllocations = useMemo(() => {
    if (!billPreview) return []
    return billPreview.proposals.map(p => {
      const override = overrides[p.studentFeeId]
      const amt = override !== undefined && override !== ""
        ? Math.max(0, Math.min(parseFloat(override) || 0, parseFloat(p.finalAmount) - parseFloat(p.alreadyPaid)))
        : parseFloat(p.thisPayment)
      return { studentFeeId: p.studentFeeId, amount: amt }
    })
  }, [billPreview, overrides])

  const overrideTotal = effectiveAllocations.reduce((s, a) => s + a.amount, 0)
  const overrideResidual = parseFloat(autoAmount || "0") - overrideTotal
  const hasOverride = Object.keys(overrides).length > 0

  // When a student is picked + autoMode is on, fetch outstanding bills to inform the default amount
  useEffect(() => {
    if (!student || !autoMode) return
    if (autoAmount) return  // user has typed something
    previewAllocation(student.id, "1").then(r => {
      const due = parseFloat(r.totalDue)
      if (due > 0) setAutoAmount(due.toFixed(2))
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, autoMode])

  // Debounced student search
  useEffect(() => {
    if (student || studentQ.trim().length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try { setSuggestions(await searchStudents(studentQ)) } catch { setSuggestions([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [studentQ, student])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showSuggest) return
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showSuggest])

  function pickStudent(s: Student) {
    setStudent(s)
    setStudentQ(`${s.name} · ${s.admissionNo}${s.className ? " · " + s.className : ""}`)
    setShowSuggest(false)
  }

  function clearStudent() {
    setStudent(null)
    setStudentQ("")
    setShowSuggest(false)
  }

  const validLines = lines.filter(l => l.feeAccountId && parseFloat(l.amount || "0") > 0)
  const autoAmt = parseFloat(autoAmount || "0")
  const canSubmit = !!student && !!dateBS && (method === "CASH" || !!bankAccountId) && (
    autoMode
      ? autoAmt > 0
      : (validLines.length === lines.length && lines.length > 0)
  )

  function handleSubmit() {
    if (!canSubmit || !student) { toast.error("Fill all required fields"); return }
    start(async () => {
      try {
        let payload: Parameters<typeof recordFeePayment>[0]
        if (autoMode) {
          if (!billPreview) { toast.error("Bill preview not ready"); return }
          // Use effective allocations (manual overrides win where set, otherwise auto-FIFO)
          const allocations = effectiveAllocations
            .filter(a => a.amount > 0)
            .map(a => ({ studentFeeId: a.studentFeeId, amount: String(a.amount.toFixed(2)) }))
          if (allocations.length === 0) {
            toast.error("No allocations. Set at least one row's amount above zero.")
            return
          }
          // Server derives per-head GL lines from the allocated rows — we just supply
          // the allocations + payment metadata.
          payload = {
            studentId:     student.id,
            method,
            bankAccountId: method === "CASH" ? null : bankAccountId,
            dateBS,
            remarks:       remarks.trim() || null,
            allocations,
          }
        } else {
          payload = {
            studentId:     student.id,
            lines:         lines.map(l => ({
              feeAccountId: l.feeAccountId,
              amount:       String(parseFloat(l.amount)),
              remarks:      l.remarks.trim() || null,
            })),
            method,
            bankAccountId: method === "CASH" ? null : bankAccountId,
            dateBS,
            remarks:       remarks.trim() || null,
          }
        }

        const res = await recordFeePayment(payload)
        toast.success(`Receipt ${res.receiptNumber} created — voucher ${res.voucherNumber}`)
        router.push(`/finance/receipts/${res.id}/print`)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collect Fee</h1>
          <p className="text-sm text-muted-foreground">Records a Receipt Voucher in the GL and prints a receipt for the student.</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">FY {fiscalYearName}</span>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-4">
        {/* Student picker */}
        <div ref={wrapRef} className="relative">
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Student *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
            <Input
              value={studentQ}
              onChange={e => { setStudentQ(e.target.value); setStudent(null); setShowSuggest(true) }}
              onFocus={() => setShowSuggest(true)}
              placeholder="Type name or admission number…"
              className="pl-9"
            />
            {student && (
              <button onClick={clearStudent} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-rose-600 cursor-pointer">
                Clear
              </button>
            )}
          </div>
          {showSuggest && !student && studentQ.trim().length >= 2 && (
            <ul className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {suggestions.length === 0 ? (
                <li className="px-3 py-3 text-xs text-muted-foreground text-center">No students match — try a different name or admission number.</li>
              ) : suggestions.map(s => {
                const initials = s.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
                return (
                  <li
                    key={s.id}
                    onMouseDown={e => { e.preventDefault(); pickStudent(s) }}
                    className="px-3 py-2 cursor-pointer hover:bg-primary/10 flex items-center gap-3 text-sm"
                  >
                    {s.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatarUrl}
                        alt={s.name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                        <span className="text-[10px] font-bold text-emerald-700">{initials}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{s.admissionNo}</p>
                    </div>
                    {s.className && <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">{s.className}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Mode toggle: auto-allocate vs free-form */}
        {student && (
          <div className="flex items-center gap-2 p-1 bg-slate-100/60 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setAutoMode(true)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1.5",
                autoMode ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Wand2 className="w-3.5 h-3.5" /> Auto-allocate (settle bills)
            </button>
            <button
              type="button"
              onClick={() => setAutoMode(false)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1.5",
                !autoMode ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <FileText className="w-3.5 h-3.5" /> Advanced (manual lines)
            </button>
          </div>
        )}

        {/* Auto-allocate mode: outstanding bills + amount input */}
        {student && autoMode && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Amount (Rs.) *</label>
              <Input
                type="text" inputMode="decimal"
                value={autoAmount}
                onChange={e => setAutoAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono text-right text-lg h-12"
              />
            </div>
            {previewing ? (
              <div className="text-xs text-slate-500 text-center py-3">Computing allocation…</div>
            ) : billPreview && (
              <div className={cn(
                "rounded-xl border p-4",
                billPreview.proposals.length === 0 ? "bg-amber-50 border-amber-200"
                  : Math.abs(overrideResidual) > 0.01 ? "bg-sky-50 border-sky-200"
                  : "bg-emerald-50 border-emerald-200",
              )}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-xs font-bold">
                    {billPreview.proposals.length === 0
                      ? "No outstanding fees"
                      : `Will settle ${effectiveAllocations.filter(a => a.amount > 0).length} fee${effectiveAllocations.filter(a => a.amount > 0).length === 1 ? "" : "s"}${hasOverride ? " (manual)" : " (auto · by priority + due date)"}`}
                  </p>
                  <div className="flex gap-2 text-[11px] items-center">
                    <span className="font-mono">Allocated: <strong>Rs. {overrideTotal.toFixed(2)}</strong></span>
                    {Math.abs(overrideResidual) > 0.01 && (
                      <span className={cn("font-mono", overrideResidual > 0 ? "text-sky-700" : "text-rose-700")}>
                        {overrideResidual > 0 ? `Advance: Rs. ${overrideResidual.toFixed(2)}` : `Over by Rs. ${Math.abs(overrideResidual).toFixed(2)}`}
                      </span>
                    )}
                    {hasOverride && (
                      <button type="button" onClick={() => setOverrides({})} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">
                        Reset to auto
                      </button>
                    )}
                  </div>
                </div>
                {billPreview.proposals.length > 0 && (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {billPreview.proposals.map(p => {
                      const currentAmt = overrides[p.studentFeeId] !== undefined && overrides[p.studentFeeId] !== ""
                        ? overrides[p.studentFeeId]
                        : p.thisPayment
                      const numCurrent = parseFloat(currentAmt) || 0
                      const balance = parseFloat(p.finalAmount) - parseFloat(p.alreadyPaid)
                      return (
                        <div key={p.studentFeeId} className={cn(
                          "flex items-center gap-2 text-xs px-2 py-1.5 rounded",
                          numCurrent > 0 ? "bg-white/70 border border-emerald-200" : "bg-white/30 border border-slate-200 opacity-60",
                        )}>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0",
                            p.priority <= 10 ? "bg-rose-100 text-rose-700"
                            : p.priority <= 30 ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600",
                          )} title={`Priority ${p.priority} — lower = paid first`}>P{p.priority}</span>
                          <span className="font-bold text-slate-700 truncate min-w-0 flex-1">{p.feeHeadName}</span>
                          <span className="text-slate-500 text-[10px] flex-shrink-0">{p.periodLabel}</span>
                          <Input
                            type="text" inputMode="decimal"
                            value={currentAmt}
                            onChange={e => setOverrides(prev => ({ ...prev, [p.studentFeeId]: e.target.value }))}
                            className="w-20 h-7 font-mono text-right text-xs"
                          />
                          <span className="text-slate-400 text-[10px] flex-shrink-0 w-16 text-right">/ {balance.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => setOverrides(prev => ({ ...prev, [p.studentFeeId]: balance.toFixed(2) }))}
                            className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex-shrink-0"
                            title="Pay this row in full"
                          >Max</button>
                          <button
                            type="button"
                            onClick={() => setOverrides(prev => ({ ...prev, [p.studentFeeId]: "0" }))}
                            className="text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer flex-shrink-0"
                            title="Skip this row"
                          >Skip</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {billPreview.hasUnpaidPriorFy && (
                  <Badge variant="outline" className="mt-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Includes prior-FY carry-forward
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fee lines — N rows, one per fee head (free-form mode) */}
        {(!student || !autoMode) && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">Fee heads *</label>
            <button
              type="button"
              onClick={addLine}
              className="text-[11px] font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add line
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white/60">
            <div className="grid grid-cols-[1fr_120px_36px] gap-2 px-3 py-2 bg-slate-50/80 text-[10px] uppercase tracking-widest font-black text-slate-500 border-b border-slate-200">
              <div>Fee head &amp; note</div>
              <div className="text-right">Amount (Rs.)</div>
              <div></div>
            </div>
            <div className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <div key={line.key} className="grid grid-cols-[1fr_120px_36px] gap-2 px-3 py-2 items-start">
                  <div className="space-y-1.5 min-w-0">
                    <AccountPicker
                      value={line.feeAccountId}
                      onChange={id => updateLine(line.key, { feeAccountId: id })}
                      accounts={pickerAccounts}
                      placeholder="Search fee head…"
                    />
                    <Input
                      value={line.remarks}
                      onChange={e => updateLine(line.key, { remarks: e.target.value })}
                      placeholder="Line note (optional, e.g. Baisakh)"
                      className="h-8 text-xs"
                    />
                  </div>
                  <Input
                    type="text" inputMode="decimal"
                    value={line.amount}
                    onChange={e => updateLine(line.key, { amount: e.target.value })}
                    placeholder="0.00"
                    className="font-mono text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1}
                    aria-label={`Remove line ${idx + 1}`}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-t border-slate-200 text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total</span>
              <span className="font-mono tabular-nums font-black text-base text-slate-900">Rs. {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        )}

        {/* Date + Method + Bank */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date (BS) *</label>
            <NepaliDateInput value={dateBS} onChange={setDateBS} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Payment method *</label>
            <div className="grid grid-cols-4 gap-1">
              {(["CASH", "BANK", "CHEQUE", "ONLINE"] as Method[]).map(m => (
                <button
                  key={m} type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    method === m
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white/75 border-slate-200 text-slate-700 hover:border-primary/40",
                  )}
                >{m}</button>
              ))}
            </div>
          </div>
        </div>

        {method !== "CASH" && (
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bank account *</label>
            {banks.length === 0 ? (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                No bank accounts configured. <Link href="/accounting/bank-accounts" className="underline font-bold">Add one →</Link>
              </div>
            ) : (
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
                {banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
              </select>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Remarks (optional)</label>
          <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Cheque #, voucher ref., or any note" />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/finance">
            <Button variant="outline" className="cursor-pointer" disabled={pending}>Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={pending || !canSubmit} className="cursor-pointer gap-1.5 shadow-md shadow-primary/20">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Record &amp; Print Receipt
            <Printer className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </div>
      </div>
    </div>
  )
}
