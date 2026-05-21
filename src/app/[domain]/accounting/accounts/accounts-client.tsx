"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Trash2, Edit2, X, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  createAccount, updateAccount, deactivateAccount, seedDefaultCOA,
} from "@/actions/accounting/accounts"
import { AccountPicker } from "@/components/accounting/account-picker"

interface Acc {
  id:        string
  code:      string
  name:      string
  type:      string
  subType:   string | null
  parentId:  string | null
  isControl: boolean
  isSystem:  boolean
  isActive:  boolean
}

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const

export function AccountsClient({ accounts }: { accounts: Acc[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    if (!q) return accounts
    return accounts.filter(a => a.code.includes(q) || a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
  }, [accounts, filter])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pending} className="cursor-pointer text-xs gap-1.5" onClick={() => start(async () => {
            const res = await seedDefaultCOA()
            toast.success(`Seeded ${res.inserted} new accounts (${res.total} total)`)
            router.refresh()
          })}>
            Re-seed defaults
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} className="cursor-pointer gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Account
          </Button>
        </div>
      </div>

      <Input placeholder="Filter by code, name, or type…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-md" />

      {adding && (
        <NewAccountRow
          parents={accounts}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); router.refresh() }}
        />
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-4 py-3 text-left w-24">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left w-28">Type</th>
              <th className="px-4 py-3 text-left w-32">Sub-type</th>
              <th className="px-4 py-3 text-left w-20">Flags</th>
              <th className="px-4 py-3 text-right w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {filtered.map(a => (
              <AccountRow
                key={a.id}
                acc={a}
                editing={editing === a.id}
                onEdit={() => setEditing(a.id)}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); router.refresh() }}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No accounts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NewAccountRow({ parents, onCancel, onSaved }: { parents: Acc[]; onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<typeof TYPES[number]>("ASSET")
  const [parentId, setParentId] = useState<string>("")

  return (
    <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-amber-800">New account</p>
      <div className="grid sm:grid-cols-4 gap-2">
        <Input placeholder="Code (e.g. 1185)" value={code} onChange={e => setCode(e.target.value)} className="font-mono" />
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="sm:col-span-2" />
        <select value={type} onChange={e => setType(e.target.value as never)} className="h-9 px-2 border border-slate-200 rounded-md text-sm bg-white">
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <AccountPicker
          value={parentId}
          onChange={setParentId}
          accounts={parents.filter(p => p.type === type)}
          placeholder="— No parent —"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="cursor-pointer">Cancel</Button>
          <Button size="sm" disabled={pending || !code || !name} className="cursor-pointer gap-1.5" onClick={() => start(async () => {
            try {
              await createAccount({ code, name, type, parentId: parentId || null })
              toast.success(`Created ${code} · ${name}`)
              onSaved()
            } catch (e) { toast.error((e as Error).message) }
          })}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create
          </Button>
        </div>
      </div>
    </div>
  )
}

function AccountRow({ acc, editing, onEdit, onCancel, onSaved }: {
  acc: Acc; editing: boolean; onEdit: () => void; onCancel: () => void; onSaved: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(acc.name)
  const [code, setCode] = useState(acc.code)

  return (
    <tr className={cn("hover:bg-primary/4 transition-colors", !acc.isActive && "opacity-50")}>
      <td className="px-4 py-2 font-mono text-xs">
        {editing ? <Input value={code} onChange={e => setCode(e.target.value)} className="h-7 font-mono" /> : acc.code}
      </td>
      <td className="px-4 py-2">
        {editing ? <Input value={name} onChange={e => setName(e.target.value)} className="h-7" /> : acc.name}
      </td>
      <td className="px-4 py-2 text-xs"><Badge variant="outline" className="font-bold">{acc.type}</Badge></td>
      <td className="px-4 py-2 text-xs text-muted-foreground">{acc.subType ?? "—"}</td>
      <td className="px-4 py-2">
        {acc.isControl && <Badge variant="outline" className="text-[9px] font-bold bg-violet-50 text-violet-700 border-violet-200 mr-1">CTRL</Badge>}
        {acc.isSystem  && <Badge variant="outline" className="text-[9px] font-bold bg-slate-100 text-slate-600 border-slate-300">SYS</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1" onClick={() => start(async () => {
              try {
                await updateAccount(acc.id, { code, name })
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
            {acc.isActive && !acc.isSystem && (
              <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs text-rose-600 gap-1" onClick={() => start(async () => {
                if (!confirm(`Disable account ${acc.code}?`)) return
                await deactivateAccount(acc.id)
                toast.success("Disabled")
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
