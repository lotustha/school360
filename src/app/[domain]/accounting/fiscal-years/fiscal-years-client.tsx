"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Plus, Lock, Loader2, CheckCircle2, Sparkles, FileCheck, CalendarRange,
  Calendar, Clock, ShieldCheck, Unlock,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS, fiscalYearOf, formatBS } from "@/lib/nepali-date"
import {
  createFiscalYear, setCurrentFiscalYear, lockFiscalYear,
} from "@/actions/accounting/fiscal-years"
import { ReportKpi } from "@/components/accounting/report-shell"

interface FY { id: string; name: string; startBS: string; endBS: string; status: string; isCurrent: boolean }

const STATUS_TONE: Record<string, string> = {
  OPEN:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-amber-50   text-amber-700   border-amber-200",
  LOCKED: "bg-slate-100  text-slate-600   border-slate-300",
}

export function FiscalYearsClient({ years }: { years: FY[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [seedBS, setSeedBS] = useState(() => {
    const d = todayBS().split("-").map(Number)
    return `${d[0] + 1}-04-01`
  })
  const preview = useMemo(() => { try { return fiscalYearOf(seedBS) } catch { return null } }, [seedBS])

  const sorted = useMemo(() => [...years].sort((a, b) => b.startBS.localeCompare(a.startBS)), [years])
  const current = years.find(fy => fy.isCurrent)

  const stats = useMemo(() => ({
    total: years.length,
    open:   years.filter(y => y.status === "OPEN").length,
    closed: years.filter(y => y.status === "CLOSED").length,
    locked: years.filter(y => y.status === "LOCKED").length,
  }), [years])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Fiscal Years</h1>
            <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
              {stats.total} total
            </Badge>
            {current && (
              <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                CURRENT · FY {current.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <CalendarRange className="w-3 h-3 text-slate-400" />
            Nepali fiscal years run Shrawan 1 → Asar end. Set one as current to drive voucher numbering.
          </p>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpi label="Total FYs" value={String(stats.total)}  subtitle="All time"                icon={CalendarRange} tone="primary" />
        <ReportKpi label="Open"      value={String(stats.open)}   subtitle="Accepting postings"      icon={Unlock}        tone="emerald" />
        <ReportKpi label="Closed"    value={String(stats.closed)} subtitle="P&amp;L closed, not locked" icon={Clock}      tone="amber" />
        <ReportKpi label="Locked"    value={String(stats.locked)} subtitle="Read-only / archived"    icon={Lock}          tone="slate" />
      </div>

      {/* Add new */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <p className="font-semibold text-sm mb-1 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Create Next Fiscal Year
        </p>
        <p className="text-xs text-muted-foreground mb-4">Pick any BS date inside the year you want. We&apos;ll snap it to the Shrawan 1 → Asar end window automatically.</p>
        <div className="grid lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5 block">A date inside the FY (BS)</label>
            <NepaliDateInput value={seedBS} onChange={setSeedBS} />
          </div>
          {preview ? (
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Will create</p>
              <p className="text-lg font-bold mt-0.5">FY {preview.name}</p>
              <p className="text-[11px] text-slate-700 font-mono">{formatBS(preview.startBS)} → {formatBS(preview.endBS)}</p>
            </div>
          ) : (
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
              Invalid date.
            </div>
          )}
          <Button
            disabled={pending || !preview || years.some(y => y.name === preview?.name)}
            onClick={() => start(async () => {
              try {
                const fy = await createFiscalYear({ startBS: seedBS })
                toast.success(`Created FY ${fy.name}`)
                router.refresh()
              } catch (e) { toast.error((e as Error).message) }
            })}
            className="cursor-pointer gap-1.5 h-11"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create FY
          </Button>
        </div>
        {preview && years.some(y => y.name === preview.name) && (
          <p className="text-[11px] text-amber-700 mt-2 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> FY {preview.name} already exists.
          </p>
        )}
      </div>

      {/* List */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-16 text-center">
            <CalendarRange className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-1">No fiscal years yet.</p>
            <p className="text-xs text-slate-400">Create your first FY above to start accepting postings.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-black sticky top-0 z-10 backdrop-blur-xl">
              <tr>
                <th className="px-4 py-3 text-left">FY</th>
                <th className="px-4 py-3 text-left w-40">Start (BS)</th>
                <th className="px-4 py-3 text-left w-40">End (BS)</th>
                <th className="px-4 py-3 text-center w-28">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {sorted.map(fy => (
                <tr key={fy.id} className={cn(
                  "hover:bg-primary/4 transition-colors",
                  fy.isCurrent && "bg-emerald-50/30",
                )}>
                  <td className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border",
                        fy.isCurrent ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200",
                      )}>
                        <Calendar className={cn("w-3.5 h-3.5", fy.isCurrent ? "text-emerald-600" : "text-slate-500")} />
                      </div>
                      <div>
                        <p className="font-bold">FY {fy.name}</p>
                        {fy.isCurrent && (
                          <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">
                            Active for postings
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{formatBS(fy.startBS)}</td>
                  <td className="px-4 py-2.5 text-xs font-mono">{formatBS(fy.endBS)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", STATUS_TONE[fy.status])}>
                      {fy.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      {fy.status === "OPEN" && (
                        <Link href={`/accounting/year-end/${fy.id}`}>
                          <Button size="sm" variant="ghost" className="cursor-pointer text-xs gap-1 h-7 text-primary">
                            <FileCheck className="w-3 h-3" /> Year-End Close
                          </Button>
                        </Link>
                      )}
                      {!fy.isCurrent && fy.status !== "LOCKED" && (
                        <Button
                          size="sm" variant="ghost" disabled={pending}
                          className="cursor-pointer text-xs gap-1 h-7"
                          onClick={() => start(async () => {
                            await setCurrentFiscalYear(fy.id)
                            toast.success(`${fy.name} set as current`)
                            router.refresh()
                          })}
                        >
                          <Sparkles className="w-3 h-3" /> Set current
                        </Button>
                      )}
                      {fy.status !== "LOCKED" && (
                        <Button
                          size="sm" variant="ghost" disabled={pending}
                          className="cursor-pointer text-xs gap-1 h-7 text-slate-500"
                          onClick={() => start(async () => {
                            if (!confirm(`Lock FY ${fy.name}?\n\nNo further postings or edits allowed.`)) return
                            await lockFiscalYear(fy.id)
                            toast.success(`${fy.name} locked`)
                            router.refresh()
                          })}
                        >
                          <Lock className="w-3 h-3" /> Lock
                        </Button>
                      )}
                      {fy.isCurrent && (
                        <span className="inline-flex items-center text-[11px] text-emerald-700 px-2 font-bold gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-slate-500 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[9px] font-bold", STATUS_TONE.OPEN)}>OPEN</Badge>
          <span>= accepting new vouchers</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[9px] font-bold", STATUS_TONE.CLOSED)}>CLOSED</Badge>
          <span>= P&amp;L closed, can be reopened</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[9px] font-bold", STATUS_TONE.LOCKED)}>LOCKED</Badge>
          <span>= permanent read-only</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Locking is irreversible.</span>
        </span>
      </div>
    </div>
  )
}
