"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus, Loader2, Edit2, Check, X, Trash2, Power, Search, Truck, ShieldCheck,
  Phone, Mail, MapPin, ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  createVendor, updateVendor, deactivateVendor, reactivateVendor,
  type VendorRow,
} from "@/actions/accounting/vendors"
import { ReportKpi } from "@/components/accounting/report-shell"

export function VendorsClient({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE")
  const [addOpen, setAddOpen] = useState(false)

  const stats = useMemo(() => ({
    total: vendors.length,
    active: vendors.filter(v => v.isActive).length,
    inactive: vendors.filter(v => !v.isActive).length,
    withPan: vendors.filter(v => v.isActive && v.panNumber).length,
  }), [vendors])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return vendors.filter(v => {
      if (statusFilter === "ACTIVE"   && !v.isActive) return false
      if (statusFilter === "INACTIVE" &&  v.isActive) return false
      if (!q) return true
      return v.name.toLowerCase().includes(q)
        || (v.panNumber ?? "").toLowerCase().includes(q)
        || (v.phone ?? "").toLowerCase().includes(q)
        || (v.email ?? "").toLowerCase().includes(q)
        || v.payableAccountCode.toLowerCase().includes(q)
    })
  }, [vendors, filter, statusFilter])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
            <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
              {stats.total} total · {stats.active} active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Truck className="w-3 h-3 text-slate-400" />
            Every vendor gets a dedicated Sundry Creditors sub-account auto-created.
          </p>
        </div>
        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="cursor-pointer gap-1.5 shadow-sm shadow-primary/20">
              <Plus className="w-3.5 h-3.5" /> Add Vendor
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Vendor</SheetTitle>
            </SheetHeader>
            <NewVendorForm
              onCancel={() => setAddOpen(false)}
              onSaved={() => { setAddOpen(false); router.refresh() }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total Vendors"    value={String(stats.total)}    subtitle="All-time master list"          icon={Truck}       tone="primary" />
        <ReportKpi label="Active"           value={String(stats.active)}   subtitle={`${stats.active} ready to use`} icon={ShieldCheck} tone="emerald" />
        <ReportKpi label="With PAN"         value={String(stats.withPan)}  subtitle="Tax-compliance ready"           icon={Check}       tone="sky" />
        <ReportKpi label="Inactive"         value={String(stats.inactive)} subtitle="Disabled / archived"            icon={X}           tone={stats.inactive > 0 ? "amber" : "slate"} />
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
            placeholder="Search name / PAN / phone / email / code…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length < vendors.length ? `${filtered.length} of ${vendors.length}` : `${vendors.length} vendors`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-1">
              {vendors.length === 0 ? "No vendors yet." : "No vendors match the filter."}
            </p>
            {vendors.length === 0 && (
              <p className="text-xs text-slate-400">Add your first vendor with the button above. A payable sub-account will be created automatically.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left w-32">PAN</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left w-28">GL Account</th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-right w-32"></th>
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

function NewVendorForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [name, setName] = useState("")
  const [pan, setPan] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")

  return (
    <div className="space-y-4 p-4">
      <div className="bg-violet-50/60 border border-violet-200 rounded-lg p-3 text-xs text-violet-800">
        <strong>Auto-created:</strong> a dedicated payable sub-account under Sundry Creditors, scoped to this vendor.
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Stationery Pvt. Ltd." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PAN (9 digits)</label>
          <Input
            value={pan}
            onChange={e => setPan(e.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="123456789"
            className="font-mono"
          />
          <p className="text-[10px] text-slate-500 mt-1">Required for tax compliance with vendors over Rs. 50,000/year.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Phone</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Address</label>
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Optional" />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notes</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal description, contract terms, etc." />
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} className="cursor-pointer">Cancel</Button>
        <Button
          size="sm" disabled={pending || !name.trim()}
          className="cursor-pointer gap-1.5"
          onClick={() => start(async () => {
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
          })}
        >
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
    <tr className={cn(
      "hover:bg-primary/4 transition-colors",
      !v.isActive && "opacity-60 bg-slate-50/40",
    )}>
      <td className="px-4 py-2">
        {editing
          ? <Input value={name} onChange={e => setName(e.target.value)} className="h-8" />
          : (
            <div>
              <p className="font-semibold">{v.name}</p>
              {v.address && (
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {v.address}
                </p>
              )}
            </div>
          )}
      </td>
      <td className="px-4 py-2 font-mono text-xs">
        {editing
          ? <Input value={pan} onChange={e => setPan(e.target.value.replace(/\D/g, "").slice(0, 9))} className="h-8 font-mono" />
          : v.panNumber
            ? <Badge variant="outline" className="text-[10px] font-mono">{v.panNumber}</Badge>
            : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-2 text-xs space-y-0.5">
        {editing ? (
          <div className="space-y-1">
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="h-8 text-xs" />
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="h-8 text-xs" />
          </div>
        ) : (
          <>
            {v.phone && (
              <a href={`tel:${v.phone}`} className="text-slate-600 inline-flex items-center gap-1 hover:text-primary">
                <Phone className="w-3 h-3" /> {v.phone}
              </a>
            )}
            {v.email && (
              <a href={`mailto:${v.email}`} className="text-slate-600 inline-flex items-center gap-1 hover:text-primary block">
                <Mail className="w-3 h-3" /> <span className="truncate">{v.email}</span>
              </a>
            )}
            {!v.phone && !v.email && <span className="text-slate-300">—</span>}
          </>
        )}
      </td>
      <td className="px-4 py-2">
        <Link
          href={`/accounting/ledger?account=${v.payableAccountId}`}
          className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          {v.payableAccountCode}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
      </td>
      <td className="px-4 py-2 text-center">
        {v.isActive
          ? <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">ACTIVE</Badge>
          : <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300">OFF</Badge>}
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs h-7" aria-label="Cancel"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1 h-7" onClick={() => start(async () => {
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
            {v.isActive ? (
              <>
                <Button size="sm" variant="ghost" onClick={onEdit} className="cursor-pointer text-xs gap-1 h-7">
                  <Edit2 className="w-3 h-3" /> Edit
                </Button>
                <Button
                  size="sm" variant="ghost" disabled={pending} aria-label="Deactivate"
                  className="cursor-pointer text-xs text-rose-600 gap-1 h-7"
                  onClick={() => start(async () => {
                    if (!confirm(`Deactivate vendor "${v.name}"?`)) return
                    try {
                      await deactivateVendor(v.id)
                      toast.success("Deactivated")
                      router.refresh()
                    } catch (e) { toast.error((e as Error).message) }
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
                    await reactivateVendor(v.id)
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
