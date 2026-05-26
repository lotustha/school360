"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Layers, ArrowRight, Archive, Search, Calendar, Users as UsersIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { FeePlanRow } from "@/actions/billing/fee-plans"

const BS_MONTHS = ["Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"]
const AD_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function monthLabel(calendar: string, m: number) {
  const arr = calendar === "AD" ? AD_MONTHS : BS_MONTHS
  return arr[Math.max(0, Math.min(11, m - 1))] ?? `M${m}`
}

type StatusFilter = "active" | "all" | "archived"
type SortKey = "recent" | "name" | "items" | "generated"

export function PlansClient({
  plans, fiscalYears,
}: {
  plans:        FeePlanRow[]
  fiscalYears:  Array<{ id: string; name: string }>
}) {
  const [q, setQ]           = useState("")
  const [fy, setFy]         = useState("")
  const [status, setStatus] = useState<StatusFilter>("active")
  const [sort, setSort]     = useState<SortKey>("recent")

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = plans.filter(p => {
      if (status === "active"   && !p.isActive) return false
      if (status === "archived" &&  p.isActive) return false
      if (fy && p.fiscalYearId !== fy) return false
      if (query && !p.name.toLowerCase().includes(query) && !(p.description ?? "").toLowerCase().includes(query)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name":      return a.name.localeCompare(b.name)
        case "items":     return b.itemCount - a.itemCount
        case "generated": return b.generatedCount - a.generatedCount
        case "recent":
        default:          return b.createdAt.localeCompare(a.createdAt)
      }
    })
    return list
  }, [plans, q, fy, status, sort])

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search plans by name or description…" className="pl-9 h-10" />
        </div>

        <select
          value={fy}
          onChange={e => setFy(e.target.value)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
        >
          <option value="">All FYs</option>
          {fiscalYears.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
        </select>

        <div className="inline-flex p-0.5 bg-slate-100/60 rounded-lg border border-slate-200">
          {(["active", "all", "archived"] as StatusFilter[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "px-3 h-9 rounded-md text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors",
                status === s ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700",
              )}
            >{s}</button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
        >
          <option value="recent">Recently created</option>
          <option value="name">Name (A→Z)</option>
          <option value="items">Most items</option>
          <option value="generated">Most students billed</option>
        </select>

        <span className="ml-auto text-[10px] uppercase tracking-widest font-black text-slate-400 inline-flex items-center gap-1.5">
          {filtered.length} of {plans.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">{plans.length === 0 ? "No plans yet." : "No plans match the filters."}</p>
          <p className="text-xs text-slate-400 mt-1">
            {plans.length === 0
              ? "Create a plan per class per fiscal year, then apply to roll out fees to students."
              : "Try changing the FY or status filter."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link key={p.id} href={`/finance/plans/${p.id}`} className="block group">
              <div className={cn(
                "bg-white/70 backdrop-blur-xl rounded-2xl border p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/8 transition-all duration-200 cursor-pointer h-full flex flex-col",
                p.isActive ? "border-white/40" : "border-slate-200/40 opacity-70",
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-base font-bold truncate group-hover:text-primary transition-colors">{p.name}</p>
                    {p.description && <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{p.description}</p>}
                  </div>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", p.isActive ? "bg-primary/8" : "bg-slate-100")}>
                    {p.isActive ? <Layers className="w-5 h-5 text-primary" /> : <Archive className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Pill icon={Calendar} label={`FY ${p.fiscalYearName}`} tone="slate" />
                  <Pill label={p.calendarSystem} tone="primary" mono />
                  <Pill label={`Starts ${monthLabel(p.calendarSystem, p.startMonth)} ${p.startYear}`} tone="slate" />
                  {!p.isActive && <Pill label="Archived" tone="rose" />}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-slate-100">
                  <Stat label="Line items" value={`${p.itemCount}`} />
                  <Stat label="Students" value={`${p.generatedCount}`} icon={UsersIcon} />
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition mt-3 self-end" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Pill({ label, icon: Icon, tone, mono }: { label: string; icon?: React.ElementType; tone: "slate" | "primary" | "rose"; mono?: boolean }) {
  const palette = {
    slate:   "bg-slate-100 text-slate-600",
    primary: "bg-primary/8 text-primary",
    rose:    "bg-rose-50 text-rose-700",
  }[tone]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", palette, mono && "font-mono")}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1">
        {Icon && <Icon className="w-2.5 h-2.5" />}
        {label}
      </p>
      <p className="text-sm font-bold font-mono tabular-nums text-slate-700 mt-0.5">{value}</p>
    </div>
  )
}
