"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"

interface Props {
  initialFyId:   string
  initialDateBS: string
  fiscalYears:   { id: string; name: string }[]
}

export function DayBookFilter({ initialFyId, initialDateBS, fiscalYears }: Props) {
  const router = useRouter()
  const [fyId, setFyId]     = useState(initialFyId)
  const [dateBS, setDateBS] = useState(initialDateBS)

  function apply() {
    const sp = new URLSearchParams({ fy: fyId, date: dateBS })
    router.push(`/accounting/day-book?${sp.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={fyId} onChange={e => setFyId(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
        {fiscalYears.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
      </select>
      <div className="w-44">
        <NepaliDateInput value={dateBS} onChange={setDateBS} />
      </div>
      <Button size="sm" onClick={apply} className="cursor-pointer text-xs">Apply</Button>
    </div>
  )
}
