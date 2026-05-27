"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Pencil, X, Sparkles, Plus, Ban, ReceiptText, FileMinus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import {
  editStudentFee, bulkEditStudentFees, createAdhocStudentFee, cancelStudentFee, writeOffStudentFee,
  type StudentFeeRow,
} from "@/actions/billing/student-fees"
import { todayBS } from "@/lib/nepali-date"

interface HeadOption {
  id:            string
  name:          string
  frequency:     string
  defaultAmount: string
  defaultDueDay: number | null
}

interface Month {
  monthIndex: number
  label:      string
}

interface Props {
  studentId:          string
  rows:               StudentFeeRow[]
  heads:              HeadOption[]
  months:             Month[]
  fiscalYears:        Array<{ id: string; name: string }>
  activeFiscalYearId: string
}

// Cells are indexed by (feeHeadId, periodIndex). periodIndex 0 = Annual/OneTime.
type CellMap = Map<string, StudentFeeRow>

function cellKey(headId: string, periodIndex: number) {
  return `${headId}::${periodIndex}`
}

const STATUS_TONE: Record<string, string> = {
  PLANNED:   "bg-slate-100 text-slate-600 border-slate-200",
  BILLED:    "bg-amber-50  text-amber-700 border-amber-200",
  PARTIAL:   "bg-sky-50    text-sky-700   border-sky-200",
  PAID:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-50   text-rose-700  border-rose-200",
  OVERDUE:   "bg-rose-50   text-rose-700  border-rose-300",
}

export function ScheduleClient({ studentId, rows, heads, months, fiscalYears, activeFiscalYearId }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, start] = useTransition()

  // Build lookup map of existing rows
  const cells = useMemo<CellMap>(() => {
    const m = new Map<string, StudentFeeRow>()
    for (const r of rows) m.set(cellKey(r.feeHeadId, r.periodIndex), r)
    return m
  }, [rows])

  // Distinct heads present in rows (preserved order from server) — falls back to active heads list when no rows yet
  const headsInGrid = useMemo(() => {
    const seen = new Set<string>()
    const list: HeadOption[] = []
    for (const r of rows) {
      if (seen.has(r.feeHeadId)) continue
      seen.add(r.feeHeadId)
      const h = heads.find(h => h.id === r.feeHeadId)
      if (h) list.push(h)
    }
    return list
  }, [rows, heads])

  // Selection state for bulk-edit
  const [selected, setSelected] = useState<Set<string>>(new Set())  // StudentFee row IDs
  const [editing, setEditing]   = useState<StudentFeeRow | null>(null)
  const [adhocOpen, setAdhoc]   = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function clearSelect() { setSelected(new Set()) }

  function changeFY(id: string) {
    const params = new URLSearchParams(sp)
    params.set("fy", id)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Fiscal Year</span>
          <select
            value={activeFiscalYearId}
            onChange={e => changeFY(e.target.value)}
            className="h-9 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          >
            {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs font-bold text-slate-600">{selected.size} cell{selected.size === 1 ? "" : "s"} selected</span>
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" />Apply Discount
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelect} className="cursor-pointer text-slate-500">Clear</Button>
            </>
          )}
          <Button size="sm" onClick={() => setAdhoc(true)} className="gap-1.5 cursor-pointer shadow-sm">
            <Plus className="w-3.5 h-3.5" />Add Charge
          </Button>
        </div>
      </div>

      {/* Grid */}
      {headsInGrid.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <ReceiptText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No fees scheduled for this student yet.</p>
          <p className="text-xs text-slate-400 mt-1">Apply a plan from this student&apos;s class, or click <strong>Add Charge</strong> for an ad-hoc fee.</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <p className="md:hidden text-[10px] text-slate-500 px-3 py-1.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1">
            <span aria-hidden>↔</span> Scroll horizontally to see all months
          </p>
          <div className="overflow-x-auto [scrollbar-color:theme(colors.slate.300)_transparent]">
            <table className="text-[11px] w-full table-fixed min-w-[760px]">
              <colgroup>
                <col className="w-[140px]" />
                <col className="w-[58px]" />
                {months.map(m => <col key={m.monthIndex} className="w-[58px]" />)}
              </colgroup>
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="text-left px-2 py-1.5 font-black uppercase tracking-widest text-[9px] text-slate-500 sticky left-0 bg-slate-50/95 backdrop-blur-sm z-10">Fee Head</th>
                  <th className="text-center px-1 py-1.5 font-black uppercase tracking-widest text-[9px] text-slate-500" title="Annual / One-time / Event charges">Annual</th>
                  {months.map(m => {
                    const short = m.label.split(" ")[0].slice(0, 3)
                    return (
                      <th
                        key={m.monthIndex}
                        scope="col"
                        className="text-center px-0.5 py-1.5 font-black uppercase tracking-wide text-[9px] text-slate-500"
                        title={m.label}
                        aria-label={m.label}
                      >
                        {short}
                      </th>
                    )
                  })}
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-100">
              {headsInGrid.map(h => (
                <tr key={h.id} className="hover:bg-slate-50/40">
                  <td className="px-2 py-1.5 border-r border-slate-100 sticky left-0 bg-white/95 backdrop-blur-sm z-10" title={`${h.name} · ${h.frequency}`}>
                    <p className="font-bold text-slate-700 truncate text-[11px]">{h.name}</p>
                    <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">{h.frequency}</p>
                  </td>
                  {/* Annual cell (periodIndex=0) — only for non-MONTHLY heads */}
                  <td className="px-0.5 py-1 align-top">
                    {h.frequency !== "MONTHLY" ? (
                      <Cell
                        row={cells.get(cellKey(h.id, 0))}
                        selected={selected}
                        onSelect={toggleSelect}
                        onEdit={r => setEditing(r)}
                      />
                    ) : (
                      <div className="h-11 bg-slate-50/50 rounded border border-dashed border-slate-200/60" />
                    )}
                  </td>
                  {/* 12 Monthly cells */}
                  {months.map(m => (
                    <td key={m.monthIndex} className="px-0.5 py-1 align-top">
                      {h.frequency === "MONTHLY" ? (
                        <Cell
                          row={cells.get(cellKey(h.id, m.monthIndex))}
                          selected={selected}
                          onSelect={toggleSelect}
                          onEdit={r => setEditing(r)}
                        />
                      ) : (
                        <div className="h-11 bg-slate-50/50 rounded border border-dashed border-slate-200/60" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Single-cell editor */}
      {editing && (
        <EditCellSheet
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}

      {/* Bulk-edit sheet */}
      {bulkOpen && (
        <BulkEditSheet
          ids={Array.from(selected)}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); clearSelect(); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}

      {/* Ad-hoc add */}
      {adhocOpen && (
        <AddChargeSheet
          studentId={studentId}
          fiscalYearId={activeFiscalYearId}
          heads={heads}
          months={months}
          onClose={() => setAdhoc(false)}
          onSaved={() => { setAdhoc(false); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}
    </div>
  )
}

// ─── Cell ────────────────────────────────────────────────────────────────────

function Cell({
  row, selected, onSelect, onEdit,
}: {
  row: StudentFeeRow | undefined
  selected: Set<string>
  onSelect: (id: string) => void
  onEdit: (r: StudentFeeRow) => void
}) {
  if (!row) {
    return <div className="h-11 bg-slate-50/40 rounded border border-slate-200/40" />
  }
  const isSel = selected.has(row.id)
  const isEditable = row.status !== "PAID" && row.status !== "CANCELLED"
  const hasDiscount = parseFloat(row.scholarshipPct) > 0
  const final = parseFloat(row.finalAmount)
  const paid  = parseFloat(row.paidAmount)
  const outstanding = Math.max(0, final - paid)
  const isPartial = row.status === "PARTIAL" && paid > 0 && paid < final
  // Compact: drop the decimals to fit in narrow column (full amount shown on hover/edit).
  // PARTIAL rows show the outstanding (what's still owed) as the headline number;
  // everyone else shows the full bill amount.
  const headline = isPartial ? Math.round(outstanding).toString() : Math.round(final).toString()
  const tone = row.isOverdue ? STATUS_TONE.OVERDUE ?? STATUS_TONE.BILLED : STATUS_TONE[row.status] ?? STATUS_TONE.PLANNED
  // Status glyph — shape encodes status (in addition to colour) so colour-blind
  // users have a non-colour signal. WCAG 1.4.1 (Use of Color).
  const glyph = row.isOverdue ? "!"
    : row.status === "PAID"      ? "✓"
    : row.status === "PARTIAL"   ? "½"
    : row.status === "BILLED"    ? "B"
    : row.status === "CANCELLED" ? "✕"
    :                              "·"  // PLANNED
  const statusLabel = row.isOverdue ? "Overdue" : row.status.charAt(0) + row.status.slice(1).toLowerCase()
  return (
    <button
      type="button"
      onClick={e => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onSelect(row.id)
        else onEdit(row)
      }}
      className={cn(
        "w-full h-11 rounded border text-center px-0.5 py-0.5 transition-all cursor-pointer relative leading-tight",
        isSel ? "ring-2 ring-primary border-primary/40 bg-primary/5" : tone,
        !isEditable && "opacity-75",
      )}
      aria-label={`${row.feeHeadName} ${row.periodLabel} Rs ${row.finalAmount} ${statusLabel}${row.isOverdue && row.status !== "PAID" ? " overdue" : ""}`}
      title={`${row.feeHeadName} · ${row.periodLabel} · Rs. ${row.finalAmount}${isPartial ? ` (Rs. ${row.paidAmount} paid, Rs. ${outstanding.toFixed(2)} left)` : ""} · ${row.status}${row.isOverdue ? " (OVERDUE)" : ""} · Due ${row.dueDateBS}${row.scholarshipReason ? ` · ${row.scholarshipPct}% off (${row.scholarshipReason})` : ""}`}
    >
      <div className="font-mono tabular-nums text-[10px] font-bold truncate">{headline}</div>
      <div className="flex items-center justify-center gap-1">
        <span aria-hidden className={cn("inline-flex items-center justify-center w-3 h-3 rounded-full text-[8px] font-black leading-none flex-shrink-0",
          row.isOverdue ? "bg-rose-500 text-white"
          : row.status === "PAID" ? "bg-emerald-500 text-white"
          : row.status === "PARTIAL" ? "bg-sky-500 text-white"
          : row.status === "BILLED" ? "bg-amber-500 text-white"
          : row.status === "CANCELLED" ? "bg-slate-400 text-white"
          : "bg-slate-300 text-slate-600",
        )}>{glyph}</span>
        {isPartial && (
          <span className="text-[8px] font-mono font-bold text-sky-700 tabular-nums">
            {Math.round(paid)}/{Math.round(final)}
          </span>
        )}
        {hasDiscount && <span className="text-[8px] font-black text-violet-700">-{Math.round(parseFloat(row.scholarshipPct))}%</span>}
      </div>
    </button>
  )
}

// ─── Edit single cell ───────────────────────────────────────────────────────

function EditCellSheet({
  row, onClose, onSaved, pending, start,
}: {
  row: StudentFeeRow
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [base,   setBase]   = useState(row.baseAmount)
  const [pct,    setPct]    = useState(row.scholarshipPct)
  const [reason, setReason] = useState(row.scholarshipReason ?? "")
  const [due,    setDue]    = useState(row.dueDateBS)
  const [notes,  setNotes]  = useState(row.notes ?? "")

  const isEditable = row.status !== "PAID" && row.status !== "CANCELLED"

  const finalPreview = useMemo(() => {
    const b = parseFloat(base || "0")
    const p = parseFloat(pct || "0")
    return (b * (1 - p / 100)).toFixed(2)
  }, [base, pct])

  function handleSave() {
    start(async () => {
      try {
        await editStudentFee({
          id: row.id,
          baseAmount: base,
          scholarshipPct: pct,
          scholarshipReason: reason.trim() || null,
          dueDateBS: due,
          notes: notes.trim() || null,
        })
        toast.success("Updated")
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  function handleCancel() {
    const r = prompt("Reason to cancel this charge?")
    if (!r || !r.trim()) return
    start(async () => {
      try {
        await cancelStudentFee(row.id, r.trim())
        toast.success("Cancelled")
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  function handleWriteOff() {
    const balance = parseFloat(row.finalAmount) - parseFloat(row.paidAmount)
    const r = prompt(`Write off Rs. ${balance.toFixed(2)} of unpaid balance — reason?`)
    if (!r || !r.trim()) return
    start(async () => {
      try {
        const res = await writeOffStudentFee(row.id, r.trim())
        toast.success(`Written off Rs. ${res.writtenOffAmount}`)
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Sheet title={`${row.feeHeadName} · ${row.periodLabel}`} onClose={onClose}>
        <SheetMeta row={row} />
        {!isEditable && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            This row is {row.status.toLowerCase()} and cannot be edited.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Base amount (Rs.)">
            <Input type="text" inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} disabled={!isEditable} className="font-mono text-right" />
          </Field>
          <Field label="Scholarship %">
            <Input type="text" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} disabled={!isEditable} className="font-mono text-right" />
          </Field>
        </div>

        <Field label="Scholarship reason">
          <Input value={reason} onChange={e => setReason(e.target.value)} disabled={!isEditable} placeholder="Topper merit, sibling discount, staff child, …" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date (BS)">
            <NepaliDateInput value={due} onChange={setDue} />
          </Field>
          <Field label="Final after discount">
            <div className="h-11 flex items-center justify-end px-3 rounded-xl bg-emerald-50 border border-emerald-200 font-mono tabular-nums text-base font-bold text-emerald-700">
              Rs. {finalPreview}
            </div>
          </Field>
        </div>

        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} disabled={!isEditable} placeholder="Optional" />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={pending || row.status === "PAID" || parseFloat(row.paidAmount) > 0 || row.status === "CANCELLED"}
              className="text-rose-600 hover:bg-rose-50 cursor-pointer gap-1.5"
              title="Cancel a row that should never have been billed"
            >
              <Ban className="w-3.5 h-3.5" />Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={handleWriteOff}
              disabled={pending || row.status === "PAID" || row.status === "CANCELLED" || row.status === "PLANNED"}
              className="text-amber-700 hover:bg-amber-50 cursor-pointer gap-1.5"
              title="Forgive the unpaid balance on a legitimate bill (uncollectable debt, hardship waiver)"
            >
              <FileMinus className="w-3.5 h-3.5" />Write off
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">Close</Button>
            <Button onClick={handleSave} disabled={pending || !isEditable} className="cursor-pointer shadow-md shadow-primary/20">Save</Button>
          </div>
        </div>
      </Sheet>
    </Backdrop>
  )
}

// ─── Bulk edit ──────────────────────────────────────────────────────────────

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
      <Sheet title={`Bulk Edit — ${ids.length} cell${ids.length === 1 ? "" : "s"}`} onClose={onClose}>
        <p className="text-xs text-slate-500">PAID and CANCELLED cells will be skipped automatically. Leave a field blank to keep its current value.</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Scholarship %">
            <Input type="text" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} placeholder="e.g. 30" className="font-mono text-right" />
          </Field>
          <Field label="Base amount override (Rs.)">
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
            <Sparkles className="w-3.5 h-3.5" />Apply to {ids.length} cell{ids.length === 1 ? "" : "s"}
          </Button>
        </div>
      </Sheet>
    </Backdrop>
  )
}

// ─── Ad-hoc add ─────────────────────────────────────────────────────────────

function AddChargeSheet({
  studentId, fiscalYearId, heads, months, onClose, onSaved, pending, start,
}: {
  studentId: string
  fiscalYearId: string
  heads: HeadOption[]
  months: Month[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [headId,    setHeadId]    = useState(heads[0]?.id ?? "")
  const [period,    setPeriod]    = useState(0)
  const [amount,    setAmount]    = useState(heads[0]?.defaultAmount ?? "")
  const [pct,       setPct]       = useState("0")
  const [reason,    setReason]    = useState("")
  const [dueDateBS, setDueDateBS] = useState(todayBS())
  const [notes,     setNotes]     = useState("")

  const head = heads.find(h => h.id === headId)
  const isMonthly = head?.frequency === "MONTHLY"

  function onHeadChange(id: string) {
    setHeadId(id)
    const h = heads.find(x => x.id === id)
    if (h) {
      setAmount(h.defaultAmount)
      if (h.frequency !== "MONTHLY") setPeriod(0)
      else if (period === 0) setPeriod(1)
    }
  }

  function handleSave() {
    if (!head) { toast.error("Pick a fee head"); return }
    const monthLabel = months.find(m => m.monthIndex === period)?.label
    const periodLabel = isMonthly ? (monthLabel ?? `Period ${period}`) : head.name
    start(async () => {
      try {
        await createAdhocStudentFee({
          studentId,
          fiscalYearId,
          feeHeadId:         headId,
          periodIndex:       isMonthly ? period : 0,
          periodLabel,
          baseAmount:        amount,
          scholarshipPct:    pct || "0",
          scholarshipReason: reason.trim() || null,
          dueDateBS,
          notes:             notes.trim() || null,
        })
        toast.success("Charge added")
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  if (heads.length === 0) {
    return (
      <Backdrop onClose={onClose}>
        <Sheet title="Add Charge" onClose={onClose}>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
            No fee heads yet. <Link href="/finance/heads" className="font-bold underline">Create one in Fee Heads →</Link>
          </div>
        </Sheet>
      </Backdrop>
    )
  }

  return (
    <Backdrop onClose={onClose}>
      <Sheet title="Add Ad-hoc Charge" onClose={onClose}>
        <Field label="Fee head">
          <select value={headId} onChange={e => onHeadChange(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {heads.map(h => <option key={h.id} value={h.id}>{h.name} · {h.frequency}</option>)}
          </select>
        </Field>

        {isMonthly && (
          <Field label="Period (month)">
            <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
              {months.map(m => <option key={m.monthIndex} value={m.monthIndex}>{m.label}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (Rs.)">
            <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-right" />
          </Field>
          <Field label="Scholarship %">
            <Input type="text" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} className="font-mono text-right" />
          </Field>
        </div>

        <Field label="Scholarship reason">
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional" />
        </Field>

        <Field label="Due date (BS)">
          <NepaliDateInput value={dueDateBS} onChange={setDueDateBS} />
        </Field>

        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </Field>

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Close</Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <Plus className="w-3.5 h-3.5" />Add Charge
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
    >
      {children}
    </div>
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

function SheetMeta({ row }: { row: StudentFeeRow }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] space-y-1">
      <Row label="Status" value={
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase tracking-widest font-black border", STATUS_TONE[row.status] ?? STATUS_TONE.PLANNED)}>
          {row.status}
        </span>
      } />
      <Row label="Paid"     value={<span className="font-mono">Rs. {row.paidAmount} of Rs. {row.finalAmount}</span>} />
      <span className="text-slate-400 pointer-events-none"><Pencil className="w-3 h-3 inline mr-1 mb-0.5" />Edit below — PAID amount is the floor for &quot;final&quot;.</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 uppercase tracking-widest text-[9px] font-black">{label}</span>
      {value}
    </div>
  )
}
