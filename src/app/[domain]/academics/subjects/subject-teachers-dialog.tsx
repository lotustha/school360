"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Star, Trash2, Plus, Users, X } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import {
  listSubjectTeachers, assignSubjectTeacher, removeSubjectTeacher,
} from "@/actions/academics"

type TeacherOption = { id: string; fullName: string; role: string }

type SubjectTeacherRow = {
  id:         string
  isPrimary:  boolean
  teacher:    { id: string; fullName: string; role: string; email: string | null; avatarUrl: string | null }
}

interface Props {
  subjectId:   string
  subjectName: string
  teachers:    TeacherOption[]   // pool of all candidate teachers in the school
  onClose:     () => void
}

export function SubjectTeachersDialog({ subjectId, subjectName, teachers, onClose }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<SubjectTeacherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pickedTeacher, setPickedTeacher] = useState<string>("")
  const [makePrimary, setMakePrimary] = useState(false)
  const [pending, startT] = useTransition()

  async function reload() {
    setLoading(true)
    try {
      const data = await listSubjectTeachers(subjectId)
      setRows(data as SubjectTeacherRow[])
    } catch {
      toast.error("Failed to load teachers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [subjectId])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdd() {
    if (!pickedTeacher) { toast.error("Pick a teacher"); return }
    startT(async () => {
      try {
        await assignSubjectTeacher({ subjectId, teacherUserId: pickedTeacher, isPrimary: makePrimary })
        toast.success("Teacher assigned")
        setPickedTeacher("")
        setMakePrimary(false)
        await reload()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to assign")
      }
    })
  }

  function handleSetPrimary(row: SubjectTeacherRow) {
    startT(async () => {
      try {
        await assignSubjectTeacher({ subjectId, teacherUserId: row.teacher.id, isPrimary: true })
        toast.success(`${row.teacher.fullName} is now the primary teacher`)
        await reload()
      } catch {
        toast.error("Failed to update primary")
      }
    })
  }

  function handleRemove(row: SubjectTeacherRow) {
    if (!confirm(`Unassign ${row.teacher.fullName} from ${subjectName}?`)) return
    startT(async () => {
      try {
        await removeSubjectTeacher(row.id)
        toast.success("Teacher unassigned")
        await reload()
        router.refresh()
      } catch {
        toast.error("Failed to unassign")
      }
    })
  }

  const assigned = new Set(rows.map(r => r.teacher.id))
  const available = teachers.filter(t => !assigned.has(t.id))

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-white/95 backdrop-blur-xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Teachers for {subjectName}
          </DialogTitle>
          <DialogDescription>
            Assign one or more teachers to this subject. The primary teacher is the default suggestion in routine cells.
          </DialogDescription>
        </DialogHeader>

        {/* Current assignments */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="text-center text-xs text-slate-400 py-6">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-6 bg-slate-50/60 rounded-lg">No teachers assigned yet</div>
          ) : (
            rows.map(r => (
              <div key={r.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  r.isPrimary
                    ? "bg-amber-50/60 border-amber-200"
                    : "bg-white border-slate-200"
                )}>
                <Avatar name={r.teacher.fullName} url={r.teacher.avatarUrl} size={28} rounded="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.teacher.fullName}</p>
                  <p className="text-[10px] text-slate-400">{r.teacher.role}{r.teacher.email && ` · ${r.teacher.email}`}</p>
                </div>
                {r.isPrimary ? (
                  <Badge className="text-[10px] font-bold gap-0.5 bg-amber-100 text-amber-800 border-amber-300">
                    <Star className="w-2.5 h-2.5" /> Primary
                  </Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => handleSetPrimary(r)} disabled={pending}
                    className="gap-0.5 cursor-pointer text-[10px] h-6 px-2">
                    <Star className="w-2.5 h-2.5" /> Make primary
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleRemove(r)} disabled={pending}
                  className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add row */}
        <div className="bg-slate-50/60 border border-slate-200 rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <Select value={pickedTeacher} onValueChange={setPickedTeacher}>
              <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 flex-1">
                <SelectValue placeholder={available.length === 0 ? "All teachers already assigned" : "Pick a teacher to add"} />
              </SelectTrigger>
              <SelectContent>
                {available.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName} <span className="text-[10px] text-slate-400 ml-1">{t.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={pending || !pickedTeacher}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-9">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={makePrimary} onChange={e => setMakePrimary(e.target.checked)}
              className="cursor-pointer" />
            Set as primary teacher (replaces any current primary)
          </label>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
