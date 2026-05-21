"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  studentId:   string
  current:     string
  evaluations: { id: string; name: string; sequenceNumber: number; isFinal: boolean }[]
}

export function EvaluationPicker({ studentId, current, evaluations }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const currentEval = evaluations.find(e => e.id === current)

  if (!mounted) {
    return (
      <div className="flex h-8 min-w-[200px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700">
        <span className="truncate">
          {currentEval ? currentEval.name : "Choose evaluation"}
          {currentEval?.isFinal && <span className="text-[10px] text-emerald-600 ml-1 font-bold">FINAL</span>}
        </span>
        <span className="ml-2 text-slate-400">▾</span>
      </div>
    )
  }

  return (
    <Select
      value={current}
      onValueChange={v => router.push(`/academics/evaluations/transcript/${studentId}?evaluationId=${v}`)}
    >
      <SelectTrigger className="h-8 text-xs cursor-pointer bg-white border-slate-200 min-w-[200px]">
        <SelectValue placeholder="Choose evaluation" />
      </SelectTrigger>
      <SelectContent>
        {evaluations.map(e => (
          <SelectItem key={e.id} value={e.id}>
            {e.name}
            {e.isFinal && <span className="text-[10px] text-emerald-600 ml-1 font-bold">FINAL</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
