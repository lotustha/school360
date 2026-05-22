"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Receipt, Search, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import { recordFeePayment, searchStudents } from "@/actions/accounting/fee-payments"

interface Acc  { id: string; code: string; name: string }
interface Bank { id: string; name: string; code: string }
interface Student { id: string; name: string; admissionNo: string; className: string | null; avatarUrl: string | null }

interface Props {
  fiscalYearName: string
  incomeAccounts: Acc[]
  banks:          Bank[]
}

type Method = "CASH" | "BANK" | "CHEQUE" | "ONLINE"

export function CollectFeeClient({ fiscalYearName, incomeAccounts, banks }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [dateBS,        setDateBS]       = useState(todayBS())
  const [studentQ,      setStudentQ]     = useState("")
  const [student,       setStudent]      = useState<Student | null>(null)
  const [suggestions,   setSuggestions]  = useState<Student[]>([])
  const [showSuggest,   setShowSuggest]  = useState(false)
  const [feeAccountId,  setFeeAccountId] = useState(incomeAccounts[0]?.id ?? "")
  const [amount,        setAmount]       = useState("")
  const [method,        setMethod]       = useState<Method>("CASH")
  const [bankAccountId, setBankAccountId]= useState(banks[0]?.id ?? "")
  const [remarks,       setRemarks]      = useState("")
  const wrapRef = useRef<HTMLDivElement>(null)

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

  const canSubmit =
    !!student && !!feeAccountId && !!dateBS &&
    parseFloat(amount || "0") > 0 &&
    (method === "CASH" || !!bankAccountId)

  function handleSubmit() {
    if (!canSubmit || !student) { toast.error("Fill all required fields"); return }
    start(async () => {
      try {
        const res = await recordFeePayment({
          studentId:     student.id,
          feeAccountId,
          amount:        String(parseFloat(amount)),
          method,
          bankAccountId: method === "CASH" ? null : bankAccountId,
          dateBS,
          remarks:       remarks.trim() || null,
        })
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

        {/* Fee head + Amount */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fee head *</label>
            <select value={feeAccountId} onChange={e => setFeeAccountId(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
              <option value="">— Select —</option>
              {incomeAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Amount (Rs.) *</label>
            <Input
              type="text" inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono text-right"
            />
          </div>
        </div>

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
