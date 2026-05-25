"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus, Loader2, Edit2, Check, X, Trash2, BookOpen, Landmark, Search, ShieldCheck,
  Scale, Power, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  createBankAccount, updateBankAccount, deactivateBankAccount, reactivateBankAccount,
  type BankAccountRow,
} from "@/actions/accounting/bank-accounts"
import { ReportKpi } from "@/components/accounting/report-shell"

export function BankAccountsClient({ banks, suggestedCode }: { banks: BankAccountRow[]; suggestedCode: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE")

  const stats = useMemo(() => ({
    total: banks.length,
    active: banks.filter(b => b.isActive).length,
    inactive: banks.filter(b => !b.isActive).length,
    branches: new Set(banks.filter(b => b.branch).map(b => b.branch)).size,
  }), [banks])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return banks.filter(b => {
      if (statusFilter === "ACTIVE"   && !b.isActive) return false
      if (statusFilter === "INACTIVE" &&  b.isActive) return false
      if (!q) return true
      return b.bankName.toLowerCase().includes(q)
        || (b.accountNumber ?? "").toLowerCase().includes(q)
        || (b.branch ?? "").toLowerCase().includes(q)
        || b.glCode.toLowerCase().includes(q)
    })
  }, [banks, filter, statusFilter])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
            <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
              {stats.total} total · {stats.active} active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Landmark className="w-3 h-3 text-slate-400" />
            Each bank account gets a dedicated GL account under <span className="font-mono">1120 Bank Accounts</span>.
          </p>
        </div>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="cursor-pointer gap-1.5 shadow-sm shadow-primary/20">
              <Plus className="w-3.5 h-3.5" /> Add Bank Account
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Bank Account</SheetTitle>
            </SheetHeader>
            <NewBankForm
              suggestedCode={suggestedCode}
              onCancel={() => setAddOpen(false)}
              onSaved={() => { setAddOpen(false); router.refresh() }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total Accounts" value={String(stats.total)}    subtitle="All-time master list"            icon={Landmark}    tone="primary" />
        <ReportKpi label="Active"         value={String(stats.active)}   subtitle={`${stats.active} ready to use`}  icon={ShieldCheck} tone="emerald" />
        <ReportKpi label="Branches"       value={String(stats.branches)} subtitle="Distinct branch locations"      icon={Scale}       tone="sky" />
        <ReportKpi label="Inactive"       value={String(stats.inactive)} subtitle="Disabled / archived"            icon={X}           tone={stats.inactive > 0 ? "amber" : "slate"} />
      </div>

      {/* Toolbar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {([
            { k: "ACTIVE",   label: "Active",   count: stats.active },
            { k: "ALL",      label: "All",      count: stats.total },
            { k: "INACTIVE", label: "Inactive", count: stats.inactive },
          ] as const).map(o => (
            <button
              key={o.k}
              type="button"
              onClick={() => setStatusFilter(o.k)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition flex items-center gap-1.5",
                statusFilter === o.k ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {o.label}
              <span className="text-[10px] font-mono tabular-nums text-slate-400">{o.count}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search bank / account no / branch / code…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length < banks.length ? `${filtered.length} of ${banks.length}` : `${banks.length} accounts`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Landmark className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-1">
              {banks.length === 0 ? "No bank accounts yet." : "No accounts match the filter."}
            </p>
            {banks.length === 0 && (
              <p className="text-xs text-slate-400">Adding one creates a dedicated GL account under <span className="font-mono">1120 Bank Accounts</span>.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left">Bank</th>
                <th className="px-4 py-3 text-left w-44">Account No.</th>
                <th className="px-4 py-3 text-left w-32">Branch</th>
                <th className="px-4 py-3 text-left w-36">GL Code</th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-right w-44"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {filtered.map(b => (
                <BankRowView
                  key={b.id}
                  b={b}
                  editing={editing === b.id}
                  onEdit={() => setEditing(b.id)}
                  onCancel={() => setEditing(null)}
                  onSaved={() => { setEditing(null); router.refresh() }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function NewBankForm({ suggestedCode, onCancel, onSaved }: { suggestedCode: string; onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [bankName,      setBankName]      = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [branch,        setBranch]        = useState("")
  const [code,          setCode]          = useState(suggestedCode)
  const [label,         setLabel]         = useState("")

  return (
    <div className="space-y-4 p-4">
      <div className="bg-violet-50/60 border border-violet-200 rounded-lg p-3 text-xs text-violet-800">
        <strong>Auto-created:</strong> a dedicated GL account under <span className="font-mono">1120 Bank Accounts</span>.
        You'll see it in the Chart of Accounts and Bank Book.
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bank Name *</label>
        <Input
          value={bankName}
          onChange={e => { setBankName(e.target.value); if (!label) setLabel(`Bank — ${e.target.value}`) }}
          placeholder="e.g. NIC Asia Bank"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Account Number</label>
          <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="0123-4567-89" className="font-mono" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Branch</label>
          <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Kathmandu" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">GL Code *</label>
          <Input value={code} onChange={e => setCode(e.target.value)} className="font-mono" />
          <p className="text-[10px] text-slate-500 mt-1">Next available is <span className="font-mono">{suggestedCode}</span>.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">GL Account Name *</label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. NIC Asia Bank — Current A/c" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="cursor-pointer">Cancel</Button>
        <Button
          size="sm"
          disabled={pending || !bankName.trim() || !code.trim() || !label.trim()}
          className="cursor-pointer gap-1.5"
          onClick={() => start(async () => {
            try {
              await createBankAccount({
                bankName:      bankName.trim(),
                accountNumber: accountNumber.trim() || null,
                branch:        branch.trim() || null,
                code:          code.trim(),
                accountLabel:  label.trim(),
              })
              toast.success(`Added "${bankName}"`)
              onSaved()
            } catch (e) { toast.error((e as Error).message) }
          })}
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Create
        </Button>
      </div>
    </div>
  )
}

function BankRowView({
  b, editing, onEdit, onCancel, onSaved,
}: {
  b: BankAccountRow; editing: boolean; onEdit: () => void; onCancel: () => void; onSaved: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [bankName,      setBankName]      = useState(b.bankName)
  const [accountNumber, setAccountNumber] = useState(b.accountNumber ?? "")
  const [branch,        setBranch]        = useState(b.branch ?? "")

  return (
    <tr className={cn(
      "hover:bg-primary/4 transition-colors",
      !b.isActive && "opacity-60 bg-slate-50/40",
    )}>
      <td className="px-4 py-2">
        {editing
          ? <Input value={bankName} onChange={e => setBankName(e.target.value)} className="h-8" />
          : (
            <div className="inline-flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
                <Landmark className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <span className="font-semibold">{b.bankName}</span>
            </div>
          )}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        {editing
          ? <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="h-8 font-mono" />
          : (b.accountNumber ?? <span className="text-slate-300">—</span>)}
      </td>
      <td className="px-4 py-2 text-xs">
        {editing
          ? <Input value={branch} onChange={e => setBranch(e.target.value)} className="h-8" />
          : (b.branch ?? <span className="text-slate-300">—</span>)}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        <Link href={`/accounting/bank-book?account=${b.glAccountId}`} className="text-primary hover:underline inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> {b.glCode}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
      </td>
      <td className="px-4 py-2 text-center">
        {b.isActive
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">ACTIVE</Badge>
          : <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300">OFF</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs h-7" aria-label="Cancel"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1 h-7" onClick={() => start(async () => {
              try {
                await updateBankAccount(b.id, { bankName, accountNumber: accountNumber || null, branch: branch || null })
                toast.success("Updated")
                onSaved()
              } catch (e) { toast.error((e as Error).message) }
            })}>
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </Button>
          </div>
        ) : (
          <div className="inline-flex gap-1">
            {b.isActive ? (
              <>
                <Link href={`/accounting/bank-reconciliation?account=${b.glAccountId}`}>
                  <Button size="sm" variant="ghost" className="cursor-pointer text-xs gap-1 h-7" aria-label="Reconcile">
                    <Scale className="w-3 h-3" />
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={onEdit} className="cursor-pointer text-xs gap-1 h-7">
                  <Edit2 className="w-3 h-3" /> Edit
                </Button>
                <Button
                  size="sm" variant="ghost" disabled={pending} aria-label="Deactivate"
                  className="cursor-pointer text-xs text-rose-600 gap-1 h-7"
                  onClick={() => start(async () => {
                    if (!confirm(`Deactivate ${b.bankName}? The GL account will also be disabled.`)) return
                    await deactivateBankAccount(b.id)
                    toast.success("Deactivated")
                    router.refresh()
                  })}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <Button
                size="sm" variant="ghost" disabled={pending}
                className="cursor-pointer text-xs text-emerald-600 gap-1 h-7"
                onClick={() => start(async () => {
                  try {
                    await reactivateBankAccount(b.id)
                    toast.success("Reactivated")
                    router.refresh()
                  } catch (e) { toast.error((e as Error).message) }
                })}
              >
                <Power className="w-3 h-3" /> Reactivate
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
