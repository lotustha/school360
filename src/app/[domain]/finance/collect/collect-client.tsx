"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Loader2, Receipt, Search, Printer, Trash2,
  Banknote, Building2, AlertCircle, GraduationCap, Hash, Wallet, Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import { recordFeePayment, searchStudents, type StudentSearchRow } from "@/actions/accounting/fee-payments"
import { previewAllocation, type AllocationProposal } from "@/actions/billing/allocations"

interface Bank { id: string; name: string; code: string }

interface Student {
  id: string
  name: string
  nameNepali: string | null
  admissionNo: string
  rollNumber: string | null
  className: string | null
  facultyName: string | null
  avatarUrl: string | null
}

interface Props {
  fiscalYearName:     string
  banks:              Bank[]
  preselectedStudent: Student | null
}

type Method = "CASH" | "BANK" | "CHEQUE" | "ONLINE"

function studentFromSearchRow(s: StudentSearchRow): Student {
  return {
    id: s.id,
    name: s.name,
    nameNepali: s.nameNepali,
    admissionNo: s.admissionNo,
    rollNumber: s.rollNumber,
    className: s.className,
    facultyName: s.facultyName,
    avatarUrl: s.avatarUrl,
  }
}

export function CollectFeeClient({ fiscalYearName, banks, preselectedStudent }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [dateBS,        setDateBS]       = useState("")
  const [mounted,       setMounted]      = useState(false)
  const [studentQ,      setStudentQ]     = useState("")
  const [student,       setStudent]      = useState<Student | null>(preselectedStudent)
  const [suggestions,   setSuggestions]  = useState<StudentSearchRow[]>([])
  const [showSuggest,   setShowSuggest]  = useState(false)
  const [method,        setMethod]       = useState<Method>("CASH")
  const [bankAccountId, setBankAccountId]= useState(banks[0]?.id ?? "")
  const [remarks,       setRemarks]      = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

  // Method-specific fields
  const [chequeNo,    setChequeNo]    = useState("")
  const [chequeBank,  setChequeBank]  = useState("")
  const [chequeDate,  setChequeDate]  = useState("")
  const [txnRef,      setTxnRef]      = useState("")

  // Cash tendered (optional) to compute change
  const [cashTendered, setCashTendered] = useState("")

  // Outstanding bills
  const [bills, setBills]                 = useState<AllocationProposal[]>([])
  const [loadingBills, setLoading]        = useState(false)
  const [hasPriorFy, setHasPriorFy]       = useState(false)
  const [payNow, setPayNow]               = useState<Record<string, string>>({})

  const [quickFill, setQuickFill]   = useState("")

  useEffect(() => { setMounted(true); setDateBS(todayBS()) }, [])

  // Load bills when student changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!student) {
        if (!cancelled) { setBills([]); setPayNow({}); setQuickFill(""); setHasPriorFy(false) }
        return
      }
      setLoading(true)
      try {
        const r = await previewAllocation(student.id, "1")
        if (cancelled) return
        setBills(r.proposals)
        setHasPriorFy(r.hasUnpaidPriorFy)
        setPayNow({})
        setQuickFill("")
      } catch {
        if (!cancelled) { setBills([]); setPayNow({}); setHasPriorFy(false) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [student])

  function distributeFifo(totalStr: string) {
    const total = parseFloat(totalStr || "0")
    if (!Number.isFinite(total) || total <= 0) { setPayNow({}); return }
    let remaining = total
    const next: Record<string, string> = {}
    for (const b of bills) {
      const balance = parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)
      if (balance <= 0 || remaining <= 0) continue
      const take = Math.min(remaining, balance)
      next[b.studentFeeId] = take.toFixed(2)
      remaining -= take
    }
    setPayNow(next)
  }

  function applyQuickFill(value: string) { setQuickFill(value); distributeFifo(value) }
  function updatePayNow(id: string, value: string) { setPayNow(prev => ({ ...prev, [id]: value })) }
  function setRowMax(b: AllocationProposal) {
    const balance = parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)
    updatePayNow(b.studentFeeId, balance.toFixed(2))
  }
  function clearRow(id: string) {
    setPayNow(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  function rowStatus(b: AllocationProposal): { label: string; tone: "paid" | "partial" | "unpaid" } {
    const balance = parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)
    const pay = parseFloat(payNow[b.studentFeeId] || "0")
    if (pay <= 0)             return { label: "Unpaid", tone: "unpaid" }
    if (pay >= balance - 0.005) return { label: "Paid", tone: "paid" }
    return { label: `Rs. ${(balance - pay).toFixed(2)} left`, tone: "partial" }
  }

  // Debounced student search
  useEffect(() => {
    const t = setTimeout(async () => {
      if (student || studentQ.trim().length < 2) { setSuggestions([]); return }
      try { setSuggestions(await searchStudents(studentQ, { take: 6 })) }
      catch { setSuggestions([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [studentQ, student])

  useEffect(() => {
    if (!showSuggest) return
    function h(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showSuggest])

  function pickStudent(s: StudentSearchRow) {
    setStudent(studentFromSearchRow(s))
    setStudentQ("")
    setShowSuggest(false)
  }
  function clearStudent() {
    setStudent(null); setStudentQ(""); setShowSuggest(false)
  }

  const billAllocations = useMemo(() => {
    return bills
      .map(b => {
        const balance = parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)
        const desired = parseFloat(payNow[b.studentFeeId] || "0")
        return { studentFeeId: b.studentFeeId, amount: Math.max(0, Math.min(desired, balance)) }
      })
      .filter(a => a.amount > 0)
  }, [bills, payNow])

  const billTotal = billAllocations.reduce((s, a) => s + a.amount, 0)
  const grandTotal = billTotal

  const outstandingTotal = useMemo(
    () => bills.reduce((s, b) => s + (parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)), 0),
    [bills],
  )

  // Group bills by FY for visual separation
  const billGroups = useMemo(() => {
    const map = new Map<string, { fyName: string; isPriorFy: boolean; rows: AllocationProposal[] }>()
    for (const b of bills) {
      const key = b.fiscalYearName
      const entry = map.get(key) ?? { fyName: b.fiscalYearName, isPriorFy: b.isPriorFy, rows: [] }
      entry.rows.push(b)
      map.set(key, entry)
    }
    // Re-sort each group by priority (asc, lower = first) then due date.
    // Server returns bills already sorted that way, but the Map shuffle above
    // can re-interleave rows so we re-stabilize here.
    for (const g of map.values()) {
      g.rows.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.dueDateBS.localeCompare(b.dueDateBS)
      })
    }
    // Group order: prior-FY first (older debt first), then current FY.
    return Array.from(map.values()).sort((a, b) => {
      if (a.isPriorFy && !b.isPriorFy) return -1
      if (!a.isPriorFy && b.isPriorFy) return 1
      return a.fyName.localeCompare(b.fyName)
    })
  }, [bills])

  // Inline validation reasons (blocking)
  const validationIssues: string[] = []
  if (!student)                                   validationIssues.push("Pick a student")
  if (!dateBS)                                    validationIssues.push("Set the date")
  if (grandTotal <= 0)                            validationIssues.push("Enter an amount on at least one bill row")
  if (method !== "CASH" && !bankAccountId)        validationIssues.push("Select a bank account")
  if (method === "CHEQUE" && !chequeNo.trim())    validationIssues.push("Enter the cheque number")
  if (method === "ONLINE" && !txnRef.trim())      validationIssues.push("Enter the online transaction reference")

  const canSubmit = validationIssues.length === 0

  // Change due for cash payments
  const cashAmount = parseFloat(cashTendered || "0")
  const changeDue = method === "CASH" && cashAmount > grandTotal ? cashAmount - grandTotal : 0
  const shortBy   = method === "CASH" && cashAmount > 0 && cashAmount < grandTotal ? grandTotal - cashAmount : 0

  // Non-blocking warnings — submit still works, but flag in the footer chip
  const warnings: string[] = []
  if (shortBy > 0) warnings.push(`Cash tendered is Rs. ${shortBy.toFixed(2)} short of the Grand total`)

  function buildRemarks(): string | null {
    const parts: string[] = []
    if (remarks.trim()) parts.push(remarks.trim())
    if (method === "CHEQUE") {
      if (chequeNo.trim())   parts.push(`Cheque #${chequeNo.trim()}`)
      if (chequeBank.trim()) parts.push(`Drawer: ${chequeBank.trim()}`)
      if (chequeDate.trim()) parts.push(`Dated ${chequeDate.trim()}`)
    }
    if (method === "ONLINE" && txnRef.trim()) parts.push(`Txn: ${txnRef.trim()}`)
    return parts.length > 0 ? parts.join(" · ") : null
  }

  function handleSubmit() {
    if (!canSubmit || !student) { toast.error(validationIssues[0] ?? "Fill in required fields"); return }
    start(async () => {
      try {
        const allocations = billAllocations.map(a => ({
          studentFeeId: a.studentFeeId,
          amount:       a.amount.toFixed(2),
        }))

        const res = await recordFeePayment({
          studentId:     student.id,
          method,
          bankAccountId: method === "CASH" ? null : bankAccountId,
          dateBS,
          remarks:       buildRemarks(),
          allocations,
        })
        toast.success(`Receipt ${res.receiptNumber} created — voucher ${res.voucherNumber}`)
        router.push(`/finance/receipts/${res.id}/print`)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <div className="space-y-5 max-w-4xl pb-24">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collect Fee</h1>
          <p className="text-sm text-muted-foreground">Type the amount you&apos;re collecting against each outstanding fee. Records a Receipt Voucher in the GL.</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">FY {fiscalYearName}</span>
      </div>

      {/* Student picker — only shown when no student selected */}
      {!student && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6">
          <div ref={wrapRef} className="relative">
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Find a student *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
              <Input
                value={studentQ}
                onChange={e => { setStudentQ(e.target.value); setShowSuggest(true) }}
                onFocus={() => setShowSuggest(true)}
                placeholder="Type name, admission no, or roll number…"
                className="pl-10 h-11"
                autoFocus
              />
            </div>
            {showSuggest && studentQ.trim().length >= 2 && (
              <ul role="listbox" aria-label="Student suggestions" className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {suggestions.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-muted-foreground text-center">No students match — try a different name, admission no, or roll number.</li>
                ) : suggestions.map(s => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected="false"
                    tabIndex={0}
                    onMouseDown={e => { e.preventDefault(); pickStudent(s) }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickStudent(s) } }}
                    className="px-3 py-2 cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:outline-none flex items-center gap-3 text-sm"
                  >
                    <Avatar name={s.name} url={s.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{s.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>{s.admissionNo}</span>
                        {s.rollNumber && <><span className="text-slate-300">·</span><span>Roll {s.rollNumber}</span></>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {s.className && <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{s.className}</span>}
                      {s.facultyName && <span className="text-[9px] uppercase tracking-widest font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{s.facultyName}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Student profile card */}
      {student && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 flex flex-wrap items-center gap-4">
          <Avatar name={student.name} url={student.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight truncate">{student.name}</h2>
              {student.nameNepali && <span className="text-sm text-slate-500 font-medium">· {student.nameNepali}</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
              <span className="font-mono inline-flex items-center gap-1"><Hash className="w-2.5 h-2.5" />{student.admissionNo}</span>
              {student.rollNumber && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">Roll {student.rollNumber}</span>
                </>
              )}
              {student.className && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1"><GraduationCap className="w-3 h-3" />{student.className}</span>
                </>
              )}
              {student.facultyName && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="uppercase tracking-widest font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">{student.facultyName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <KPI label="Outstanding" value={`Rs. ${outstandingTotal.toFixed(2)}`} tone={outstandingTotal > 0 ? "rose" : "emerald"} />
            <Link href={`/finance/students/${student.id}`} className="text-[11px] font-bold text-primary hover:underline cursor-pointer whitespace-nowrap">View schedule →</Link>
            <button onClick={clearStudent} type="button" className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer whitespace-nowrap">Change</button>
          </div>
        </div>
      )}

      {student && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-5">
          {/* Quick fill total */}
          <div className="rounded-xl bg-slate-50/80 border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1 inline-flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Quick fill total
              </label>
              <p className="text-[11px] text-slate-500">Type a total and we&apos;ll distribute it across bills by priority.</p>
            </div>
            <Input
              type="text" inputMode="decimal"
              value={quickFill}
              onChange={e => applyQuickFill(e.target.value)}
              placeholder="0.00"
              className="font-mono text-right text-lg h-11 w-40"
            />
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => applyQuickFill(outstandingTotal.toFixed(2))}
              disabled={outstandingTotal <= 0}
              className="cursor-pointer"
            >
              Pay all (Rs. {outstandingTotal.toFixed(2)})
            </Button>
            {(Object.keys(payNow).length > 0 || quickFill) && (
              <button
                type="button"
                onClick={() => { setPayNow({}); setQuickFill("") }}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Bills grouped by FY */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <label className="text-xs font-semibold text-slate-600">
                Outstanding bills {loadingBills && <Loader2 className="inline w-3 h-3 ml-1 animate-spin text-slate-400" />}
              </label>
              {hasPriorFy && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-bold inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Includes prior-FY carry-forward
                </Badge>
              )}
            </div>

            {!loadingBills && bills.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
                <p className="text-sm font-bold text-emerald-700">No outstanding bills</p>
                <p className="text-xs text-emerald-600/80 mt-1">This student is fully paid up. You can still add ad-hoc charges below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billGroups.map(group => (
                  <div key={group.fyName} className={cn(
                    "rounded-xl border overflow-hidden",
                    group.isPriorFy ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white/60",
                  )}>
                    <div className={cn(
                      "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-between",
                      group.isPriorFy ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-slate-50/80 text-slate-500 border-b border-slate-200",
                    )}>
                      <span>FY {group.fyName}{group.isPriorFy && " · Prior year carry-forward"}</span>
                      <span className="font-mono tabular-nums">{group.rows.length} row{group.rows.length === 1 ? "" : "s"}</span>
                    </div>
                    <BillTable
                      rows={group.rows}
                      payNow={payNow}
                      updatePayNow={updatePayNow}
                      setRowMax={setRowMax}
                      clearRow={clearRow}
                      rowStatus={rowStatus}
                    />
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Bills total</span>
                  <span className="font-mono tabular-nums font-black text-base text-slate-900">Rs. {billTotal.toFixed(2)} <span className="text-slate-400 text-[10px] font-normal">/ Rs. {outstandingTotal.toFixed(2)} outstanding</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Grand total */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-xs font-black uppercase tracking-widest text-slate-700">Grand total</span>
            <span className="font-mono tabular-nums font-black text-xl text-primary">Rs. {grandTotal.toFixed(2)}</span>
          </div>

          {/* Date + Method */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date (BS) *</label>
              {mounted ? (
                <NepaliDateInput value={dateBS} onChange={setDateBS} />
              ) : (
                <div className="h-11 rounded-xl bg-white/75 border border-slate-200/80 animate-pulse" />
              )}
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

          {/* Method-specific fields */}
          {method === "CASH" && grandTotal > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 inline-flex items-center gap-1">
                <Banknote className="w-3 h-3" /> Cash tendered (optional)
              </label>
              <p className="text-[11px] text-slate-500 leading-snug">
                Calculator only — type the cash the parent handed you and we&apos;ll show the change to give back.
                The recorded receipt amount is always the <strong>Grand total</strong> above, not what you type here.
              </p>
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <Input
                  type="text" inputMode="decimal"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-right h-10 w-40"
                />
                {changeDue > 0 && (
                  <div className="text-xs">
                    <span className="text-slate-500">Change due: </span>
                    <span className="font-mono tabular-nums font-black text-emerald-700">Rs. {changeDue.toFixed(2)}</span>
                  </div>
                )}
                {shortBy > 0 && (
                  <div className="text-xs">
                    <span className="text-slate-500">Short by: </span>
                    <span className="font-mono tabular-nums font-black text-rose-700">Rs. {shortBy.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {method === "CHEQUE" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Cheque details
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Cheque number *</label>
                  <Input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="123456" className="font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Drawing bank</label>
                  <Input value={chequeBank} onChange={e => setChequeBank(e.target.value)} placeholder="e.g. NIC Asia" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Cheque date (optional)</label>
                  <Input value={chequeDate} onChange={e => setChequeDate(e.target.value)} placeholder="YYYY-MM-DD or post-dated note" />
                </div>
              </div>
            </div>
          )}

          {method === "ONLINE" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Online transaction</p>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Transaction reference *</label>
                <Input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="e.g. eSewa #, FonePay txn id, IMPS reference" className="font-mono" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Remarks (optional)</label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any internal note" />
          </div>
        </div>
      )}

      {/* Sticky action footer */}
      {student && (
        <div className="sticky bottom-0 left-0 right-0 -mx-4 mt-4 px-4 pt-3 pb-3 bg-gradient-to-t from-white via-white/95 to-white/70 backdrop-blur-md border-t border-slate-200/80 z-30 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="text-slate-500">Grand total:</span>
              <span className="font-mono tabular-nums font-black text-lg text-primary">Rs. {grandTotal.toFixed(2)}</span>
              {validationIssues.length > 0 ? (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {validationIssues[0]}
                </span>
              ) : warnings.length > 0 && (
                <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md inline-flex items-center gap-1" title="Submit still works — the receipt records Grand total, not what you tendered.">
                  <AlertCircle className="w-3 h-3" /> {warnings[0]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
      )}
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function BillTable({
  rows, payNow, updatePayNow, setRowMax, clearRow, rowStatus,
}: {
  rows: AllocationProposal[]
  payNow: Record<string, string>
  updatePayNow: (id: string, v: string) => void
  setRowMax: (b: AllocationProposal) => void
  clearRow: (id: string) => void
  rowStatus: (b: AllocationProposal) => { label: string; tone: "paid" | "partial" | "unpaid" }
}) {
  return (
    <>
      <div className="hidden md:grid grid-cols-[1fr_110px_140px_140px_36px] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-50/40 border-b border-slate-100">
        <div>Fee head</div>
        <div className="text-right">Outstanding</div>
        <div className="text-right">Pay now (Rs.)</div>
        <div className="text-right">Status</div>
        <div></div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(b => {
          const balance = parseFloat(b.finalAmount) - parseFloat(b.alreadyPaid)
          const status  = rowStatus(b)
          return (
            <div key={b.studentFeeId} className="grid grid-cols-1 md:grid-cols-[1fr_110px_140px_140px_36px] gap-2 px-3 py-2 items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0",
                    b.priority <= 10 ? "bg-rose-100 text-rose-700"
                    : b.priority <= 30 ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600",
                  )} title={`Priority ${b.priority} — lower = paid first`}>P{b.priority}</span>
                  <p className="font-bold text-slate-800 text-sm truncate">{b.feeHeadName}</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {b.periodLabel}
                  {parseFloat(b.alreadyPaid) > 0 && (
                    <span className="ml-2 text-emerald-600">· Rs. {b.alreadyPaid} already paid</span>
                  )}
                </p>
              </div>
              <div className="text-right font-mono text-sm font-bold tabular-nums text-slate-700">
                <span className="md:hidden text-[9px] uppercase tracking-widest text-slate-400 mr-1">Outstanding</span>
                {balance.toFixed(2)}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="text" inputMode="decimal"
                  value={payNow[b.studentFeeId] ?? ""}
                  onChange={e => updatePayNow(b.studentFeeId, e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-right h-8 text-sm"
                  aria-label={`Pay now for ${b.feeHeadName} ${b.periodLabel}`}
                />
                <button
                  type="button"
                  onClick={() => setRowMax(b)}
                  className="text-[10px] font-black text-primary hover:underline cursor-pointer px-1 flex-shrink-0"
                  title="Pay this row in full"
                >MAX</button>
              </div>
              <div className="text-right">
                <span className={cn(
                  "inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded",
                  status.tone === "paid"    && "bg-emerald-100 text-emerald-700",
                  status.tone === "partial" && "bg-sky-100 text-sky-700",
                  status.tone === "unpaid"  && "bg-slate-100 text-slate-500",
                )}>{status.label}</span>
              </div>
              <button
                type="button"
                onClick={() => clearRow(b.studentFeeId)}
                disabled={!payNow[b.studentFeeId]}
                aria-label="Clear row"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors justify-self-end"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "md" | "lg" }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
  const cls = size === "lg" ? "w-16 h-16 text-xl" : "w-9 h-9 text-[10px]"
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={cn(cls, "rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0")} />
  }
  return (
    <div className={cn(cls, "rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0")}>
      <span className="font-bold text-emerald-700">{initials}</span>
    </div>
  )
}

function KPI({ label, value, tone }: { label: string; value: string; tone: "rose" | "emerald" | "primary" }) {
  const palette = {
    rose:    { icon: "text-rose-600 bg-rose-50",       value: "text-rose-700" },
    emerald: { icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    primary: { icon: "text-primary bg-primary/8",      value: "text-primary" },
  }[tone]
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1 justify-end">
        <Wallet className={cn("w-3 h-3 rounded-sm", palette.icon)} />
        {label}
      </p>
      <p className={cn("text-sm font-bold font-mono tabular-nums mt-0.5", palette.value)}>{value}</p>
    </div>
  )
}
