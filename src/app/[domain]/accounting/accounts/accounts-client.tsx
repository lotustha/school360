"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus, Loader2, Trash2, Edit2, X, Check, Search, RotateCcw, ExternalLink,
  Sparkles, BookOpen, Database, Wallet, Banknote, Building, TrendingUp, TrendingDown,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  createAccount, updateAccount, deactivateAccount, reactivateAccount, seedDefaultCOA,
} from "@/actions/accounting/accounts"
import { AccountPicker } from "@/components/accounting/account-picker"
import { ReportKpi } from "@/components/accounting/report-shell"

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

const TYPE_TONE: Record<string, string> = {
  ASSET:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  LIABILITY: "bg-rose-50    text-rose-700    border-rose-200",
  EQUITY:    "bg-violet-50  text-violet-700  border-violet-200",
  INCOME:    "bg-sky-50     text-sky-700     border-sky-200",
  EXPENSE:   "bg-amber-50   text-amber-700   border-amber-200",
}

const TYPE_ICON: Record<string, React.ElementType> = {
  ASSET: Wallet, LIABILITY: Banknote, EQUITY: Building, INCOME: TrendingUp, EXPENSE: TrendingDown,
}

const SUBTYPE_SUGGESTIONS: Record<string, string[]> = {
  ASSET:     ["CASH", "BANK", "RECEIVABLE", "FIXED_ASSET", "CURRENT_ASSET"],
  LIABILITY: ["PAYABLE", "TAX_PAYABLE", "CURRENT_LIABILITY", "LONG_TERM_LIABILITY"],
  EQUITY:    ["CAPITAL_FUND", "RESERVE"],
  INCOME:    ["FEE_INCOME", "OTHER_INCOME"],
  EXPENSE:   ["OPERATING_EXPENSE", "ADMIN_EXPENSE", "FINANCE_COST"],
}

export function AccountsClient({ accounts }: { accounts: Acc[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | typeof TYPES[number]>("ALL")
  const [showInactive, setShowInactive] = useState(false)
  const [groupByType, setGroupByType] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const counts = useMemo(() => {
    const active = accounts.filter(a => a.isActive)
    return {
      total:     accounts.length,
      active:    active.length,
      inactive:  accounts.length - active.length,
      ASSET:     active.filter(a => a.type === "ASSET").length,
      LIABILITY: active.filter(a => a.type === "LIABILITY").length,
      EQUITY:    active.filter(a => a.type === "EQUITY").length,
      INCOME:    active.filter(a => a.type === "INCOME").length,
      EXPENSE:   active.filter(a => a.type === "EXPENSE").length,
    }
  }, [accounts])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return accounts.filter(a => {
      if (!showInactive && !a.isActive) return false
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false
      if (!q) return true
      return a.code.toLowerCase().includes(q)
        || a.name.toLowerCase().includes(q)
        || a.type.toLowerCase().includes(q)
        || (a.subType?.toLowerCase().includes(q) ?? false)
    })
  }, [accounts, filter, typeFilter, showInactive])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
            <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
              {counts.total} total · {counts.active} active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-slate-400" />
            The master list of every account every voucher can post to.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" disabled={pending}
            className="cursor-pointer text-xs gap-1.5"
            onClick={() => start(async () => {
              try {
                const res = await seedDefaultCOA()
                toast.success(`Seeded ${res.inserted} new accounts (${res.total} total)`)
                router.refresh()
              } catch (e) { toast.error((e as Error).message) }
            })}
          >
            <Database className="w-3.5 h-3.5" /> Re-seed defaults
          </Button>
          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="cursor-pointer gap-1.5 shadow-sm shadow-primary/20">
                <Plus className="w-3.5 h-3.5" /> Add Account
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>New Account</SheetTitle>
              </SheetHeader>
              <NewAccountForm
                parents={accounts.filter(a => a.isActive)}
                onCancel={() => setAddOpen(false)}
                onSaved={() => { setAddOpen(false); router.refresh() }}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Hero KPIs by type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {TYPES.map(t => {
          const Icon = TYPE_ICON[t]
          const tone = t === "ASSET" ? "emerald" : t === "LIABILITY" ? "rose" : t === "EQUITY" ? "violet" : t === "INCOME" ? "sky" : "amber"
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}
              className={cn(
                "text-left transition-all cursor-pointer rounded-2xl",
                typeFilter === t && "ring-2 ring-primary/40 ring-offset-1",
              )}
            >
              <ReportKpi
                label={t}
                value={String(counts[t])}
                subtitle={`${counts[t] === 1 ? "account" : "accounts"} · ${t === typeFilter ? "filtering" : "click to filter"}`}
                icon={Icon}
                tone={tone as "emerald" | "rose" | "violet" | "sky" | "amber"}
              />
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-slate-100/60 rounded-lg p-0.5">
          {(["ALL", ...TYPES] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition",
                typeFilter === t ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t === "ALL" ? "ALL" : t.slice(0, 4)}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search code / name / sub-type…"
            className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <label className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={groupByType} onChange={e => setGroupByType(e.target.checked)} className="cursor-pointer" />
          Group by type
        </label>

        <label className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="cursor-pointer" />
          Show inactive
          {counts.inactive > 0 && (
            <span className="text-[10px] font-mono text-slate-400">({counts.inactive})</span>
          )}
        </label>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length < accounts.length
            ? `${filtered.length} of ${accounts.length}`
            : `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">No accounts match the current filter.</p>
            {(filter || typeFilter !== "ALL") && (
              <button
                onClick={() => { setFilter(""); setTypeFilter("ALL") }}
                className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer"
              >
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left w-24">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left w-28">Type</th>
                <th className="px-4 py-3 text-left w-36">Sub-type</th>
                <th className="px-4 py-3 text-left w-24">Flags</th>
                <th className="px-4 py-3 text-right w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {groupByType
                ? TypeGroupedRows({ rows: filtered, editingId: editing, setEditing })
                : filtered.map(a => (
                    <AccountRow
                      key={a.id}
                      acc={a}
                      editing={editing === a.id}
                      onEdit={() => setEditing(a.id)}
                      onCancel={() => setEditing(null)}
                      onSaved={() => { setEditing(null); router.refresh() }}
                    />
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-slate-500 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] font-bold bg-violet-50 text-violet-700 border-violet-200">CTRL</Badge>
          <span>= control account (drives a subsidiary ledger)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] font-bold bg-slate-100 text-slate-600 border-slate-300">SYS</Badge>
          <span>= seeded by default chart, cannot be deleted</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Inactive accounts can be reactivated</span>
        </span>
      </div>
    </div>
  )
}

// ─── Grouping renderer ─────────────────────────────────────────────────────

function TypeGroupedRows({
  rows, editingId, setEditing,
}: {
  rows: Acc[]
  editingId: string | null
  setEditing: (id: string | null) => void
}) {
  const router = useRouter()
  const grouped = TYPES
    .map(t => ({ type: t, items: rows.filter(r => r.type === t) }))
    .filter(g => g.items.length > 0)

  return grouped.flatMap(g => {
    const Icon = TYPE_ICON[g.type]
    return [
      <tr key={`hdr-${g.type}`} className="bg-slate-50/60 border-y border-slate-200">
        <td colSpan={6} className="px-4 py-1.5">
          <div className="inline-flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", TYPE_TONE[g.type])}>
              {g.type}
            </span>
            <span className="text-[10px] font-mono text-slate-400">{g.items.length} {g.items.length === 1 ? "account" : "accounts"}</span>
          </div>
        </td>
      </tr>,
      ...g.items.map(a => (
        <AccountRow
          key={a.id}
          acc={a}
          editing={editingId === a.id}
          onEdit={() => setEditing(a.id)}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )),
    ]
  })
}

// ─── New Account form (in sheet) ───────────────────────────────────────────

function NewAccountForm({ parents, onCancel, onSaved }: { parents: Acc[]; onCancel: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<typeof TYPES[number]>("ASSET")
  const [subType, setSubType] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [isControl, setIsControl] = useState(false)
  const [notes, setNotes] = useState("")

  const subTypeSuggestions = SUBTYPE_SUGGESTIONS[type] ?? []
  const Icon = TYPE_ICON[type]

  function reset() {
    setCode(""); setName(""); setType("ASSET"); setSubType(""); setParentId(""); setIsControl(false); setNotes("")
  }

  return (
    <div className="space-y-4 p-4">
      {/* Type selector — large, visual */}
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Account type *</label>
        <div className="grid grid-cols-5 gap-1">
          {TYPES.map(t => {
            const TIcon = TYPE_ICON[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setSubType("") }}
                className={cn(
                  "px-1 py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer border flex flex-col items-center gap-1",
                  type === t
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white/75 border-slate-200 text-slate-700 hover:border-primary/40",
                )}
              >
                <TIcon className="w-3.5 h-3.5" />
                {t.slice(0, 4)}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 inline-flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {type === "ASSET" && "What the school owns (cash, bank, receivables, fixed assets)"}
          {type === "LIABILITY" && "What the school owes (payables, taxes, loans)"}
          {type === "EQUITY" && "Capital fund and reserves"}
          {type === "INCOME" && "Fee income, donations, other revenue"}
          {type === "EXPENSE" && "Salaries, utilities, supplies, operating costs"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Code *</label>
          <Input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="e.g. 1185"
            className="font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Sub-type</label>
          <Input
            value={subType} onChange={e => setSubType(e.target.value.toUpperCase())}
            placeholder="Optional"
            list="subtype-suggestions"
            className="font-mono"
          />
          <datalist id="subtype-suggestions">
            {subTypeSuggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name *</label>
        <Input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Student Fee Receivable"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Parent account (optional)</label>
        <AccountPicker
          value={parentId}
          onChange={setParentId}
          accounts={parents.filter(p => p.type === type)}
          placeholder="— No parent —"
        />
        <p className="text-[10px] text-slate-500 mt-1">Use to group accounts hierarchically (e.g. all current assets under one parent).</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notes (optional)</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal description" />
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer p-3 bg-violet-50/40 border border-violet-200 rounded-lg">
        <input type="checkbox" checked={isControl} onChange={e => setIsControl(e.target.checked)} className="mt-0.5 cursor-pointer" />
        <span>
          <strong className="text-violet-700">Control account</strong> — this account heads a subsidiary ledger (e.g. parent "Sundry Creditors" with vendor sub-accounts). Posting will be done via party (Student/Vendor/Employee), not directly.
        </span>
      </label>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button
          variant="outline" size="sm" onClick={() => { reset(); onCancel() }}
          disabled={pending} className="cursor-pointer"
        >Cancel</Button>
        <Button
          size="sm" disabled={pending || !code || !name}
          className="cursor-pointer gap-1.5"
          onClick={() => start(async () => {
            try {
              await createAccount({
                code, name, type,
                subType: subType.trim() || null,
                parentId: parentId || null,
                isControl,
                notes: notes.trim() || null,
              })
              toast.success(`Created ${code} · ${name}`)
              reset()
              onSaved()
            } catch (e) { toast.error((e as Error).message) }
          })}
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Create account
        </Button>
      </div>
    </div>
  )
}

// ─── Account row ─────────────────────────────────────────────────────────────

function AccountRow({ acc, editing, onEdit, onCancel, onSaved }: {
  acc: Acc; editing: boolean; onEdit: () => void; onCancel: () => void; onSaved: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState(acc.name)
  const [code, setCode] = useState(acc.code)

  return (
    <tr className={cn(
      "hover:bg-primary/4 transition-colors group",
      !acc.isActive && "opacity-60 bg-slate-50/40",
    )}>
      <td className="px-4 py-2 font-mono text-xs text-slate-600">
        {editing ? <Input value={code} onChange={e => setCode(e.target.value)} className="h-7 font-mono text-xs" /> : acc.code}
      </td>
      <td className="px-4 py-2">
        {editing ? (
          <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm" />
        ) : (
          <Link
            href={`/accounting/ledger?account=${acc.id}`}
            className="hover:text-primary hover:underline inline-flex items-center gap-1.5"
          >
            {acc.name}
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </Link>
        )}
      </td>
      <td className="px-4 py-2 text-xs">
        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", TYPE_TONE[acc.type] ?? "")}>
          {acc.type.slice(0, 3)}
        </Badge>
      </td>
      <td className="px-4 py-2 text-xs text-slate-500 font-mono">{acc.subType ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-2">
        <div className="inline-flex gap-1">
          {acc.isControl && <Badge variant="outline" className="text-[9px] font-bold bg-violet-50 text-violet-700 border-violet-200">CTRL</Badge>}
          {acc.isSystem  && <Badge variant="outline" className="text-[9px] font-bold bg-slate-100 text-slate-600 border-slate-300">SYS</Badge>}
          {!acc.isActive && <Badge variant="outline" className="text-[9px] font-bold bg-rose-50 text-rose-700 border-rose-200">OFF</Badge>}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="inline-flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending} className="cursor-pointer text-xs h-7" aria-label="Cancel edit">
              <X className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" disabled={pending} className="cursor-pointer text-xs gap-1 h-7" onClick={() => start(async () => {
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
            {!acc.isActive ? (
              <Button
                size="sm" variant="ghost" disabled={pending}
                className="cursor-pointer text-xs text-emerald-600 gap-1 h-7"
                onClick={() => start(async () => {
                  try {
                    await reactivateAccount(acc.id)
                    toast.success("Reactivated")
                    router.refresh()
                  } catch (e) { toast.error((e as Error).message) }
                })}
              >
                <RotateCcw className="w-3 h-3" /> Reactivate
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={onEdit} className="cursor-pointer text-xs gap-1 h-7">
                  <Edit2 className="w-3 h-3" /> Edit
                </Button>
                {!acc.isSystem && (
                  <Button
                    size="sm" variant="ghost" disabled={pending}
                    className="cursor-pointer text-xs text-rose-600 gap-1 h-7"
                    aria-label="Deactivate"
                    onClick={() => start(async () => {
                      if (!confirm(`Disable account ${acc.code}?\n\n${acc.name}`)) return
                      try {
                        await deactivateAccount(acc.id)
                        toast.success("Disabled")
                        router.refresh()
                      } catch (e) { toast.error((e as Error).message) }
                    })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
