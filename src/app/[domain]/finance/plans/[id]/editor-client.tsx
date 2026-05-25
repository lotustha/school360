"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Sparkles, Save, X, ArrowRight, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  createFeePlan, updateFeePlan, applyPlanToTarget, type FeePlanDetail,
} from "@/actions/billing/fee-plans"

interface HeadOption {
  id:            string
  name:          string
  frequency:     string
  defaultAmount: string
  defaultDueDay: number | null
}

interface ClassOption { id: string; name: string; studentCount: number }

interface Props {
  plan:        FeePlanDetail | null  // null = new
  fiscalYears: Array<{ id: string; name: string; isCurrent: boolean }>
  heads:       HeadOption[]
  classes:     ClassOption[]
}

interface DraftItem {
  key:        string
  id?:        string
  feeHeadId:  string
  amount:     string
  periods:    string
  dueDay:     number
  notes:      string
}

function newItem(head?: HeadOption): DraftItem {
  return {
    key:       Math.random().toString(36).slice(2),
    feeHeadId: head?.id ?? "",
    amount:    head?.defaultAmount ?? "",
    periods:   head?.frequency === "MONTHLY" ? "1,2,3,4,5,6,7,8,9,10,11,12" : "0",
    dueDay:    head?.defaultDueDay ?? 10,
    notes:     "",
  }
}

const BS_MONTHS = ["Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"]
const AD_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export function PlanEditorClient({ plan, fiscalYears, heads, classes }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name,           setName]           = useState(plan?.name ?? "")
  const [description,    setDescription]    = useState(plan?.description ?? "")
  const [fiscalYearId,   setFiscalYearId]   = useState(plan?.fiscalYearId ?? fiscalYears.find(f => f.isCurrent)?.id ?? fiscalYears[0]?.id ?? "")
  const [calendarSystem, setCalendarSystem] = useState<"BS" | "AD">((plan?.calendarSystem as "BS" | "AD") ?? "BS")
  const [startMonth,     setStartMonth]     = useState<number>(plan?.startMonth ?? 4)
  const [startYear,      setStartYear]      = useState<number>(plan?.startYear ?? (new Date().getFullYear() + 57))  // rough BS default
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (plan?.items) return plan.items.map(it => ({
      key: it.id, id: it.id, feeHeadId: it.feeHeadId, amount: it.amount, periods: it.periods, dueDay: it.dueDay, notes: it.notes ?? "",
    }))
    return [newItem(heads[0])]
  })
  const [applyOpen, setApplyOpen] = useState(false)

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }
  function addItem() {
    setItems(prev => [...prev, newItem(heads[0])])
  }
  function removeItem(key: string) {
    setItems(prev => prev.length <= 1 ? prev : prev.filter(it => it.key !== key))
  }

  // When fee head changes on an item, populate defaults
  function changeItemHead(key: string, headId: string) {
    const h = heads.find(x => x.id === headId)
    if (!h) { patchItem(key, { feeHeadId: headId }); return }
    patchItem(key, {
      feeHeadId: headId,
      amount:    h.defaultAmount,
      dueDay:    h.defaultDueDay ?? 10,
      periods:   h.frequency === "MONTHLY" ? "1,2,3,4,5,6,7,8,9,10,11,12" : "0",
    })
  }

  function handleSave() {
    if (!name.trim())     { toast.error("Name required"); return }
    if (!fiscalYearId)    { toast.error("Fiscal year required"); return }
    const valid = items.filter(it => it.feeHeadId && parseFloat(it.amount || "0") > 0)
    if (valid.length === 0) { toast.error("Add at least one fee item"); return }

    start(async () => {
      try {
        if (plan) {
          await updateFeePlan({
            id: plan.id,
            name:           name.trim(),
            description:    description.trim() || null,
            calendarSystem,
            startMonth,
            startYear,
            items: valid.map(it => ({
              feeHeadId: it.feeHeadId,
              amount:    it.amount,
              periods:   it.periods,
              dueDay:    it.dueDay,
              notes:     it.notes.trim() || null,
            })),
          })
          toast.success("Plan saved")
          router.refresh()
        } else {
          await createFeePlan({
            fiscalYearId,
            name:           name.trim(),
            description:    description.trim() || null,
            calendarSystem,
            startMonth,
            startYear,
            items: valid.map(it => ({
              feeHeadId: it.feeHeadId,
              amount:    it.amount,
              periods:   it.periods,
              dueDay:    it.dueDay,
              notes:     it.notes.trim() || null,
            })),
          })
          toast.success("Plan created")
          router.push("/finance/plans")
        }
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold tracking-tight">{plan ? plan.name : "New Plan"}</h1>
          {plan && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span><strong className="text-slate-900">{plan.itemCount}</strong> items</span>
              <span><strong className="text-slate-900">{plan.generatedCount}</strong> rows generated</span>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Class 10 Standard FY 2082/83" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fiscal year</label>
            <select
              value={fiscalYearId}
              onChange={e => setFiscalYearId(e.target.value)}
              disabled={!!plan}
              className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
            >
              {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}{f.isCurrent ? " (current)" : ""}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Description</label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
        </div>

        <div className="rounded-xl bg-sky-50/70 border border-sky-200 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-sky-800 inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />Academic calendar
            </p>
            <p className="text-[11px] text-sky-700/80">Controls how monthly periods are named &amp; dated.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-sky-700/80 mb-1.5 block">Calendar</label>
              <div className="flex gap-1 p-1 bg-white rounded-lg border border-sky-200">
                {(["BS","AD"] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCalendarSystem(c)
                      // Sensible defaults: BS picks Shrawan (4) ~ FY anchor; AD picks Jan (1)
                      if (c === "BS" && startMonth > 12) setStartMonth(4)
                      if (c === "AD" && startYear > 2100) setStartYear(new Date().getFullYear())
                      if (c === "BS" && startYear < 2000) setStartYear(2082)
                    }}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition",
                      calendarSystem === c ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:text-slate-900",
                    )}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-sky-700/80 mb-1.5 block">Starting month</label>
              <select
                value={startMonth}
                onChange={e => setStartMonth(Number(e.target.value))}
                className="w-full h-10 px-3 bg-white border border-sky-200 rounded-lg text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {(calendarSystem === "BS" ? BS_MONTHS : AD_MONTHS).map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-sky-700/80 mb-1.5 block">Starting year</label>
              <Input
                type="text"
                inputMode="numeric"
                value={String(startYear)}
                onChange={e => setStartYear(Number(e.target.value) || 0)}
                className="font-mono text-right h-10"
                placeholder={calendarSystem === "BS" ? "2082" : "2025"}
              />
            </div>
          </div>

          <p className="text-[11px] text-sky-800/90 px-1">
            <strong>Preview:</strong>{" "}
            {(() => {
              const arr = calendarSystem === "BS" ? BS_MONTHS : AD_MONTHS
              const labels: string[] = []
              for (let i = 0; i < 12; i++) {
                const off = startMonth - 1 + i
                const m = (off % 12)
                const y = startYear + Math.floor(off / 12)
                labels.push(`${arr[m]} ${y}`)
              }
              return `${labels[0]} → ${labels[11]}`
            })()}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold tracking-tight">Fee Items</h2>
          <button onClick={addItem} className="text-[11px] font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer">
            <Plus className="w-3 h-3" />Add item
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="grid grid-cols-[1.6fr_0.8fr_2fr_0.7fr_36px] gap-2 px-4 py-2 bg-slate-50/80 text-[10px] uppercase tracking-widest font-black text-slate-500">
            <div>Fee Head</div>
            <div className="text-right">Amount</div>
            <div>Periods (comma-sep monthIndex, 0=annual)</div>
            <div className="text-right">Due day</div>
            <div></div>
          </div>
          {items.map((it, idx) => {
            const h = heads.find(x => x.id === it.feeHeadId)
            const isMonthly = h?.frequency === "MONTHLY"
            return (
              <div key={it.key} className="grid grid-cols-[1.6fr_0.8fr_2fr_0.7fr_36px] gap-2 px-4 py-2 items-start">
                <div className="space-y-1">
                  <select
                    value={it.feeHeadId}
                    onChange={e => changeItemHead(it.key, e.target.value)}
                    className="w-full h-10 px-3 bg-white/75 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  >
                    <option value="">— pick head —</option>
                    {heads.map(h => <option key={h.id} value={h.id}>{h.name} · {h.frequency}</option>)}
                  </select>
                  <Input value={it.notes} onChange={e => patchItem(it.key, { notes: e.target.value })} placeholder="Note (optional)" className="h-8 text-xs" />
                </div>
                <Input
                  type="text" inputMode="decimal"
                  value={it.amount}
                  onChange={e => patchItem(it.key, { amount: e.target.value })}
                  placeholder="0.00"
                  className="font-mono text-right h-10"
                />
                <div>
                  <Input
                    value={it.periods}
                    onChange={e => patchItem(it.key, { periods: e.target.value })}
                    placeholder={isMonthly ? "1,2,3,4,5,6,7,8,9,10,11,12" : "0"}
                    className="font-mono text-xs h-10"
                  />
                  {isMonthly && (
                    <p className="text-[10px] text-slate-400 mt-0.5 px-1">1=Shrawan · 12=Asar · use &quot;1,3,5&quot; for selective months</p>
                  )}
                </div>
                <Input
                  type="text" inputMode="numeric"
                  value={String(it.dueDay)}
                  onChange={e => patchItem(it.key, { dueDay: Number(e.target.value) || 10 })}
                  className="font-mono text-right h-10"
                />
                <button
                  onClick={() => removeItem(it.key)}
                  disabled={items.length <= 1}
                  aria-label={`Remove item ${idx + 1}`}
                  className="h-10 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <Save className="w-3.5 h-3.5" />{plan ? "Save Plan" : "Create Plan"}
          </Button>
        </div>
        {plan && (
          <Button variant="outline" onClick={() => setApplyOpen(true)} className="cursor-pointer gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />Apply to Class…
          </Button>
        )}
      </div>

      {plan && applyOpen && (
        <ApplyToClassSheet
          planId={plan.id}
          classes={classes}
          onClose={() => setApplyOpen(false)}
          onSaved={() => { setApplyOpen(false); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}
    </div>
  )
}

function ApplyToClassSheet({
  planId, classes, onClose, onSaved, pending, start,
}: {
  planId: string
  classes: ClassOption[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "")
  const cls = classes.find(c => c.id === classId)
  function handle() {
    start(async () => {
      try {
        const res = await applyPlanToTarget({ planId, classId })
        toast.success(`${res.studentsTouched} students · ${res.rowsCreated} new rows · ${res.rowsSkipped} already existed`)
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }
  return (
    <Backdrop onClose={onClose}>
      <Sheet title="Apply Plan to Class" onClose={onClose}>
        <p className="text-xs text-slate-500">Generates one StudentFee row per (student × fee head × period). Existing rows are skipped (idempotent).</p>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.studentCount} student{c.studentCount === 1 ? "" : "s"}</option>)}
          </select>
        </div>
        <div className={cn("rounded-xl border p-3 text-xs flex items-start gap-2", cls && cls.studentCount > 0 ? "bg-sky-50 border-sky-200 text-sky-800" : "bg-amber-50 border-amber-200 text-amber-800")}>
          <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>{cls && cls.studentCount > 0 ? `${cls.studentCount} active student${cls.studentCount === 1 ? "" : "s"} will be targeted.` : "No students in this class — nothing to generate."}</div>
        </div>
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
          <Button onClick={handle} disabled={pending || !cls || cls.studentCount === 0} className="cursor-pointer shadow-md shadow-primary/20 gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />Apply
          </Button>
        </div>
      </Sheet>
    </Backdrop>
  )
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>{children}</div>
  )
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-white/40 my-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  )
}
