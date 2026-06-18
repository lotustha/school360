"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { gradeAttempt } from "@/actions/lms/quizzes"

/** Manual score override (e.g. after reading essay answers). */
export function QuizResultsActions({
  attemptId, currentScore, totalMarks,
}: {
  attemptId: string; currentScore: number | null; totalMarks: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState(currentScore != null ? String(currentScore) : "")
  const [isPending, startTransition] = useTransition()

  function submit() {
    const s = Number(score)
    if (score === "" || Number.isNaN(s)) { toast.error("Enter a score"); return }
    if (s > totalMarks) { toast.error(`Max ${totalMarks}`); return }
    startTransition(async () => {
      try {
        await gradeAttempt(attemptId, s)
        toast.success("Score updated")
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not update")
      }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Override score" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Override score</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Score (out of {totalMarks})</Label>
            <Input type="number" min={0} max={totalMarks} value={score} onChange={e => setScore(e.target.value)} autoFocus />
            <p className="text-[11px] text-slate-500">Use this after manually grading essay answers.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
