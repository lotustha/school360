"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Pencil, X, Search, Power, PowerOff, Tag, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AccountPicker } from "@/components/accounting/account-picker"
import { cn } from "@/lib/utils"
import {
  createFeeHead, updateFeeHead, toggleFeeHeadActive, type FeeHeadRow,
} from "@/actions/billing/fee-heads"

const FREQUENCIES = ["MONTHLY", "ANNUAL", "ONE_TIME", "EVENT"] as const

const FREQUENCY_HELP: Record<string, string> = {
  MONTHLY:  "Auto-expands into 12 monthly rows when added to a Plan (e.g. Baisakh/Jestha/Ashar… or Jan/Feb/Mar…). You don't create months manually.",
  ANNUAL:   "Billed once per fiscal year (e.g. Library Fee, Annual Sports Fee).",
  ONE_TIME: "Billed once per student (e.g. Admission Fee at enrollment, Uniform).",
  EVENT:    "Billed ad-hoc per event (e.g. Picnic, Tour, Farewell).",
}

interface AccountOption { id: string; code: string; name: string; type: "INCOME" }

interface Props {
  initialHeads:   FeeHeadRow[]
  incomeAccounts: AccountOption[]
}

export function HeadsClient({ initialHeads, incomeAccounts }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<FeeHeadRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState("")
  const [filterFreq, setFilterFreq] = useState<string>("")
  const [showInactive, setShowInactive] = useState(false)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return initialHeads.filter(h => {
      if (!showInactive && !h.isActive) return false
      if (filterFreq && h.frequency !== filterFreq) return false
      if (query && !h.name.toLowerCase().includes(query) && !h.feeAccountName.toLowerCase().includes(query)) return false
      return true
    })
  }, [initialHeads, q, filterFreq, showInactive])

  function handleToggle(id: string) {
    start(async () => {
      try {
        await toggleFeeHeadActive(id)
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search heads or accounts…" className="pl-9" />
        </div>
        <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
          <option value="">All frequencies</option>
          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button
          onClick={() => setShowInactive(v => !v)}
          className={cn(
            "h-10 px-3 rounded-xl border text-xs font-bold cursor-pointer transition",
            showInactive ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white/75 border-slate-200 text-slate-500",
          )}
        >
          {showInactive ? "Hide inactive" : "Show inactive"}
        </button>
        <Button onClick={() => setCreating(true)} className="gap-1.5 cursor-pointer shadow-sm">
          <Plus className="w-3.5 h-3.5" />New Head
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <Tag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">No fee heads match.</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing filters or click <strong>New Head</strong> to add one.</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500">Head</th>
                  <th className="text-left px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500">Income Account</th>
                  <th className="text-left px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500">Frequency</th>
                  <th className="text-center px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500" title="Lower = paid first when auto-allocating">Priority</th>
                  <th className="text-right px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500">Default</th>
                  <th className="text-right px-3 py-2.5 font-black uppercase tracking-widest text-[10px] text-slate-500">Used</th>
                  <th className="text-right px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(h => (
                  <tr key={h.id} className={cn("hover:bg-slate-50/60 transition-colors", !h.isActive && "opacity-50")}>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-800">{h.name}</div>
                      {h.notes && <div className="text-[10px] text-slate-400 truncate max-w-[260px]">{h.notes}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[10px] text-slate-500">{h.feeAccountCode}</span>
                      <span className="ml-1.5 text-slate-600">{h.feeAccountName}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded",
                        h.frequency === "MONTHLY"  && "bg-primary/8 text-primary",
                        h.frequency === "ANNUAL"   && "bg-sky-50 text-sky-700",
                        h.frequency === "ONE_TIME" && "bg-violet-50 text-violet-700",
                        h.frequency === "EVENT"    && "bg-amber-50 text-amber-700",
                      )}>{h.frequency}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[2rem] font-mono tabular-nums text-[10px] font-black px-1.5 py-0.5 rounded",
                        h.priority <= 10 ? "bg-rose-100 text-rose-700"
                        : h.priority <= 30 ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600",
                      )}
                      title={`Priority ${h.priority} — ${h.priority <= 10 ? "highest" : h.priority <= 30 ? "elevated" : "normal/low"}`}
                      >
                        P{h.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      <span className="text-slate-700 font-bold">{h.defaultAmount}</span>
                      {h.defaultDueDay && <span className="text-slate-400 text-[10px] ml-1">· d{h.defaultDueDay}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500">{h.usageCount}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setEditing(h)} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/8 cursor-pointer transition-colors" aria-label="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToggle(h.id)} disabled={pending} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors disabled:opacity-40" aria-label={h.isActive ? "Deactivate" : "Activate"}>
                          {h.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <HeadFormSheet
          head={editing}
          incomeAccounts={incomeAccounts}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => { setEditing(null); setCreating(false); router.refresh() }}
          pending={pending}
          start={start}
        />
      )}
    </div>
  )
}

function HeadFormSheet({
  head, incomeAccounts, onClose, onSaved, pending, start,
}: {
  head: FeeHeadRow | null
  incomeAccounts: AccountOption[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  start: (cb: () => void) => void
}) {
  const [name,          setName]          = useState(head?.name ?? "")
  const [feeAccountId,  setFeeAccountId]  = useState(head?.feeAccountId ?? "")
  const [frequency,     setFrequency]     = useState(head?.frequency ?? "MONTHLY")
  const [defaultAmount, setDefaultAmount] = useState(head?.defaultAmount ?? "")
  const [defaultDueDay, setDueDay]        = useState<string>(head?.defaultDueDay ? String(head.defaultDueDay) : "10")
  const [priority,      setPriority]      = useState<string>(String(head?.priority ?? 50))
  const [notes,         setNotes]         = useState(head?.notes ?? "")
  /** Track whether Name was user-edited; if not, auto-mirror the selected account's name. */
  const [nameTouched, setNameTouched] = useState<boolean>(!!head?.name)

  // Auto-fill the Name field from the picked Income Account, unless the user has manually typed.
  function handleAccountChange(id: string) {
    setFeeAccountId(id)
    if (!nameTouched) {
      const acc = incomeAccounts.find(a => a.id === id)
      if (acc) {
        // Strip a trailing " Income" suffix for cleaner display names
        const cleaned = acc.name.replace(/\s+income\s*$/i, "").trim()
        setName(cleaned || acc.name)
      }
    }
  }

  function handleSave() {
    if (!name.trim())           { toast.error("Name required");        return }
    if (!feeAccountId)          { toast.error("Income account required"); return }
    if (!defaultAmount.trim())  { toast.error("Default amount required"); return }
    start(async () => {
      try {
        const dueDayNum = defaultDueDay ? Number(defaultDueDay) : null
        const pri = Math.max(1, Math.min(99, Number(priority) || 50))
        if (head) {
          await updateFeeHead({
            id: head.id,
            name: name.trim(), feeAccountId,
            frequency: frequency as "MONTHLY" | "ANNUAL" | "ONE_TIME" | "EVENT",
            defaultAmount,
            defaultDueDay: dueDayNum,
            priority: pri,
            notes: notes.trim() || null,
          })
          toast.success("Updated")
        } else {
          await createFeeHead({
            name: name.trim(), feeAccountId,
            frequency: frequency as "MONTHLY" | "ANNUAL" | "ONE_TIME" | "EVENT",
            defaultAmount,
            defaultDueDay: dueDayNum,
            priority: pri,
            notes: notes.trim() || null,
          })
          toast.success("Created")
        }
        onSaved()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <Backdrop onClose={onClose}>
      <Sheet title={head ? "Edit Fee Head" : "New Fee Head"} onClose={onClose}>
        <Field label="Income account">
          <AccountPicker
            value={feeAccountId}
            onChange={handleAccountChange}
            accounts={incomeAccounts}
            placeholder="Search INCOME accounts…"
          />
          <p className="text-[11px] text-slate-400 mt-1">Where collected fees are credited in the General Ledger.</p>
        </Field>

        <Field label="Display name">
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setNameTouched(true) }}
            placeholder="Auto-filled from account — edit only if you need a different label"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Shown to parents on receipts and to admins in the billing grid.
            {!nameTouched && feeAccountId && <span className="text-emerald-600"> · Auto-filled from account.</span>}
          </p>
        </Field>

        <Field label="Frequency">
          <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15">
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="mt-2 rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-[11px] text-sky-800 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{FREQUENCY_HELP[frequency]}</span>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Default amount (Rs.)">
            <Input type="text" inputMode="decimal" value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} className="font-mono text-right" />
          </Field>
          <Field label="Default due day (1-32)">
            <Input type="text" inputMode="numeric" value={defaultDueDay} onChange={e => setDueDay(e.target.value)} className="font-mono text-right" />
          </Field>
        </div>

        <Field label="Settle priority (1 = highest, 50 = normal, 99 = lowest)">
          <Input type="text" inputMode="numeric" value={priority} onChange={e => setPriority(e.target.value)} className="font-mono text-right" placeholder="50" />
          <p className="text-[11px] text-slate-400 mt-1">
            When a payment is auto-split across outstanding fees, lower priority numbers are paid first. Set Exam Fee to <strong>1-10</strong> to force it ahead of Tuition (50).
          </p>
        </Field>

        <Field label="Notes">
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </Field>

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Cancel</Button>
          <Button onClick={handleSave} disabled={pending} className="cursor-pointer shadow-md shadow-primary/20">Save</Button>
        </div>
      </Sheet>
    </Backdrop>
  )
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>{children}</div>
}
