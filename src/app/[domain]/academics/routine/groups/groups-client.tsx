"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users, Plus, Pencil, Trash2, BookOpen, GraduationCap, UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteStudentGroup } from "@/actions/student-groups"
import { GroupBuilderDrawer } from "./group-builder-drawer"

type ClassOpt   = { id: string; name: string }
type SubjectOpt = { id: string; name: string; code: string; class: { id: string; name: string } }
type StudentRow = { id: string; fullName: string; admissionNo: string; rollNumber: string | null; classId: string; sectionId: string | null }

type GroupShape = {
  id:         string
  name:       string
  note:       string | null
  subject:    { id: string; name: string; code: string } | null
  _count:     { members: number; routineEntries: number }
  members:    { student: { id: string; class: { id: string; name: string } | null; section: { id: string; name: string } | null } }[]
}

interface Props {
  schoolId: string
  groups:   GroupShape[]
  classes:  ClassOpt[]
  subjects: SubjectOpt[]
  students: StudentRow[]
}

export function GroupsClient({ schoolId, groups, classes, subjects, students }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<GroupShape | null>(null)

  function handleDelete(g: GroupShape) {
    const force = g._count.routineEntries > 0
    const msg = force
      ? `Delete "${g.name}"? It is used by ${g._count.routineEntries} routine entr${g._count.routineEntries === 1 ? "y" : "ies"} which will be detached (set to whole-class default).`
      : `Delete "${g.name}"?`
    if (!confirm(msg)) return
    startT(async () => {
      try {
        await deleteStudentGroup(g.id, { force })
        toast.success("Group deleted")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <UsersRound className="w-3 h-3" /> {groups.length} group{groups.length === 1 ? "" : "s"}
        </Badge>
        <Button size="sm" onClick={() => setCreating(true)}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
          <Plus className="w-3.5 h-3.5" /> New Group
        </Button>
      </div>

      {groups.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <UsersRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No student groups yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            Create a group for any cohort that crosses class boundaries — e.g. <em>&quot;9A-9B Computer Science elective&quot;</em>.
            Groups can then be assigned to routine cells so the joint session shows up in both classes&apos; grids.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Group
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map(g => {
          // Count members per class for the summary chip
          const byClass: Record<string, number> = {}
          for (const m of g.members) {
            const cname = m.student.class?.name ?? "—"
            byClass[cname] = (byClass[cname] ?? 0) + 1
          }
          return (
            <div key={g.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <UsersRound className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{g.name}</p>
                  {g.subject && (
                    <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <BookOpen className="w-2.5 h-2.5" /> Permanent for {g.subject.name}
                    </p>
                  )}
                  {g.note && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{g.note}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-bold gap-1">
                      <Users className="w-2.5 h-2.5" /> {g._count.members}
                    </Badge>
                    {g._count.routineEntries > 0 && (
                      <Badge className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                        in {g._count.routineEntries} routine entr{g._count.routineEntries === 1 ? "y" : "ies"}
                      </Badge>
                    )}
                  </div>
                  {Object.keys(byClass).length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Object.entries(byClass).map(([cname, count]) => (
                        <span key={cname} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <GraduationCap className="w-2.5 h-2.5" /> {cname}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(g)}
                  className="gap-1 cursor-pointer text-[11px] h-7 px-2">
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(g)} disabled={pending}
                  className="ml-auto h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {(creating || editing) && (
        <GroupBuilderDrawer
          key={editing?.id ?? "new"}
          schoolId={schoolId}
          editing={editing}
          classes={classes}
          subjects={subjects}
          students={students}
          onClose={() => { setCreating(false); setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}
