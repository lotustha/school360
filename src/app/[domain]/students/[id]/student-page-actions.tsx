"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, Pencil, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteStudent } from "@/actions/students"
import { useEditMode } from "./edit-mode-context"
import { cn } from "@/lib/utils"

interface Props {
  schoolId:    string
  studentId:   string
  studentName: string
}

export function StudentPageActions({ schoolId, studentId, studentName }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [confirm, setConfirm] = useState("")
  const [pending, startT]     = useTransition()

  function doDelete() {
    if (confirm.trim() !== studentName.trim()) return
    startT(async () => {
      try {
        await deleteStudent(schoolId, studentId)
        toast.success(`${studentName} deleted`)
        router.push("/students")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete student")
      }
    })
  }

  const { editing, setEditing } = useEditMode()

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-[11px] text-slate-500">
          {editing
            ? "Tab through fields · changes save on blur · Esc/click Done to exit"
            : "Double-click any field to edit · or click Edit to unlock all"}
        </span>

        {editing ? (
          <Button variant="default" size="sm"
            onClick={() => setEditing(false)}
            className="gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700">
            <Check className="w-3.5 h-3.5" /> Done editing
          </Button>
        ) : (
          <Button variant="outline" size="sm"
            onClick={() => setEditing(true)}
            className={cn(
              "gap-1.5 cursor-pointer",
              "border-primary/30 text-primary hover:bg-primary/8 hover:text-primary",
            )}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        )}

        <Button variant="outline" size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 cursor-pointer text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirm("") }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" /> Delete student permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong className="text-slate-800">{studentName}</strong> and every related record — marks, attendance, fee transactions, evaluations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">
              Type the full name to confirm:
              <code className="ml-2 font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{studentName}</code>
            </label>
            <Input value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder={studentName}
              autoFocus
              className="font-mono text-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              disabled={confirm.trim() !== studentName.trim() || pending}
              className="bg-rose-600 hover:bg-rose-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
