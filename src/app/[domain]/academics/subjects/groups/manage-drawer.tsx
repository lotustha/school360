"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UsersRound, Sparkles, X, ArrowDownToLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import {
  listGroupEnrollments, enrollStudent, unenrollStudent, fillRemaining,
  promoteCohortFromGradePredecessor,
} from "@/actions/subject-groups"

export interface ManageGroupData {
  id:         string
  label:      string
  kind:       "OPTIONAL_PICK" | "EXTRA_COHORT"
  pickCount:  number
  classId:    string
  className:  string
  subjects:   { id: string; name: string; code: string }[]
}

export interface PredecessorGroupOpt {
  id:        string
  label:     string
  className: string
  classId:   string
}

export interface YearOpt {
  id:          string
  name:        string
  isCurrent:   boolean
  startDateBS: string
}

interface Props {
  group:              ManageGroupData | null
  years:              YearOpt[]
  /** Groups on this class's grade predecessor (Class 9 if current is Class 10). */
  predecessorGroups?: PredecessorGroupOpt[]
  open:               boolean
  onOpenChange:       (open: boolean) => void
}

interface StudentRow {
  id:          string
  rollNumber:  string | null
  admissionNo: string
  fullName:    string
  avatarUrl:   string | null
}

export function ManageDrawer({ group, years, predecessorGroups = [], open, onOpenChange }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [yearId, setYearId] = useState<string>(years.find(y => y.isCurrent)?.id ?? years[0]?.id ?? "")
  const [students, setStudents] = useState<StudentRow[]>([])
  // enrollments keyed by `${studentId}::${subjectId}` for O(1) lookup
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [fillSubjectId, setFillSubjectId] = useState<string>(group?.subjects[0]?.id ?? "")
  const [passedOnly, setPassedOnly] = useState(false)
  const [promoteSourceGroupId, setPromoteSourceGroupId] = useState<string>(predecessorGroups[0]?.id ?? "")
  const [promoteSourceYearId, setPromoteSourceYearId] = useState<string>("")

  // Reset when group or year changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!group || !open || !yearId) return
    setLoading(true)
    listGroupEnrollments(group.id, yearId)
      .then(({ enrollments, classStudents }) => {
        setStudents(classStudents.map(s => ({
          id:          s.id,
          rollNumber:  s.rollNumber,
          admissionNo: s.admissionNo,
          fullName:    s.user.fullName,
          avatarUrl:   s.user.avatarUrl ?? null,
        })))
        setEnrolled(new Set(enrollments.map(e => `${e.studentId}::${e.subjectId}`)))
      })
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [group, yearId, open])

  // Default fill subject when group changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (group) setFillSubjectId(group.subjects[0]?.id ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [group])

  const enrolledByStudent = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const key of enrolled) {
      const [studentId, subjectId] = key.split("::")
      if (!m.has(studentId)) m.set(studentId, new Set())
      m.get(studentId)!.add(subjectId)
    }
    return m
  }, [enrolled])

  const unassignedCount = students.filter(s => (enrolledByStudent.get(s.id)?.size ?? 0) === 0).length

  const currentYearDate = years.find(y => y.id === yearId)?.startDateBS ?? ""
  const eligibleSourceYears = useMemo(
    () => years.filter(y => y.id !== yearId && y.startDateBS < currentYearDate),
    [years, yearId, currentYearDate],
  )

  // Pre-select most-recent prior year for the promote source.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (eligibleSourceYears.length > 0) {
      setPromoteSourceYearId(eligibleSourceYears[0].id)
    } else {
      setPromoteSourceYearId("")
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [eligibleSourceYears])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setPromoteSourceGroupId(predecessorGroups[0]?.id ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [predecessorGroups])

  if (!group) return null

  function onPick(studentId: string, subjectId: string) {
    if (!group || !yearId) return
    const existing = enrolledByStudent.get(studentId) ?? new Set<string>()
    const isOn = existing.has(subjectId)

    startT(async () => {
      try {
        if (isOn) {
          await unenrollStudent(group.id, yearId, studentId, subjectId)
          setEnrolled(prev => {
            const next = new Set(prev)
            next.delete(`${studentId}::${subjectId}`)
            return next
          })
        } else {
          // For OPTIONAL_PICK at pick=1, clear other selections in this group for the student.
          if (group.kind === "OPTIONAL_PICK" && group.pickCount === 1) {
            const toRemove = [...existing]
            await Promise.all(toRemove.map(sid =>
              unenrollStudent(group.id, yearId, studentId, sid),
            ))
          } else if (group.kind === "OPTIONAL_PICK" && existing.size >= group.pickCount) {
            toast.error(`Already at pick cap of ${group.pickCount}`)
            return
          }
          await enrollStudent(group.id, yearId, studentId, subjectId)
          setEnrolled(prev => {
            const next = new Set(prev)
            if (group.kind === "OPTIONAL_PICK" && group.pickCount === 1) {
              for (const sid of existing) next.delete(`${studentId}::${sid}`)
            }
            next.add(`${studentId}::${subjectId}`)
            return next
          })
        }
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  function clearStudent(studentId: string) {
    if (!group || !yearId) return
    const existing = [...(enrolledByStudent.get(studentId) ?? [])]
    if (existing.length === 0) return
    startT(async () => {
      try {
        await Promise.all(existing.map(sid =>
          unenrollStudent(group.id, yearId, studentId, sid),
        ))
        setEnrolled(prev => {
          const next = new Set(prev)
          for (const sid of existing) next.delete(`${studentId}::${sid}`)
          return next
        })
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  function onPromote() {
    if (!group || !yearId || !promoteSourceGroupId || !promoteSourceYearId) return
    startT(async () => {
      try {
        const { added } = await promoteCohortFromGradePredecessor(
          group.id, promoteSourceGroupId, promoteSourceYearId, yearId,
          { passedOnly },
        )
        if (added === 0) {
          toast("Nothing to promote — no matching promoted students or subject names")
        } else {
          toast.success(`Promoted ${added} enrollment${added === 1 ? "" : "s"} from grade predecessor`)
          const { enrollments } = await listGroupEnrollments(group.id, yearId)
          setEnrolled(new Set(enrollments.map(e => `${e.studentId}::${e.subjectId}`)))
        }
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  function onFillRemaining() {
    if (!group || !yearId || !fillSubjectId) return
    startT(async () => {
      try {
        const { added } = await fillRemaining(group.id, yearId, fillSubjectId)
        if (added === 0) {
          toast("Nothing to fill")
        } else {
          toast.success(`Filled ${added} student${added === 1 ? "" : "s"}`)
          // Refetch enrollments to reflect the bulk insert
          const { enrollments } = await listGroupEnrollments(group.id, yearId)
          setEnrolled(new Set(enrollments.map(e => `${e.studentId}::${e.subjectId}`)))
        }
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  const yearName  = years.find(y => y.id === yearId)?.name ?? ""
  const isExtra   = group.kind === "EXTRA_COHORT"
  const subject   = group.subjects[0] // for EXTRA_COHORT — there's only one

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[720px] sm:max-w-[720px] p-0 flex flex-col">
        <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <UsersRound className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold">
                {group.label} <span className="text-slate-400 font-normal">— {group.className}</span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isExtra
                  ? `Curate students for ${subject?.name ?? "this subject"}.`
                  : `Each student picks ${group.pickCount} of ${group.subjects.length}.`}
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Year</label>
            <Select value={yearId} onValueChange={setYearId}>
              <SelectTrigger className="h-9 w-[180px] bg-white border-slate-200 rounded-lg text-sm cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}{y.isCurrent ? " · current" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className={cn(
              "ml-auto text-[10px]",
              unassignedCount === 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200",
            )}>
              {unassignedCount === 0
                ? "All assigned"
                : `${unassignedCount} of ${students.length} unassigned`}
            </Badge>
          </div>

          {!isExtra && group.subjects.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Fill remaining →</span>
              <Select value={fillSubjectId} onValueChange={setFillSubjectId}>
                <SelectTrigger className="h-8 w-[200px] bg-white border-slate-200 rounded-lg text-sm cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={onFillRemaining} className="cursor-pointer h-8" disabled={unassignedCount === 0}>
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Fill
              </Button>
            </div>
          )}

          {isExtra && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={onFillRemaining}
                className="cursor-pointer h-8"
                disabled={unassignedCount === 0}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Enroll all remaining in {subject?.name}
              </Button>
            </div>
          )}

          {predecessorGroups.length > 0 && eligibleSourceYears.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-slate-500">Promote from</span>
              <Select value={promoteSourceGroupId} onValueChange={setPromoteSourceGroupId}>
                <SelectTrigger className="h-8 w-[200px] bg-white border-slate-200 rounded-lg text-xs cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {predecessorGroups.map(pg => (
                    <SelectItem key={pg.id} value={pg.id}>
                      {pg.className} · {pg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-slate-400">in</span>
              <Select value={promoteSourceYearId} onValueChange={setPromoteSourceYearId}>
                <SelectTrigger className="h-8 w-[120px] bg-white border-slate-200 rounded-lg text-xs cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleSourceYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                <Checkbox
                  checked={passedOnly}
                  onCheckedChange={v => setPassedOnly(!!v)}
                  className="h-3.5 w-3.5"
                />
                Passed only
              </label>
              <Button size="sm" variant="outline" onClick={onPromote} className="cursor-pointer h-8 ml-auto">
                <ArrowDownToLine className="w-3.5 h-3.5 mr-1" /> Promote
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-4">
          {loading ? (
            <p className="text-sm text-slate-400 italic">Loading roster…</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No active students in {group.className} for {yearName}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sticky top-0 bg-white">
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-2 w-12">Roll</th>
                  <th className="text-left py-2 pr-3">Name</th>
                  {group.subjects.map(s => (
                    <th key={s.id} className="text-center py-2 px-2 whitespace-nowrap">{s.name}</th>
                  ))}
                  <th className="text-right py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map(stu => {
                  const picks = enrolledByStudent.get(stu.id) ?? new Set<string>()
                  return (
                    <tr key={stu.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 pr-2 text-xs text-slate-500 font-mono">{stu.rollNumber ?? "—"}</td>
                      <td className="py-2 pr-3 max-w-[220px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={stu.fullName} url={stu.avatarUrl} size={24} />
                          <span className="font-medium text-sm truncate" title={stu.fullName}>
                            {stu.fullName}
                          </span>
                        </div>
                      </td>
                      {group.subjects.map(s => {
                        const checked = picks.has(s.id)
                        return (
                          <td key={s.id} className="py-2 px-2 text-center">
                            {group.kind === "OPTIONAL_PICK" && group.pickCount === 1 ? (
                              <input
                                type="radio"
                                name={`pick-${stu.id}`}
                                checked={checked}
                                onChange={() => onPick(stu.id, s.id)}
                                className="cursor-pointer accent-primary h-4 w-4"
                              />
                            ) : (
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => onPick(stu.id, s.id)}
                                className="h-4 w-4 cursor-pointer"
                              />
                            )}
                          </td>
                        )
                      })}
                      <td className="py-2 text-right">
                        {picks.size > 0 && (
                          <button
                            onClick={() => clearStudent(stu.id)}
                            className="text-[10px] text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                            title="Clear picks"
                          >
                            <X className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/60">
          <Button onClick={() => onOpenChange(false)} className="w-full cursor-pointer">Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
