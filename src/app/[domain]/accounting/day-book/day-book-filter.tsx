"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"

interface Props {
  initialFyId:   string
  initialDateBS: string
  fiscalYears:   { id: string; name: string; isCurrent?: boolean }[]
}

export function DayBookFilter({ initialFyId, initialDateBS, fiscalYears }: Props) {
  const router = useRouter()
  const [fyId, setFyId]     = useState(initialFyId)
  const [dateBS, setDateBS] = useState(initialDateBS)

  // Sync when URL changes via prev/next/Today links
  useEffect(() => { setDateBS(initialDateBS) }, [initialDateBS])
  useEffect(() => { setFyId(initialFyId)     }, [initialFyId])

  function apply(overrides?: Partial<{ fy: string; date: string }>) {
    const next = {
      fy:   overrides?.fy   ?? fyId,
      date: overrides?.date ?? dateBS,
    }
    const sp = new URLSearchParams({ fy: next.fy, date: next.date })
    router.push(`/accounting/day-book?${sp.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={fyId}
        onChange={e => { setFyId(e.target.value); apply({ fy: e.target.value }) }}
        className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {fiscalYears.map(f => (
          <option key={f.id} value={f.id}>FY {f.name}{f.isCurrent ? " (current)" : ""}</option>
        ))}
      </select>
      <div className="w-48">
        <NepaliDateInput value={dateBS} onChange={d => { setDateBS(d); apply({ date: d }) }} />
      </div>
      <Button size="sm" onClick={() => apply()} className="cursor-pointer text-xs">Apply</Button>
    </div>
  )
}
