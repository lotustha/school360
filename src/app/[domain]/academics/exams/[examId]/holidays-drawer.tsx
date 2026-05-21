"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarOff, Plus, X, Trash2, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { formatBS, toAD } from "@/lib/nepali-date"
import {
  addExamHoliday, deleteExamHoliday,
  type ExamHolidayRow,
} from "@/actions/exams"

interface Props {
  schoolId:        string
  examId:          string
  initialHolidays: ExamHolidayRow[]
}

export function HolidaysDrawer({ schoolId, examId, initialHolidays }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dateBS, setDateBS] = useState("")
  const [reason, setReason] = useState("")

  function reset() {
    setDateBS("")
    setReason("")
  }

  function handleAdd() {
    if (!dateBS) { toast.error("Pick a date"); return }
    setAdding(true)
    startT(async () => {
      try {
        await addExamHoliday({
          schoolId, examId,
          dateBS,
          dateAD: toAD(dateBS),
          reason: reason.trim() || null,
        })
        toast.success(`Holiday added: ${formatBS(dateBS)}`)
        reset()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      } finally {
        setAdding(false)
      }
    })
  }

  function handleDelete(id: string, dateBS: string) {
    if (!confirm(`Remove holiday on ${formatBS(dateBS)}?`)) return
    startT(async () => {
      try {
        await deleteExamHoliday(id, schoolId)
        toast.success("Holiday removed")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer bg-white text-rose-700 border-rose-200 hover:bg-rose-50">
          <CalendarOff className="w-3.5 h-3.5" />
          Manage holidays
          {initialHolidays.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black tabular-nums">
              {initialHolidays.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CalendarOff className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Exam Holidays</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              Block specific BS dates from being used in this terminal&apos;s routine. Auto-spread skips
              them; manual drag will still warn before placing on a blocked day.
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          {/* Add form */}
          <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Add holiday</p>
            <div className="space-y-2">
              <NepaliDateInput value={dateBS} onChange={setDateBS} />
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional) — e.g. Dashain, Public holiday"
                className="h-9 text-sm bg-white border-slate-200"
                maxLength={120}
              />
              <Button size="sm" onClick={handleAdd} disabled={adding || !dateBS}
                className="gap-1.5 cursor-pointer text-xs h-8 font-bold w-full">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add holiday
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Blocked dates ({initialHolidays.length})
            </p>
            {initialHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No blocked dates yet.</p>
            ) : (
              <div className="space-y-1.5">
                {initialHolidays.map(h => (
                  <div key={h.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 font-mono tabular-nums">{formatBS(h.dateBS)}</p>
                      {h.reason && <p className="text-[10px] text-slate-500 truncate">{h.reason}</p>}
                    </div>
                    <button onClick={() => handleDelete(h.id, h.dateBS)}
                      title="Remove"
                      className="w-7 h-7 rounded-md hover:bg-rose-100 text-rose-500 flex items-center justify-center cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
