"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Edit2, Check, X, Trash2, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  createBankAccount, updateBankAccount, deactivateBankAccount,
  type BankAccountRow,
} from "@/actions/accounting/bank-accounts"

export function BankAccountsClient({ banks, suggestedCode }: { banks: BankAccountRow[]; suggestedCode: string }) {
  const router = useRouter()
  const [adding, setAdding]   = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
        <Button size="sm" onClick={() => setAdding(true)} className="cursor-pointer gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Bank Account
        </Button>
      </div>

      {adding && (
        <NewBankRow
          suggestedCode={suggestedCode}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); router.refresh() }}
        />
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {banks.length === 0 && !adding ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No bank accounts yet. Adding one creates a dedicated GL account under <span className="font-mono">1120 Bank Accounts</span>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Bank</th>
                <th className="px-4 py-3 text-left w-40">Account No.</th>
                <th className="px-4 py-3 text-left w-32">Branch</th>
                <th className="px-4 py-3 text-left w-32">GL Code</th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-right w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {banks.map(b => (
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

function NewBankRow({ suggestedCode, onCancel, onSaved }: { suggestedCode: string; onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [bankName,      setBankName]      = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [branch,        setBranch]        = useState("")
  const [code,          setCode]          = useState(suggestedCode)
  const [label,         setLabel]         = useState("")

  return (
    <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-amber-800">New Bank Account — auto-creates a dedicated GL account under 1120 Bank Accounts.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Bank Name *</label>
          <Input value={bankName} onChange={e => { setBankName(e.target.value); if (!label) setLabel(`Bank — ${e.target.value}`) }} placeholder="e.g. NIC Asia Bank" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Account Number</label>
          <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="0123-4567-89" className="font-mono" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Branch</label>
          <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Kathmandu" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">GL Code *</label>
          <Input value={code} onChange={e => setCode(e.target.value)} className="font-mono" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">GL Account Name *</label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. NIC Asia Bank — Current A/c" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="cursor-pointer">Cancel</Button>
        <Button size="sm" disabled={pending || !bankName.trim() || !code.trim() || !label.trim()} className="cursor-pointer gap-1.5" onClick={() => start(async () => {
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
        })}>
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
    <tr className={cn("hover:bg-primary/4 transition-colors", !b.isActive && "opacity-50")}>
      <td className="px-4 py-2">
        {editing ? <Input value={bankName} onChange={e => setBankName(e.target.value)} className="h-8" /> : <strong>{b.bankName}</strong>}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        {editing ? <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="h-8 font-mono" /> : (b.accountNumber ?? "—")}
      </td>
      <td className="px-4 py-2 text-xs">
        {editing ? <Input value={branch} onChange={e => setBranch(e.target.value)} className="h-8" /> : (b.branch ?? "—")}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        <Link href={`/accounting/bank-book?account=${b.glAccountId}`} className="text-primary hover:underline inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> {b.glCode}
        </Link>
      </td>
      <td className="px-4 py-2 text-center">
        {b.isActive
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
          : <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300">Inactive</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1" onClick={() => start(async () => {
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
            <Button size="sm" variant="ghost" onClick={onEdit} className="cursor-pointer text-xs gap-1">
              <Edit2 className="w-3 h-3" /> Edit
            </Button>
            {b.isActive && (
              <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs text-rose-600 gap-1" onClick={() => start(async () => {
                if (!confirm(`Deactivate ${b.bankName}? The GL account will also be disabled.`)) return
                await deactivateBankAccount(b.id)
                toast.success("Deactivated")
                router.refresh()
              })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
