"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Lock, Loader2, CheckCircle2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { todayBS, fiscalYearOf, formatBS } from "@/lib/nepali-date"
import {
  createFiscalYear, setCurrentFiscalYear, lockFiscalYear,
} from "@/actions/accounting/fiscal-years"

interface FY { id: string; name: string; startBS: string; endBS: string; status: string; isCurrent: boolean }

export function FiscalYearsClient({ years }: { years: FY[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [seedBS, setSeedBS] = useState(() => {
    const d = todayBS().split("-").map(Number)
    return `${d[0] + 1}-04-01`
  })
  const preview = useMemo(() => { try { return fiscalYearOf(seedBS) } catch { return null } }, [seedBS])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Fiscal Years</h1>

      {/* Add new */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <p className="font-semibold text-sm mb-3">Create Next Fiscal Year</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">A date inside the FY (BS)</label>
            <NepaliDateInput value={seedBS} onChange={setSeedBS} />
          </div>
          {preview && (
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-700">Will create</p>
              <p className="text-lg font-bold mt-0.5">FY {preview.name}</p>
              <p className="text-[11px] text-slate-700">{formatBS(preview.startBS)} – {formatBS(preview.endBS)}</p>
            </div>
          )}
          <div className="flex items-end">
            <Button
              disabled={pending || !preview}
              onClick={() => start(async () => {
                try {
                  const fy = await createFiscalYear({ startBS: seedBS })
                  toast.success(`Created FY ${fy.name}`)
                  router.refresh()
                } catch (e) { toast.error((e as Error).message) }
              })}
              className="cursor-pointer gap-1.5 w-full"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create FY
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {years.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No fiscal years yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Start (BS)</th>
                <th className="px-4 py-3 text-left">End (BS)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {years.map(fy => (
                <tr key={fy.id} className="hover:bg-primary/4 transition-colors">
                  <td className="px-4 py-3 font-bold">{fy.name}{fy.isCurrent && <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">CURRENT</Badge>}</td>
                  <td className="px-4 py-3 text-xs">{formatBS(fy.startBS)}</td>
                  <td className="px-4 py-3 text-xs">{formatBS(fy.endBS)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-bold",
                      fy.status === "OPEN"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      fy.status === "CLOSED" && "bg-amber-50 text-amber-700 border-amber-200",
                      fy.status === "LOCKED" && "bg-slate-100 text-slate-600 border-slate-300",
                    )}>{fy.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {!fy.isCurrent && (
                        <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs gap-1" onClick={() => start(async () => {
                          await setCurrentFiscalYear(fy.id)
                          toast.success(`${fy.name} set as current`)
                          router.refresh()
                        })}>
                          <Sparkles className="w-3 h-3" /> Set current
                        </Button>
                      )}
                      {fy.status !== "LOCKED" && (
                        <Button size="sm" variant="ghost" disabled={pending} className="cursor-pointer text-xs gap-1 text-slate-500" onClick={() => start(async () => {
                          if (!confirm(`Lock FY ${fy.name}? No further postings allowed.`)) return
                          await lockFiscalYear(fy.id)
                          toast.success(`${fy.name} locked`)
                          router.refresh()
                        })}>
                          <Lock className="w-3 h-3" /> Lock
                        </Button>
                      )}
                      {fy.isCurrent && (
                        <span className="inline-flex items-center text-xs text-emerald-700 px-2"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
