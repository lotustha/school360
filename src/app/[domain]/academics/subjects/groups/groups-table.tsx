"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Layers, Pencil, Trash2, UsersRound, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GroupDrawer, type GroupDrawerData, type ClassOpt, type FacultyOpt, type YearOpt } from "./group-drawer"
import { ManageDrawer, type ManageGroupData, type PredecessorGroupOpt } from "./manage-drawer"
import { deleteSubjectGroup } from "@/actions/subject-groups"

export interface GroupRow {
  id:               string
  label:            string
  kind:             "OPTIONAL_PICK" | "EXTRA_COHORT"
  pickCount:        number
  classId:          string
  className:        string
  facultyName:      string | null
  subjects:         { id: string; name: string; code: string; type: string }[]
  /** Total enrollments this year (a student picking pickCount subjects counts pickCount times). */
  enrolledCount:    number
  /** Distinct students with ≥1 enrollment in this group this year. */
  enrolledStudents: number
  /** Active class roster - enrolledStudents. */
  unenrolledCount:  number
  /** Active students in the group's class. */
  classRosterCount: number
}

interface Props {
  schoolId:  string
  rows:      GroupRow[]
  faculties: FacultyOpt[]
  classes:   ClassOpt[]
  years:     YearOpt[]
  /** Map: classId → groups on the class one grade below it. */
  predecessorGroupsByClass: Record<string, PredecessorGroupOpt[]>
}

export function GroupsTable({ schoolId, rows, faculties, classes, years, predecessorGroupsByClass }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [editing, setEditing] = useState<GroupDrawerData | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [managing, setManaging] = useState<ManageGroupData | null>(null)
  const [manageOpen, setManageOpen] = useState(false)

  function onEdit(g: GroupRow) {
    setEditing({
      id:          g.id,
      label:       g.label,
      kind:        g.kind,
      pickCount:   g.pickCount,
      classId:     g.classId,
      subjectIds:  g.subjects.map(s => s.id),
    })
    setDrawerOpen(true)
  }

  function onManage(g: GroupRow) {
    setManaging({
      id:        g.id,
      label:     g.label,
      kind:      g.kind,
      pickCount: g.pickCount,
      classId:   g.classId,
      className: g.className,
      subjects:  g.subjects.map(s => ({ id: s.id, name: s.name, code: s.code })),
    })
    setManageOpen(true)
  }

  function onDelete(g: GroupRow) {
    if (!confirm(`Delete group "${g.label}"? This removes all enrollments in it.`)) return
    startT(async () => {
      try {
        await deleteSubjectGroup(g.id)
        toast.success("Group deleted")
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-12 text-center">
        <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-1">No subject groups yet</p>
        <p className="text-xs text-slate-500 mb-4">
          Group optional subjects (e.g. Optional I = Math + Economics) or curate cohorts for EXTRA subjects (e.g. Computer).
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setDrawerOpen(true) }} className="cursor-pointer">
          <Plus className="w-4 h-4 mr-1.5" />
          New Group
        </Button>
        <GroupDrawer
          schoolId={schoolId}
          faculties={faculties}
          years={years}
          classes={classes}
          editing={editing}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Label</th>
              <th className="text-left px-4 py-3">Class</th>
              <th className="text-left px-4 py-3">Kind</th>
              <th className="text-left px-4 py-3">Subjects</th>
              <th className="text-left px-4 py-3">Enrolled</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(g => (
              <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-medium">{g.label}</td>
                <td className="px-4 py-3">
                  <div className="text-sm">{g.className}</div>
                  {g.facultyName && (
                    <div className="text-[10px] text-slate-400">{g.facultyName}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {g.kind === "OPTIONAL_PICK" ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Optional · pick {g.pickCount}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                      Extra cohort
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[300px]">
                    {g.subjects.map(s => (
                      <span key={s.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                      {g.enrolledStudents} <span className="text-[10px] text-slate-400 font-normal">of {g.classRosterCount}</span>
                    </span>
                    {g.unenrolledCount > 0 && (
                      <span className="text-[10px] text-amber-700">
                        {g.unenrolledCount} unassigned
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm" variant="ghost" className="h-8 px-2 cursor-pointer"
                      onClick={() => onManage(g)}
                      title="Manage students"
                    >
                      <UsersRound className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 px-2 cursor-pointer"
                      onClick={() => onEdit(g)}
                      title="Edit group"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 px-2 cursor-pointer text-red-600 hover:text-red-700"
                      onClick={() => onDelete(g)}
                      title="Delete group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GroupDrawer
        schoolId={schoolId}
        faculties={faculties}
        years={years}
        classes={classes}
        editing={editing}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <ManageDrawer
        group={managing}
        years={years}
        predecessorGroups={managing ? predecessorGroupsByClass[managing.classId] : []}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  )
}
