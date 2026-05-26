"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Sparkles, Layers, ReceiptText, X, ArrowRight, UserRound, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { applyPlanToTarget } from "@/actions/billing/fee-plans"
import { billPeriod, bulkEditStudentFees, type StudentFeeRow } from "@/actions/billing/student-fees"

interface StudentInfo {
  id:          string
  name:        string
  admissionNo: string
  section:     string | null
  avatarUrl:   string | null
}

interface PlanOption {
  id: string; name: string; itemCount: number
}

interface Month {
  monthIndex: number; label: string
}

interface Props {
  classId:            string
  students:           StudentInfo[]
  rows:               StudentFeeRow[]
  plans:              PlanOption[]
  months:             Month[]
  fiscalYears:        Array<{ id: string; name: string }>
  activeFiscalYearId: string
  activePeriodIndex?: number
}

const STATUS_TONE: Record<string, string> = {
  PLANNED:   "bg-slate-100 text-slate-600 border-slate-200",
  BILLED:    "bg-amber-50  text-amber-700 border-amber-200",
  OVERDUE:   "bg-rose-50   text-rose-700  border-rose-200",
  PARTIAL:   "bg-sky-50    text-sky-700   border-sky-200",
  PAID:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-50  text-slate-400  border-slate-200 line-through",
}

export function ClassGridClient({
  classId, students, rows, plans, months, fiscalYears, activeFiscalYearId, activePeriodIndex,
}: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applyOpen, setApply]   = useState(false)
  const [billOpen, setBill]     = useState(false)
  const [bulkOpen, setBulk]     = useState(false)

  // Group rows by (studentId, feeHeadId). When a period is selected we get one row per cell;
  // when "All" is selected we sum across periods to show a roll-up.
  const cells = useMemo(() => {
    const m = new Map<string, StudentFeeRow[]>()
    for (const r of rows) {
      const key = `${r.studentId}::${r.feeHeadId}`
      const arr = m.get(key) ?? []
      arr.push(r)
      m.set(key, arr)
    }
    return m
  }, [rows])

  // Unique fee heads present in the data (column order)
  const heads = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>()
    for (const r of rows) {
      if (!seen.has(r.feeHeadId)) seen.set(r.feeHeadId, { id: r.feeHeadId, name: r.feeHeadName })
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  function setQuery(key: string, value: string | null) {
    const params = new URLSearchParams(sp)
    if (value === null) params.delete(key); else params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  function clearSelect() { setSelected(new Set()) }

  const totalBilled = useMemo(() => rows.reduce((s, r) => s + parseFloat(r.finalAmount), 0), [rows])
  const totalPaid   = useMemo(() => rows.reduce((s, r) => s + parseFloat(r.paidAmount),  0), [rows])

  return (
    <div className="space-y-4">
      {/* Filter row + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">FY</span>
          <select
            value={activeFiscalYearId}
            onChange={e => setQuery("fy", e.target.value)}
            className="h-9 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          >
            {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 ml-2">Period</span>
          <select
            value={activePeriodIndex ?? ""}
            onChange={e => setQuery("period", e.target.value || null)}
            className="h-9 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          >
            <option value="">All periods</option>
            <option value="0">Annual / One-time</option>
            {months.map(m => <option key={m.monthIndex} value={m.monthIndex}>{m.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs font-bold text-slate-600">{selected.size} row{selected.size === 1 ? "" : "s"}</span>
              <Button variant="outline" size="sm" onClick={() => setBulk(true)} className="gap-1.5 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" />Bulk Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelect} className="cursor-pointer text-slate-500">Clear</Button>
            </>
          )}
          {activePeriodIndex !== undefined && (
            <Button size="sm" onClick={() => setBill(true)} className="gap-1.5 cursor-pointer shadow-sm">
              <ReceiptText className="w-3.5 h-3.5" />Bill Period
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setApply(true)} className="gap-1.5 cursor-pointer">
            <Layers className="w-3.5 h-3.5" />Apply Plan
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Students"    value={`${students.length}`} />
        <KPICard label="Billed (FY)" value={`Rs. ${totalBilled.toFixed(2)}`} tone="slate" />
        <KPICard label="Outstanding" value={`Rs. ${Math.max(0, totalBilled - totalPaid).toFixed(2)}`} tone={totalBilled - totalPaid > 0 ? "rose" : "emerald"} />
      </div>

      {/* Grid */}
      {students.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <UserRound className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No active students in this class.</p>
        </div>
      ) : heads.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No fees scheduled for this class yet.</p>
          <p className="text-xs text-slate-400 mt-1">Click <strong>Apply Plan</strong> above to generate rows from a plan template.</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-x-auto">
          <table className="text-xs min-w-full">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-[10px] text-slate-500 sticky left-0 bg-slate-50/80 z-10 min-w-[200px]">Student</th>
                {heads.map(h => (
                  <th key={h.id} className="text-center px-2 py-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[120px]">
                    {h.name}
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[100px]">Row Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map(s => {
                const initials = s.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
                let rowTotal = 0
                return (
                  <tr key={s.id} className="hover:bg-slate-50/40">
                    <td className="px-3 py-2 sticky left-0 bg-white/85 z-10 border-r border-slate-100">
                      <Link href={`/finance/students/${s.id}`} className="flex items-center gap-2 group">
                        {s.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.avatarUrl} alt={s.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0">
                            <span className="text-[9px] font-bold text-emerald-700">{initials}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold truncate group-hover:text-primary transition-colors">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{s.admissionNo}{s.section && ` · ${s.section}`}</p>
                        </div>
                      </Link>
                    </td>
                    {heads.map(h => {
                      const list = cells.get(`${s.id}::${h.id}`) ?? []
                      if (list.length === 0) {
                        return <td key={h.id} className="px-1.5 py-1.5"><div className="h-12 rounded-md border border-dashed border-slate-200/60 bg-slate-50/40" /></td>
                      }
                      const final = list.reduce((sum, r) => sum + parseFloat(r.finalAmount), 0)
                      const paid  = list.reduce((sum, r) => sum + parseFloat(r.paidAmount),  0)
                      rowTotal += final
                      const allPaid = list.every(r => r.status === "PAID")
                      const anyOverdue = list.some(r => r.isOverdue && r.status !== "PAID")
                      // Label = actual status by default; "OVERDUE" only when past due AND unpaid.
                      // Tone (color) tracks the label.
                      const label = allPaid ? "PAID" : anyOverdue ? "OVERDUE" : list[0].status
                      const tone  = label
                      const anySelected = list.some(r => selected.has(r.id))
                      return (
                        <td key={h.id} className="px-1.5 py-1.5 align-top">
                          <button
                            type="button"
                            onClick={e => {
                              if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                // toggle this whole cell into selection
                                setSelected(prev => {
                                  const next = new Set(prev)
                                  const allIn = list.every(r => next.has(r.id))
                                  for (const r of list) {
                                    if (allIn) next.delete(r.id); else next.add(r.id)
                                  }
                                  return next
                                })
                              } else {
                                // open student schedule for editing
                                router.push(`/finance/students/${s.id}`)
                              }
                            }}
                            className={cn(
                              "w-full h-12 rounded-md border text-left px-2 py-1 transition-all cursor-pointer",
                              anySelected ? "ring-2 ring-primary border-primary/40 bg-primary/5" : STATUS_TONE[tone] ?? STATUS_TONE.PLANNED,
                            )}
                            title={list.length > 1 ? `${list.length} periods · click to open schedule` : `${list[0].periodLabel} · click to open schedule`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono tabular-nums text-[11px] font-bold truncate">{final.toFixed(2)}</span>
                              {list.length > 1 && <span className="text-[9px] font-bold text-slate-500 bg-white/60 px-1 rounded">{list.length}×</span>}
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[9px] uppercase tracking-widest font-black text-slate-500">{label}</span>
                              {paid > 0 && paid < final && <span className="text-[9px] font-mono text-emerald-700">{paid.toFixed(0)}</span>}
                            </div>
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900 border-l border-slate-100">
                      {rowTotal.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {applyOpen && (
        <ApplyPlanSheet
          classId={classId}
          plans={plans}
          onClose={() => setApply(false)}
          onSaved={() => { setApply(false); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}

      {billOpen && activePeriodIndex !== undefined && (
        <BillPeriodSheet
          classId={classId}
          fiscalYearId={activeFiscalYearId}
          periodIndex={activePeriodIndex}
          periodLabel={
            activePeriodIndex === 0
              ? "Annual / One-time"
              : months.find(m => m.monthIndex === activePeriodIndex)?.label ?? `Period ${activePeriodIndex}`
          }
          onClose={() => setBill(false)}
          onSaved={() => { setBill(false); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}

      {bulkOpen && (
        <BulkEditSheet
          ids={Array.from(selected)}
          onClose={() => setBulk(false)}
          onSaved={() => { setBulk(false); clearSelect(); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}
    </div>
  )
}

// ─── Sheets ─────────────────────────────────────────────────────────────────

function ApplyPlanSheet({
  classId, plans, onClose, onSaved, pending, start,
}: {
  classId: string
  plans: PlanOption[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "")
  function handleApply() {
    if (!planId) return
    start(async () => {
      try {
        const res = await applyPlanToTarget({ planId, classId })
        toast.success(`Applied: ${res.studentsTouched} students, ${res.rowsCreated} new rows, ${res.rowsSkipped} already existed`)
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }
  if (plans.length === 0) {
    return (
      <Backdrop onClose={onClose}>
        <Sheet title="Apply Plan" onClose={onClose}>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
            No active plans for this fiscal year. <Link href="/finance/plans" className="underline font-bold">Create a plan →</Link>
          </div>
        </Sheet>
      </Backdrop>
    )
  }
  return (
    <Backdrop onClose={onClose}>
      <Sheet title="Apply Plan to Class" onClose={onClose}>
        <p className="text-xs text-slate-500">Generates one row per student × fee head × period from the plan template. Existing rows are skipped (idempotent).</p>
        <Field label="Plan">
          <select value={planId} onChange={e => setPlanId(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}</option>)}
          </select>
        </Field>
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
          <Button onClick={handleApply} disabled={pending || !planId} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />Apply
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">Target: all active students in this class.</p>
        <input type="hidden" value={classId} readOnly />
      </Sheet>
    </Backdrop>
  )
}

function BillPeriodSheet({
  classId, fiscalYearId, periodIndex, periodLabel, onClose, onSaved, pending, start,
}: {
  classId: string
  fiscalYearId: string
  periodIndex: number
  periodLabel: string
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  function handleBill() {
    start(async () => {
      try {
        const res = await billPeriod({ fiscalYearId, periodIndex, classId })
        toast.success(`${res.billed} row${res.billed === 1 ? "" : "s"} billed with prefix ${res.voucherPrefix}`)
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }
  return (
    <Backdrop onClose={onClose}>
      <Sheet title={`Bill ${periodLabel}`} onClose={onClose}>
        <p className="text-xs text-slate-500">Flips all PLANNED rows in this class for <strong>{periodLabel}</strong> to <strong>BILLED</strong> status with sequential voucher numbers. Already-billed rows are untouched.</p>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>Once billed, rows appear in the parent&apos;s outstanding list at <Link href="/finance/collect" className="underline font-bold">Collect Fee</Link>.</div>
        </div>
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
          <Button onClick={handleBill} disabled={pending} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <ReceiptText className="w-3.5 h-3.5" />Bill Period
          </Button>
        </div>
      </Sheet>
    </Backdrop>
  )
}

function BulkEditSheet({
  ids, onClose, onSaved, pending, start,
}: {
  ids: string[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [pct,    setPct]    = useState("")
  const [reason, setReason] = useState("")
  const [base,   setBase]   = useState("")
  const [due,    setDue]    = useState("")

  function handleSave() {
    if (!pct && !base && !due) { toast.error("Provide at least one field to apply"); return }
    start(async () => {
      try {
        const res = await bulkEditStudentFees({
          ids,
          ...(base && { baseAmount: base }),
          ...(pct  && { scholarshipPct: pct, scholarshipReason: reason.trim() || null }),
          ...(due  && { dueDateBS: due }),
          skipPaid: true,
        })
        toast.success(`Updated ${res.updated} of ${res.matched} (${res.skipped} skipped)`)
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Sheet title={`Bulk Edit — ${ids.length} row${ids.length === 1 ? "" : "s"}`} onClose={onClose}>
        <p className="text-xs text-slate-500">PAID and CANCELLED rows are skipped. Leave a field blank to keep current value.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scholarship %">
            <Input type="text" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} placeholder="e.g. 30" className="font-mono text-right" />
          </Field>
          <Field label="Base amount (Rs.)">
            <Input type="text" inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} placeholder="e.g. 5500" className="font-mono text-right" />
          </Field>
        </div>
        <Field label="Scholarship reason">
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Topper merit, sibling discount, …" />
        </Field>
        <Field label="Due date (BS)">
          <NepaliDateInput value={due} onChange={setDue} />
        </Field>
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Close</Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />Apply to {ids.length}
          </Button>
        </div>
      </Sheet>
    </Backdrop>
  )
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >{children}</div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-white/40 my-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
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

function KPICard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "rose" | "emerald" }) {
  const cls = { slate: "text-slate-700", rose: "text-rose-700", emerald: "text-emerald-700" }[tone]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-3">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      <p className={`text-lg font-bold font-mono tabular-nums mt-1 ${cls}`}>{value}</p>
    </div>
  )
}
