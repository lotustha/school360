"use client"

import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { UsersRound, Save, X, Search, GraduationCap } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  createStudentGroup, updateStudentGroup, setStudentGroupMembers, getStudentGroup,
} from "@/actions/student-groups"

type ClassOpt   = { id: string; name: string }
type SubjectOpt = { id: string; name: string; code: string; class: { id: string; name: string } }
type StudentRow = { id: string; fullName: string; admissionNo: string; rollNumber: string | null; classId: string; sectionId: string | null }

type GroupShape = {
  id:      string
  name:    string
  note:    string | null
  subject: { id: string; name: string; code: string } | null
}

interface Props {
  schoolId: string
  editing:  GroupShape | null
  classes:  ClassOpt[]
  subjects: SubjectOpt[]
  students: StudentRow[]
  onClose:  () => void
}

export function GroupBuilderDrawer({ schoolId, editing, classes, subjects, students, onClose }: Props) {
  const isEdit = editing !== null
  const [name,      setName]      = useState(editing?.name ?? "")
  const [note,      setNote]      = useState(editing?.note ?? "")
  const [subjectId, setSubjectId] = useState(editing?.subject?.id ?? "NONE")
  const [picks,     setPicks]     = useState<Set<string>>(new Set())
  const [classFilter, setClassFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [pending, startT] = useTransition()
  const [loadingMembers, setLoadingMembers] = useState(isEdit)

  // Load existing members on mount when editing
  useEffect(() => {
    if (!isEdit || !editing) return
    let cancelled = false
    getStudentGroup(editing.id)
      .then(g => {
        if (cancelled || !g) return
        setPicks(new Set(g.members.map(m => m.student.id)))
      })
      .catch(() => toast.error("Failed to load members"))
      .finally(() => { if (!cancelled) setLoadingMembers(false) })
    return () => { cancelled = true }
  }, [editing, isEdit])

  function togglePick(id: string) {
    const next = new Set(picks)
    if (next.has(id)) next.delete(id); else next.add(id)
    setPicks(next)
  }

  const filtered = students.filter(s => {
    if (classFilter !== "ALL" && s.classId !== classFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!s.fullName.toLowerCase().includes(q) && !s.admissionNo.toLowerCase().includes(q)) return false
    }
    return true
  })

  async function handleSave() {
    if (!name.trim()) { toast.error("Group name is required"); return }
    startT(async () => {
      try {
        if (isEdit && editing) {
          await updateStudentGroup(editing.id, {
            name,
            note: note.trim() || null,
            subjectId: subjectId === "NONE" ? null : subjectId,
          })
          await setStudentGroupMembers(editing.id, [...picks])
        } else {
          await createStudentGroup({
            schoolId,
            name,
            note: note.trim() || undefined,
            subjectId: subjectId === "NONE" ? undefined : subjectId,
            studentIds: [...picks],
          })
        }
        toast.success(isEdit ? "Group updated" : "Group created")
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  // Count picks per class for the live preview chips
  const picksByClass: Record<string, number> = {}
  for (const sid of picks) {
    const s = students.find(x => x.id === sid)
    if (s) picksByClass[s.classId] = (picksByClass[s.classId] ?? 0) + 1
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <UsersRound className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Student Group" : "New Student Group"}</div>
              <div className="text-xs text-muted-foreground font-normal">Pick students from any class — they form a joint cohort</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Group editor</SheetDescription>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. 9A-9B Computer Science"
              className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Permanent for subject (optional)</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="mt-1 h-9 text-sm cursor-pointer bg-white border-slate-200">
                  <SelectValue placeholder="Not bound to a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE"><span className="text-muted-foreground">Not bound to a subject</span></SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.class.name} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note (optional)</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} rows={1}
                placeholder="What this group is for"
                className="mt-1 text-sm bg-white border-slate-200 rounded-lg" />
            </div>
          </div>

          {/* Picks summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="text-[10px] font-bold bg-violet-100 text-violet-800 border-violet-200">
              {picks.size} student{picks.size === 1 ? "" : "s"} selected
            </Badge>
            {Object.entries(picksByClass).map(([cid, count]) => {
              const c = classes.find(x => x.id === cid)
              return (
                <Badge key={cid} variant="outline" className="text-[10px] font-bold gap-1">
                  <GraduationCap className="w-2.5 h-2.5" /> {c?.name ?? cid}: {count}
                </Badge>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or admission no…"
                className="h-9 pl-8 text-xs bg-white border-slate-200 rounded-lg" />
            </div>
          </div>

          {/* Student list */}
          {loadingMembers ? (
            <div className="text-center text-xs text-slate-400 py-6">Loading members…</div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto bg-slate-50/60 rounded-lg border border-slate-200 p-2">
              {filtered.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">No students match the filter</div>
              ) : (
                filtered.map(s => {
                  const c = classes.find(x => x.id === s.classId)
                  return (
                    <label key={s.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors",
                        picks.has(s.id) ? "bg-violet-100" : "bg-white hover:bg-slate-50"
                      )}>
                      <Checkbox checked={picks.has(s.id)} onCheckedChange={() => togglePick(s.id)}
                        className="cursor-pointer" />
                      <span className="text-xs font-semibold flex-1 truncate">{s.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{s.admissionNo}</span>
                      <Badge variant="outline" className="text-[9px] font-bold">{c?.name ?? "—"}</Badge>
                    </label>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
