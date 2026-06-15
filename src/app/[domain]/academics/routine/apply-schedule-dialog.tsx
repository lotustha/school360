"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Send, X, GraduationCap, AlertTriangle } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { applyScheduleToClasses } from "@/actions/routine"

type ClassShape = { id: string; name: string; facultyName: string | null; periodScheduleId: string | null }

interface Props {
  schedule: { id: string; name: string }
  classes:  ClassShape[]
  onClose:  () => void
}

export function ApplyScheduleDialog({ schedule, classes, onClose }: Props) {
  // Default: pre-check classes that already use this schedule
  const [picks, setPicks] = useState<Set<string>>(
    new Set(classes.filter(c => c.periodScheduleId === schedule.id).map(c => c.id))
  )
  const [pending, startT] = useTransition()

  function toggle(id: string) {
    const next = new Set(picks)
    if (next.has(id)) next.delete(id); else next.add(id)
    setPicks(next)
  }

  async function handleApply() {
    if (picks.size === 0) { toast.error("Pick at least one class"); return }
    startT(async () => {
      try {
        const res = await applyScheduleToClasses(schedule.id, [...picks])
        if (res.error) { toast.error(res.error); return }
        toast.success(`Applied to ${res.applied} class${res.applied === 1 ? "" : "es"}`)
        if (res.warnings.length > 0) {
          res.warnings.forEach(w => toast.warning(w))
        }
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to apply")
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-white/95 backdrop-blur-xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Apply &quot;{schedule.name}&quot; to classes
          </DialogTitle>
          <DialogDescription>
            Select which classes will use this schedule. Re-applying to classes already on this schedule is harmless.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-1.5 -mx-2 px-2">
          {classes.map(c => {
            const onOtherSchedule = c.periodScheduleId && c.periodScheduleId !== schedule.id
            const onThisSchedule  = c.periodScheduleId === schedule.id
            return (
              <label key={c.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  picks.has(c.id) ? "bg-primary/5 border-primary/30" : "bg-white border-slate-200 hover:bg-slate-50"
                )}>
                <Checkbox checked={picks.has(c.id)} onCheckedChange={() => toggle(c.id)}
                  className="cursor-pointer" />
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  {c.facultyName && <p className="text-[10px] text-slate-400">{c.facultyName}</p>}
                </div>
                {onThisSchedule && (
                  <Badge variant="secondary" className="text-[10px] font-bold">Current</Badge>
                )}
                {onOtherSchedule && (
                  <Badge className="text-[10px] font-bold gap-1 bg-amber-50 text-amber-700 border-amber-200">
                    <AlertTriangle className="w-2.5 h-2.5" /> Other schedule
                  </Badge>
                )}
              </label>
            )
          })}
          {classes.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-6">No classes available</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={pending || picks.size === 0}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Send className="w-3.5 h-3.5" /> {pending ? "Applying…" : `Apply to ${picks.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
