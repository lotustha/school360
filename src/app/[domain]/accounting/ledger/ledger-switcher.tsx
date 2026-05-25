"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AccountPicker } from "@/components/accounting/account-picker"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { Button } from "@/components/ui/button"

interface Acc { id: string; code: string; name: string; type: string; subType?: string | null }

interface Props {
  accounts:        Acc[]
  fiscalYears:     Array<{ id: string; name: string; isCurrent: boolean }>
  selectedAccount: string | null
  selectedFy:      string
  fromBS:          string
  toBS:            string
}

export function LedgerSwitcher({
  accounts, fiscalYears, selectedAccount, selectedFy, fromBS, toBS,
}: Props) {
  const router = useRouter()
  // Dates are pending until Apply — local state is required so typing works.
  const [from, setFrom] = useState(fromBS)
  const [to, setTo]     = useState(toBS)

  // Sync date inputs when URL changes (e.g. via Quick range chips)
  useEffect(() => { setFrom(fromBS) }, [fromBS])
  useEffect(() => { setTo(toBS)     }, [toBS])

  function navigate(overrides?: Partial<{ account: string; fy: string; from: string; to: string }>) {
    const next = {
      account: overrides?.account ?? selectedAccount ?? "",
      fy:      overrides?.fy      ?? selectedFy,
      from:    overrides?.from    ?? from,
      to:      overrides?.to      ?? to,
    }
    const qs = new URLSearchParams()
    if (next.account) qs.set("account", next.account)
    if (next.fy)      qs.set("fy",      next.fy)
    if (next.from)    qs.set("from",    next.from)
    if (next.to)      qs.set("to",      next.to)
    router.push(`/accounting/ledger?${qs.toString()}`)
  }

  return (
    // relative z-30 so the AccountPicker dropdown stacks above subsequent KPI / table
    // cards (each of which creates its own stacking context via backdrop-blur).
    <div className="relative z-30 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm p-4 grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end">
      <div>
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Account *</label>
        <AccountPicker
          key={selectedAccount ?? "empty"}
          value={selectedAccount ?? ""}
          onChange={id => navigate({ account: id })}
          accounts={accounts}
          placeholder="Search account by code, name, or type…"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">Fiscal year</label>
        <select
          value={selectedFy}
          onChange={e => navigate({ fy: e.target.value })}
          className="w-full h-11 px-3 bg-white/75 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        >
          {fiscalYears.map(f => (
            <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">From (BS)</label>
        <NepaliDateInput value={from} onChange={setFrom} />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">To (BS)</label>
        <NepaliDateInput value={to} onChange={setTo} />
      </div>
      <Button onClick={() => navigate()} disabled={!selectedAccount} className="h-11 cursor-pointer">Apply</Button>
    </div>
  )
}
