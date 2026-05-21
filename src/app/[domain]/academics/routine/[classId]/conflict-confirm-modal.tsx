"use client"

import { AlertTriangle, X, Check, GraduationCap, BookOpen, UsersRound } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type ConflictItem = {
  id:           string
  class:        { id: string; name: string }
  subject:      { id: string; name: string } | null
  studentGroup: { id: string; name: string } | null
}

interface Props {
  conflicts:  ConflictItem[]
  onCancel:   () => void
  onConfirm:  () => void
}

export function ConflictConfirmModal({ conflicts, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="bg-white/95 backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Teacher Conflict
          </DialogTitle>
          <DialogDescription>
            This teacher is already assigned to {conflicts.length} other slot{conflicts.length === 1 ? "" : "s"} at the same time. Continue anyway?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {conflicts.map(c => (
            <div key={c.id} className="bg-amber-50/60 border border-amber-200 rounded-lg px-3 py-2 text-xs">
              <p className="font-semibold flex items-center gap-1.5">
                <GraduationCap className="w-3 h-3 text-amber-700" /> {c.class.name}
              </p>
              <p className="text-slate-600 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3 h-3" /> {c.subject?.name ?? "—"}
                {c.studentGroup && <>
                  <span className="text-slate-300">·</span>
                  <UsersRound className="w-3 h-3" /> {c.studentGroup.name}
                </>}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}
            className="gap-1.5 cursor-pointer shadow-md shadow-amber-500/30 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8">
            <Check className="w-3.5 h-3.5" /> Override and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
