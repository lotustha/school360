"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Edit2, Check, X, Trash2, Power } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  createVendor, updateVendor, deactivateVendor, reactivateVendor,
  type VendorRow,
} from "@/actions/accounting/vendors"

export function VendorsClient({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  const filtered = vendors.filter(v => {
    if (!showInactive && !v.isActive) return false
    if (!filter) return true
    const q = filter.toLowerCase()
    return v.name.toLowerCase().includes(q) ||
           (v.panNumber ?? "").includes(q) ||
           (v.phone ?? "").includes(q) ||
           v.payableAccountCode.includes(q)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
        <Button size="sm" onClick={() => setAdding(true)} className="cursor-pointer gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Vendor
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by name, PAN, phone, or account code…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-md"
        />
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {adding && (
        <NewVendorRow
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); router.refresh() }}
        />
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {vendors.length === 0 ? "No vendors yet. Add your first one above." : "No vendors match the filter."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left w-32">PAN</th>
                <th className="px-4 py-3 text-left w-40">Phone</th>
                <th className="px-4 py-3 text-left w-28">Account</th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-right w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {filtered.map(v => (
                <VendorRowView
                  key={v.id}
                  v={v}
                  editing={editing === v.id}
                  onEdit={() => setEditing(v.id)}
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

function NewVendorRow({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [name, setName] = useState("")
  const [pan, setPan] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")

  return (
    <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-amber-800">New Vendor — a dedicated payable account is auto-created under Sundry Creditors.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Stationery Pvt. Ltd." />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PAN (9 digits)</label>
          <Input
            value={pan}
            onChange={e => setPan(e.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="123456789"
            className="font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phone</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Address</label>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="cursor-pointer">Cancel</Button>
        <Button size="sm" disabled={pending || !name.trim()} className="cursor-pointer gap-1.5" onClick={() => start(async () => {
          try {
            await createVendor({
              name: name.trim(),
              panNumber: pan || null,
              phone: phone || null,
              email: email || null,
              address: address || null,
            })
            toast.success(`Created vendor "${name}"`)
            onSaved()
          } catch (e) { toast.error((e as Error).message) }
        })}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Create Vendor
        </Button>
      </div>
    </div>
  )
}

function VendorRowView({
  v, editing, onEdit, onCancel, onSaved,
}: {
  v: VendorRow; editing: boolean; onEdit: () => void; onCancel: () => void; onSaved: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(v.name)
  const [pan, setPan] = useState(v.panNumber ?? "")
  const [phone, setPhone] = useState(v.phone ?? "")
  const [email, setEmail] = useState(v.email ?? "")

  return (
    <tr className={cn("hover:bg-primary/4 transition-colors", !v.isActive && "opacity-50")}>
      <td className="px-4 py-2">
        {editing ? <Input value={name} onChange={e => setName(e.target.value)} className="h-8" /> : <strong>{v.name}</strong>}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        {editing ? <Input value={pan} onChange={e => setPan(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-8 font-mono" /> : (v.panNumber ?? "—")}
      </td>
      <td className="px-4 py-2 text-xs">
        {editing ? <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8" /> : (v.phone ?? "—")}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-slate-500">{v.payableAccountCode}</td>
      <td className="px-4 py-2 text-center">
        {v.isActive
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
          : <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300">Inactive</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            {/* Hidden email input still in scope */}
            <input type="hidden" value={email} onChange={e => setEmail(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1" onClick={() => start(async () => {
              try {
                await updateVendor(v.id, { name, panNumber: pan || null, phone: phone || null, email: email || null })
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
            {v.isActive ? (
              <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs text-rose-600 gap-1" onClick={() => start(async () => {
                if (!confirm(`Deactivate vendor "${v.name}"?`)) return
                await deactivateVendor(v.id)
                toast.success("Deactivated")
                router.refresh()
              })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs text-emerald-600 gap-1" onClick={() => start(async () => {
                await reactivateVendor(v.id)
                toast.success("Reactivated")
                router.refresh()
              })}>
                <Power className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
