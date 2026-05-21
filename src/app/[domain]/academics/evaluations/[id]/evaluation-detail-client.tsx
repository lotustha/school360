"use client"

import { useState, useTransition, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus, Settings2, BookOpen, Trash2, Save, X, Lock,
  Layers, ArrowUp, ArrowDown, Loader2, Check, Calculator, UsersRound, GripVertical,
  BookOpenCheck, AlertTriangle,
} from "lucide-react"
import {
  ManageDrawer, type ManageGroupData, type YearOpt,
} from "../../subjects/groups/manage-drawer"
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, arrayMove, horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  addSubjectToEvaluation, removeSubjectFromEvaluation, updateSubjectEvaluation,
  setEvaluationComponents, saveComponentMark, getComponentMarks,
  cloneSubjectEvaluationComponents, reorderSubjectEvaluations,
  type ComponentInput,
} from "@/actions/evaluations"
import { saveTerminalExamScore, getTerminalExamScores } from "@/actions/terminal-marks"
import { bulkComputeEvaluation, computeSubjectEvaluationResult } from "@/actions/evaluation-results"
import type { ComponentPart, ComponentSource } from "../../../../../../generated/prisma/client"

type ComponentRow = {
  id:             string
  part:           ComponentPart
  label:          string
  maxMarks:       number
  orderIndex:     number
  source:         ComponentSource
  sourceExamId:   string | null
  sourceExamName: string | null
  sourceMaxMarks: number | null
}

type SubjectEval = {
  id:          string
  subjectId:   string
  subjectName: string
  subjectCode: string
  internalMax: number
  externalMax: number
  components:  ComponentRow[]
}

type StudentRow = {
  id:          string   // Student.id
  userId:      string   // User.id (unused here but kept for parity)
  fullName:    string
  admissionNo: string
  rollNumber:  string | null
}

type CloneSource = {
  id:              string
  evaluationId:    string
  evaluationName:  string
  sequenceNumber:  number
  subjectName:     string
  subjectCode:     string
  className:       string
  componentsCount: number
  internalMax:     number
  externalMax:     number
}

interface Props {
  evaluationId:         string
  activeClassId:        string
  activeAcademicYearId: string
  isLocked:             boolean
  userId:               string
  classSubjects:      { id: string; name: string; code: string }[]
  exams:              { id: string; name: string }[]
  students:           StudentRow[]
  subjectEvaluations: SubjectEval[]
  cloneSources:       CloneSource[]
  /** subjectId → array of Student.id enrolled this year. REGULAR + ungrouped
   *  subjects get the full class roster; OPTIONAL/EXTRA in a group get only
   *  enrolled. Missing key = fall back to full roster. */
  enrolledIdsBySubject: Record<string, string[]>
  /** subjectId → SubjectGroup metadata when the subject lives in a group.
   *  Powers the inline "Manage enrollments" drawer per subject tab. */
  groupBySubject: Record<string, ManageGroupData>
  /** All academic years for the school (drives the year switcher inside ManageDrawer). */
  years: YearOpt[]
  /** Typo-detector thresholds, resolved server-side from school.gradingSettings. */
  outlierThresholds: {
    cellMaxPct:      number
    vsOwnAvgRatio:   number
    missingFillRate: number
  }
}

export function EvaluationDetailClient(props: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [activeTab, setActiveTab] = useState(props.subjectEvaluations[0]?.id ?? "")
  const [configuring, setConfiguring] = useState<SubjectEval | null>(null)
  const [addingSubject, setAddingSubject] = useState(false)
  const [managingGroup, setManagingGroup] = useState<ManageGroupData | null>(null)
  const [removingSubject, setRemovingSubject] = useState<SubjectEval | null>(null)

  // Local tab ordering. Initialized from server order; updated by drag-reorder
  // and persisted via reorderSubjectEvaluations. Re-syncs when the server-side
  // list changes (subject added/removed).
  const [tabOrder, setTabOrder] = useState<string[]>(
    () => props.subjectEvaluations.map(se => se.id),
  )
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTabOrder(props.subjectEvaluations.map(se => se.id))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [props.subjectEvaluations])

  const sortSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  // Hydration: render plain (non-DnD) tabs on SSR + first client paint, then
  // swap to the sortable version after mount. The DndContext / SortableContext
  // wrappers shift Radix's useId counter, which would otherwise produce
  // server/client ID mismatches on the Tabs primitives.
  const [tabsMounted, setTabsMounted] = useState(false)
  useEffect(() => { setTabsMounted(true) }, [])
  const subjectEvaluationsById = useMemo(
    () => new Map(props.subjectEvaluations.map(se => [se.id, se])),
    [props.subjectEvaluations],
  )
  const orderedSEs = tabOrder
    .map(id => subjectEvaluationsById.get(id))
    .filter((v): v is SubjectEval => !!v)

  function handleTabDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = tabOrder.indexOf(String(active.id))
    const newIndex = tabOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(tabOrder, oldIndex, newIndex)
    setTabOrder(next)   // optimistic
    reorderSubjectEvaluations(props.evaluationId, next).catch(err => {
      toast.error("Failed to save tab order")
      console.error("[tab-reorder]", err)
    })
  }

  const availableSubjects = props.classSubjects.filter(
    cs => !props.subjectEvaluations.some(se => se.subjectId === cs.id)
  )

  function handleAddSubject(subjectId: string) {
    startT(async () => {
      try {
        await addSubjectToEvaluation({ evaluationId: props.evaluationId, subjectId, internalMax: 50, externalMax: 0 })
        toast.success("Subject added — now configure its components")
        setAddingSubject(false)
        router.refresh()
      } catch {
        toast.error("Failed to add subject")
      }
    })
  }

  function handleRemoveSubject(se: SubjectEval) {
    setRemovingSubject(se)
  }

  function confirmRemoveSubject() {
    const se = removingSubject
    if (!se) return
    startT(async () => {
      try {
        await removeSubjectFromEvaluation(se.id)
        toast.success(`"${se.subjectName}" removed`)
        setRemovingSubject(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove")
      }
    })
  }

  function handleRecompute() {
    startT(async () => {
      try {
        const res = await bulkComputeEvaluation(props.evaluationId)
        toast.success(`Recomputed ${res.recomputed} result rows across ${res.subjects} subjects`)
        router.refresh()
      } catch {
        toast.error("Recompute failed")
      }
    })
  }

  if (props.subjectEvaluations.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No subjects added yet</p>
        <p className="text-xs text-muted-foreground mb-4">Add at least one subject to start configuring components.</p>
        {availableSubjects.length > 0 && (
          <div className="inline-block">
            <Select onValueChange={handleAddSubject}>
              <SelectTrigger className="h-9 text-xs cursor-pointer bg-primary text-white border-primary hover:bg-primary/90 gap-1.5 shadow-md shadow-primary/20">
                <Plus className="w-3.5 h-3.5" /> <SelectValue placeholder="Add Subject" />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {availableSubjects.length > 0 && (
          <Select onValueChange={handleAddSubject}>
            <SelectTrigger className="h-8 text-xs cursor-pointer bg-white border-slate-200 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> <SelectValue placeholder="Add Subject" />
            </SelectTrigger>
            <SelectContent>
              {availableSubjects.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/academics/evaluations/ledger?class=${props.activeClassId}&year=${props.activeAcademicYearId}`}
            className="inline-flex items-center gap-1.5 cursor-pointer text-xs h-8 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700"
            title="Open the class ledger for this class and session"
          >
            <BookOpenCheck className="w-3.5 h-3.5 text-emerald-600" /> Class Ledger
          </Link>
          <Button size="sm" onClick={handleRecompute} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Calculator className="w-3.5 h-3.5" /> Recompute Results
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
        {tabsMounted ? (
          <DndContext sensors={sortSensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
              <TabsList className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm h-auto p-1 rounded-xl flex-wrap justify-start">
                {orderedSEs.map(se => (
                  <SortableTab key={se.id} se={se} />
                ))}
              </TabsList>
            </SortableContext>
          </DndContext>
        ) : (
          <TabsList className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm h-auto p-1 rounded-xl flex-wrap justify-start">
            {orderedSEs.map(se => (
              <TabsTrigger key={se.id} value={se.id}
                className="gap-1.5 text-xs h-8 px-3 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg">
                <BookOpen className="w-3 h-3" /> {se.subjectName}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        {orderedSEs.map(se => {
          // Per-subject filter: if there's an enrollment set for this subject,
          // restrict the grid to those students. Missing key (REGULAR / no group)
          // falls back to the full roster — same as before.
          const enrolledIds = props.enrolledIdsBySubject[se.subjectId]
          const filteredStudents = enrolledIds
            ? props.students.filter(s => enrolledIds.includes(s.id))
            : props.students
          const group = props.groupBySubject[se.subjectId] ?? null
          return (
          <TabsContent key={se.id} value={se.id} className="mt-0 space-y-4">
            <SubjectPanel
              se={se}
              isLocked={props.isLocked}
              userId={props.userId}
              students={filteredStudents}
              totalClassStudents={props.students.length}
              exams={props.exams}
              group={group}
              outlierThresholds={props.outlierThresholds}
              onConfigure={() => setConfiguring(se)}
              onManageGroup={group ? () => setManagingGroup(group) : undefined}
              onRemove={() => handleRemoveSubject(se)}
            />
          </TabsContent>
        )})}
      </Tabs>

      {/* Component editor sheet */}
      {configuring && (
        <ComponentEditorSheet
          key={configuring.id}
          se={configuring}
          exams={props.exams}
          cloneSources={props.cloneSources.filter(s => s.id !== configuring.id)}
          onClose={() => { setConfiguring(null); router.refresh() }}
        />
      )}

      {/* Remove-subject confirmation */}
      <AlertDialog open={!!removingSubject} onOpenChange={(o) => { if (!o) setRemovingSubject(null) }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <AlertDialogTitle className="text-base">Remove subject from evaluation?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs leading-relaxed">
              You&apos;re about to remove <strong className="text-slate-800">{removingSubject?.subjectName}</strong> from this evaluation.
              <br /><br />
              <span className="inline-flex items-start gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 text-[11px] font-medium">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                All component marks, attendance overrides, and result rows for this subject in this evaluation will be deleted permanently.
              </span>
              <br /><br />
              Raw <em>TerminalExamScore</em> entries are kept — they live on the underlying exam, not this evaluation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSubject}
              disabled={pending}
              className="bg-rose-600 hover:bg-rose-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Yes, remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline enrollment manager — opens from a subject tab without leaving the page */}
      <ManageDrawer
        group={managingGroup}
        years={props.years}
        open={!!managingGroup}
        onOpenChange={(o) => {
          if (!o) {
            setManagingGroup(null)
            // Refresh so the per-subject filter + counts reflect new enrollments.
            router.refresh()
          }
        }}
      />

      {/* Add-subject placeholder kept to silence unused warnings if needed */}
      {addingSubject && <span className="hidden">add</span>}
    </div>
  )
}

// ─── Subject panel: header + marks grid ─────────────────────────────────────

type OutlierThresholds = {
  cellMaxPct:      number
  vsOwnAvgRatio:   number
  missingFillRate: number
}

// ─── Sortable subject tab ──────────────────────────────────────────────────

function SortableTab({ se }: { se: SubjectEval }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: se.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:   isDragging ? 0.6 : 1,
    zIndex:    isDragging ? 50 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch">
      <TabsTrigger
        value={se.id}
        className="gap-1.5 text-xs h-8 px-3 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg"
      >
        <span
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing -ml-1"
          title="Drag to reorder"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="w-3 h-3" />
        </span>
        <BookOpen className="w-3 h-3" /> {se.subjectName}
      </TabsTrigger>
    </div>
  )
}

function SubjectPanel({
  se, isLocked, userId, students, totalClassStudents, exams, group, outlierThresholds, onConfigure, onManageGroup, onRemove,
}: {
  se: SubjectEval
  isLocked:           boolean
  userId:             string
  students:           StudentRow[]
  totalClassStudents: number
  exams:              { id: string; name: string }[]
  group:              ManageGroupData | null
  outlierThresholds:  OutlierThresholds
  onConfigure:        () => void
  onManageGroup?:     () => void
  onRemove:           () => void
}) {
  const isFiltered = students.length < totalClassStudents
  const internalTotal = se.components.filter(c => c.part === "INTERNAL").reduce((s, c) => s + c.maxMarks, 0)
  const externalTotal = se.components.filter(c => c.part === "EXTERNAL").reduce((s, c) => s + c.maxMarks, 0)

  return (
    <div className="space-y-3">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200">
            Internal {internalTotal} / {se.internalMax}
          </Badge>
          <Badge className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
            External {externalTotal} / {se.externalMax}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-bold gap-1">
            <Layers className="w-2.5 h-2.5" /> {se.components.length} components
          </Badge>
          {isLocked && (
            <Badge className="text-[10px] font-bold gap-1 bg-rose-50 text-rose-700 border-rose-200">
              <Lock className="w-2.5 h-2.5" /> Read-only
            </Badge>
          )}
          {isFiltered && (
            <Badge className="text-[10px] font-bold gap-1 bg-violet-50 text-violet-700 border-violet-200">
              {students.length} of {totalClassStudents} enrolled
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onManageGroup && group && (
            <Button size="sm" variant="outline" onClick={onManageGroup}
              className="gap-1.5 cursor-pointer text-xs h-8 bg-white"
              title={`Edit student enrollment for ${group.label}`}>
              <UsersRound className="w-3.5 h-3.5" /> Manage enrollments
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onConfigure}
            className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
            <Settings2 className="w-3.5 h-3.5" /> Configure Components
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}
            className="gap-1.5 cursor-pointer text-xs h-8 text-rose-600 hover:bg-rose-50">
            <Trash2 className="w-3.5 h-3.5" /> Remove Subject
          </Button>
        </div>
      </div>

      {se.components.length === 0 ? (
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-6 text-center">
          <Layers className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="font-semibold text-sm text-amber-900 mb-1">No components configured</p>
          <p className="text-xs text-amber-700 mb-3">Click <strong>Configure Components</strong> above to define how marks are awarded.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-6 text-center text-xs text-blue-800">
          {totalClassStudents === 0
            ? "No active students in this class."
            : <>No students enrolled in this subject. Open <strong>Subjects → Groups</strong> to assign students.</>}
        </div>
      ) : (
        <MarksGrid se={se} students={students} isLocked={isLocked} userId={userId} exams={exams} outlierThresholds={outlierThresholds} />
      )}
    </div>
  )
}

// ─── Marks Grid: students × components, debounced autosave ──────────────────

type CellValue = { score: number | null; isAbsent: boolean }
type RowDraft = Record<string, CellValue>   // keyed by componentId
type GridState = Record<string, RowDraft>  // keyed by studentId (Student.id)

function MarksGrid({
  se, students, isLocked, userId, outlierThresholds,
}: {
  se:                SubjectEval
  students:          StudentRow[]
  isLocked:          boolean
  userId:            string
  exams:             { id: string; name: string }[]
  outlierThresholds: OutlierThresholds
}) {
  const [draft, setDraft] = useState<GridState>(() => {
    const init: GridState = {}
    for (const s of students) init[s.id] = {}
    return init
  })
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [savedKeys,  setSavedKeys]  = useState<Set<string>>(new Set())
  const saveTimers      = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const recomputeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [, startT] = useTransition()
  const [loading, setLoading] = useState(true)

  /**
   * Debounced per-row recompute. After a successful cell save, schedule a
   * `computeSubjectEvaluationResult` for that (student, subjectEvaluation) pair.
   * Multiple cell edits in the same row collapse to one recompute. Failure is
   * silent — the manual "Recompute Results" button stays as a force-refresh.
   */
  const scheduleRecompute = useCallback((studentId: string) => {
    const key = `${studentId}:${se.id}`
    const existing = recomputeTimers.current.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      recomputeTimers.current.delete(key)
      computeSubjectEvaluationResult({ subjectEvaluationId: se.id, studentId })
        .catch(err => console.error("[marks-grid] auto-recompute failed:", err))
    }, 2000)
    recomputeTimers.current.set(key, timer)
  }, [se.id])

  // Load existing marks: for each component, load EvaluationComponentMark or TerminalExamScore
  useEffect(() => {
    let cancelled = false
    async function load() {
      const next: GridState = {}
      for (const s of students) next[s.id] = {}

      for (const c of se.components) {
        if (c.source === "DERIVED_FROM_EXAM" && c.sourceExamId) {
          const map = await getTerminalExamScores({
            examId:    c.sourceExamId,
            classId:   "",   // not needed; we filter by subject
            subjectId: se.subjectId,
          })
          for (const s of students) {
            const r = map[s.id]
            if (r) next[s.id][c.id] = { score: r.rawScore, isAbsent: r.isAbsent }
          }
        } else {
          // MANUAL or ATTENDANCE
          const map = await getComponentMarks(c.id)
          for (const s of students) {
            const r = map[s.id]
            if (r) next[s.id][c.id] = { score: r.score, isAbsent: r.isAbsent }
          }
        }
      }

      if (!cancelled) {
        setDraft(next)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [se.components, se.subjectId, students])

  const saveCell = useCallback(async (studentId: string, c: ComponentRow, value: CellValue) => {
    const key = `${studentId}:${c.id}`
    setSavingKeys(prev => new Set(prev).add(key))
    try {
      if (c.source === "DERIVED_FROM_EXAM" && c.sourceExamId) {
        await saveTerminalExamScore({
          examId:      c.sourceExamId,
          studentId,
          subjectId:   se.subjectId,
          rawScore:    value.score,
          isAbsent:    value.isAbsent,
          enteredById: userId,
        })
      } else {
        await saveComponentMark({
          componentId: c.id,
          studentId,
          score:       value.score,
          isAbsent:    value.isAbsent,
          isOverride:  c.source === "ATTENDANCE",
        })
      }
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
      setSavedKeys(prev => new Set(prev).add(key))
      setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(key); return n }), 1500)
      scheduleRecompute(studentId)
    } catch (err) {
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
      const msg = err instanceof Error ? err.message : "Autosave failed"
      console.error("[marks-grid] autosave failed:", err)
      toast.error(`Autosave failed: ${msg}`)
    }
  }, [se.subjectId, userId, scheduleRecompute])

  function scheduleSave(studentId: string, c: ComponentRow, value: CellValue) {
    const key = `${studentId}:${c.id}`
    const existing = saveTimers.current.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      saveTimers.current.delete(key)
      startT(() => saveCell(studentId, c, value))
    }, 600)
    saveTimers.current.set(key, timer)
  }

  useEffect(() => () => {
    saveTimers.current.forEach(t => clearTimeout(t))
    saveTimers.current.clear()
    // Flush pending recomputes immediately on unmount so the ledger isn't stale
    // when the user navigates away mid-edit.
    recomputeTimers.current.forEach((t, key) => {
      clearTimeout(t)
      const [studentId, seId] = key.split(":")
      if (studentId && seId) {
        computeSubjectEvaluationResult({ subjectEvaluationId: seId, studentId })
          .catch(err => console.error("[marks-grid] unmount-flush recompute failed:", err))
      }
    })
    recomputeTimers.current.clear()
  }, [])

  function updateScore(studentId: string, c: ComponentRow, raw: string) {
    const num = raw === "" ? null : Number(raw)
    const cap = c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks ? c.sourceMaxMarks : c.maxMarks
    const clamped = num === null ? null : Math.min(cap, Math.max(0, num))
    setDraft(prev => {
      const row = { ...(prev[studentId] ?? {}) }
      const next = { ...(row[c.id] ?? { score: null, isAbsent: false }), score: clamped }
      row[c.id] = next
      const out = { ...prev, [studentId]: row }
      if (!isLocked) scheduleSave(studentId, c, next)
      return out
    })
  }

  function toggleAbsent(studentId: string, c: ComponentRow, v: boolean) {
    setDraft(prev => {
      const row = { ...(prev[studentId] ?? {}) }
      const cur = row[c.id] ?? { score: null, isAbsent: false }
      const next = { ...cur, isAbsent: v }
      row[c.id] = next
      const out = { ...prev, [studentId]: row }
      if (!isLocked) scheduleSave(studentId, c, next)
      return out
    })
  }

  /**
   * Typo / missing-entry detector. Computed per render from the live `draft`
   * state. Two flag kinds:
   *   MISSING — cell empty (not absent) when ≥missingFillRate of the class has scored it.
   *   OUTLIER — cell% < cellMaxPct AND cell% < vsOwnAvgRatio × student's avg of OTHER components.
   * Tunable in school.gradingSettings; strict defaults.
   */
  const flags = useMemo(() => {
    const out = new Map<string, { kind: "MISSING" | "OUTLIER"; reason: string }>()
    if (students.length === 0 || se.components.length === 0) return out

    const capFor = (c: ComponentRow): number =>
      c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks ? c.sourceMaxMarks : c.maxMarks

    const cellPct = (studentId: string, c: ComponentRow): number | null => {
      const d = draft[studentId]?.[c.id]
      if (!d || d.isAbsent || d.score == null) return null
      const cap = capFor(c)
      return cap > 0 ? (d.score / cap) * 100 : null
    }

    // Per-component fill count (absent counts as "filled").
    const filledByComponent = new Map<string, number>()
    for (const c of se.components) {
      let n = 0
      for (const s of students) {
        const d = draft[s.id]?.[c.id]
        if (d && (d.isAbsent || d.score != null)) n++
      }
      filledByComponent.set(c.id, n)
    }

    for (const s of students) {
      // Average % across all components this student has a score for.
      const pcts: number[] = []
      for (const c of se.components) {
        const p = cellPct(s.id, c)
        if (p != null) pcts.push(p)
      }

      for (const c of se.components) {
        const key = `${s.id}:${c.id}`
        const d = draft[s.id]?.[c.id]
        const filled = !!d && (d.isAbsent || d.score != null)

        // MISSING — empty cell when most peers have scored
        if (!filled) {
          const fillRate = (filledByComponent.get(c.id) ?? 0) / students.length
          if (fillRate >= outlierThresholds.missingFillRate) {
            out.set(key, {
              kind:   "MISSING",
              reason: `${Math.round(fillRate * 100)}% of class has scored. Did you skip this student?`,
            })
          }
          continue
        }

        // OUTLIER — needs cell% below threshold AND below ratio×own-other-avg
        const cellP = cellPct(s.id, c)
        if (cellP == null || cellP >= outlierThresholds.cellMaxPct) continue
        const others = pcts.filter(p => p !== cellP) // good-enough proxy; ties rare in practice
        if (others.length === 0) continue
        const otherAvg = others.reduce((a, b) => a + b, 0) / others.length
        if (cellP < otherAvg * outlierThresholds.vsOwnAvgRatio) {
          out.set(key, {
            kind:   "OUTLIER",
            reason: `${cellP.toFixed(0)}% on this component vs ${otherAvg.toFixed(0)}% on others. Possible typo?`,
          })
        }
      }
    }
    return out
  }, [students, se.components, draft, outlierThresholds])

  function rowTotal(studentId: string): { obtained: number; full: number } {
    let obtained = 0, full = 0
    for (const c of se.components) {
      full += c.maxMarks
      const cell = draft[studentId]?.[c.id]
      if (!cell || cell.isAbsent) continue
      if (cell.score == null) continue
      if (c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks && c.sourceMaxMarks > 0) {
        obtained += (cell.score / c.sourceMaxMarks) * c.maxMarks
      } else {
        obtained += cell.score
      }
    }
    return { obtained: Math.round(obtained * 100) / 100, full }
  }

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center text-xs text-slate-400">
        <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" /> Loading existing marks…
      </div>
    )
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
      <table className="min-w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 bg-slate-100/95 backdrop-blur-xl text-left px-3 py-2.5 border-b border-slate-200 z-30 min-w-[200px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student</span>
            </th>
            {se.components.map(c => (
              <th key={c.id} className={cn(
                "sticky top-0 z-20 text-center px-2 py-2.5 border-b border-slate-200 min-w-[110px] backdrop-blur-xl",
                c.part === "EXTERNAL" ? "bg-emerald-50/95" : "bg-slate-100/95",
              )}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 leading-tight">{c.label}</span>
                  <span className="text-[9px] text-slate-400">
                    {c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks
                      ? <>raw /{c.sourceMaxMarks} → {c.maxMarks}</>
                      : <>/ {c.maxMarks}</>}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-widest">
                    {c.source === "DERIVED_FROM_EXAM" ? <span className="text-violet-600">{c.sourceExamName ?? "Exam"}</span> :
                     c.source === "ATTENDANCE"        ? <span className="text-emerald-600">AUTO</span> :
                                                       <span className="text-slate-400">MANUAL</span>}
                  </span>
                </div>
              </th>
            ))}
            <th className="sticky top-0 z-20 text-center px-2 py-2.5 border-b border-slate-200 min-w-[90px] bg-primary/10 backdrop-blur-xl">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const tot = rowTotal(s.id)
            return (
              <tr key={s.id} className="hover:bg-primary/5 transition-colors">
                <td className="sticky left-0 bg-white/95 hover:bg-primary/5 backdrop-blur-xl px-3 py-2 border-b border-slate-100 z-10">
                  <div>
                    <p className="font-semibold text-xs truncate">{s.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {s.rollNumber && <span>#{s.rollNumber} · </span>}
                      {s.admissionNo}
                    </p>
                  </div>
                </td>
                {se.components.map(c => {
                  const cell = draft[s.id]?.[c.id] ?? { score: null, isAbsent: false }
                  const key = `${s.id}:${c.id}`
                  const cap = c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks ? c.sourceMaxMarks : c.maxMarks
                  const scaled = c.source === "DERIVED_FROM_EXAM" && c.sourceMaxMarks && cell.score != null
                    ? ((cell.score / c.sourceMaxMarks) * c.maxMarks).toFixed(1)
                    : null
                  const flag = flags.get(key)
                  return (
                    <td key={c.id} className={cn(
                      "px-1.5 py-1.5 border-b border-slate-100 relative",
                      c.part === "EXTERNAL" && "bg-emerald-50/40"
                    )}
                    title={flag?.reason}>
                      <div className="flex flex-col items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={cap}
                          step={0.25}
                          value={cell.score ?? ""}
                          onChange={e => updateScore(s.id, c, e.target.value)}
                          disabled={cell.isAbsent || isLocked}
                          readOnly={isLocked}
                          placeholder="—"
                          className={cn(
                            "h-7 text-center text-xs bg-white border-slate-200 rounded-md font-semibold tabular-nums w-[80px]",
                            isLocked && "bg-slate-50 cursor-default",
                            flag?.kind === "OUTLIER" && "border-amber-400 bg-amber-50 ring-2 ring-amber-200",
                            flag?.kind === "MISSING" && "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200",
                          )}
                        />
                        {scaled && <span className="text-[9px] text-violet-600 font-bold">→ {scaled}/{c.maxMarks}</span>}
                        <div className="flex items-center gap-1">
                          <Checkbox checked={cell.isAbsent} onCheckedChange={(v) => toggleAbsent(s.id, c, !!v)}
                            disabled={isLocked} className="cursor-pointer h-3 w-3" />
                          <span className="text-[9px] text-slate-400">Abs</span>
                          {savingKeys.has(key) && <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />}
                          {savedKeys.has(key) && !savingKeys.has(key) && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                        </div>
                      </div>
                    </td>
                  )
                })}
                <td className="px-1.5 py-1.5 border-b border-slate-100 bg-primary/5 text-center">
                  <div className="font-black text-sm tabular-nums text-primary">{tot.obtained.toFixed(1)}</div>
                  <div className="text-[9px] text-slate-400">/ {tot.full}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Component Editor Sheet ─────────────────────────────────────────────────

function ComponentEditorSheet({
  se, exams, cloneSources, onClose,
}: {
  se:           SubjectEval
  exams:        { id: string; name: string }[]
  cloneSources: CloneSource[]
  onClose:      () => void
}) {
  const router = useRouter()
  const [internalMax, setInternalMax] = useState(se.internalMax.toString())
  const [externalMax, setExternalMax] = useState(se.externalMax.toString())
  const [components,  setComponents]  = useState<ComponentInput[]>(
    se.components.map(c => ({
      id:             c.id,
      part:           c.part,
      label:          c.label,
      maxMarks:       c.maxMarks,
      orderIndex:     c.orderIndex,
      source:         c.source,
      sourceExamId:   c.sourceExamId,
      sourceMaxMarks: c.sourceMaxMarks,
    }))
  )
  const [pending, startT] = useTransition()
  const [pickedSource, setPickedSource] = useState<string>("")

  function handleClone(mode: "REPLACE" | "APPEND") {
    if (!pickedSource) { toast.error("Pick a source SubjectEvaluation first"); return }
    const src = cloneSources.find(s => s.id === pickedSource)
    if (!src) return
    const verb = mode === "REPLACE" ? "Replace" : "Append to"
    const ok = confirm(`${verb} current components with ${src.componentsCount} from ${src.className} → ${src.subjectName} → ${src.evaluationName}?`)
    if (!ok) return
    startT(async () => {
      try {
        const res = await cloneSubjectEvaluationComponents({
          fromSubjectEvaluationId: pickedSource,
          toSubjectEvaluationId:   se.id,
          mode,
        })
        toast.success(`Copied ${res.copied} components (${res.mode})`)
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Copy failed")
      }
    })
  }

  function addRow(part: ComponentPart) {
    const partRows = components.filter(c => c.part === part)
    setComponents([...components, {
      part,
      label:    "",
      maxMarks: 0,
      orderIndex: partRows.length,
      source:   "MANUAL",
    }])
  }

  function removeRow(i: number) {
    setComponents(components.filter((_, j) => j !== i))
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= components.length) return
    if (components[i].part !== components[j].part) return
    const next = [...components]
    ;[next[i], next[j]] = [next[j], next[i]]
    setComponents(next)
  }

  function updateRow(i: number, patch: Partial<ComponentInput>) {
    const next = [...components]
    next[i] = { ...next[i], ...patch }
    setComponents(next)
  }

  function handleSave() {
    if (components.some(c => !c.label.trim())) {
      toast.error("Every component needs a label")
      return
    }
    if (components.some(c => c.source === "DERIVED_FROM_EXAM" && (!c.sourceExamId || !c.sourceMaxMarks || c.sourceMaxMarks <= 0))) {
      toast.error("DERIVED rows need a source exam and sourceMaxMarks > 0")
      return
    }
    startT(async () => {
      try {
        await updateSubjectEvaluation(se.id, {
          internalMax: parseFloat(internalMax) || 0,
          externalMax: parseFloat(externalMax) || 0,
        })
        await setEvaluationComponents({
          subjectEvaluationId: se.id,
          components: components.map((c, idx) => ({ ...c, orderIndex: idx })),
        })
        toast.success("Components saved")
        onClose()
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  const internalRows = components.map((c, i) => ({ c, i })).filter(({ c }) => c.part === "INTERNAL")
  const externalRows = components.map((c, i) => ({ c, i })).filter(({ c }) => c.part === "EXTERNAL")
  const internalTotal = internalRows.reduce((s, { c }) => s + c.maxMarks, 0)
  const externalTotal = externalRows.reduce((s, { c }) => s + c.maxMarks, 0)
  const intCap = parseFloat(internalMax) || 0
  const extCap = parseFloat(externalMax) || 0

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">Configure: {se.subjectName}</div>
              <div className="text-xs text-muted-foreground font-normal">Internal + External components</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Configure components</SheetDescription>
        </div>

        <div className="p-6 space-y-5">
          {/* Copy-from picker */}
          {cloneSources.length > 0 && (
            <div className="bg-violet-50/40 border border-violet-200/60 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-semibold text-violet-900 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Copy components from another SubjectEvaluation
              </p>
              <div className="flex items-center gap-2">
                <Select value={pickedSource} onValueChange={setPickedSource}>
                  <SelectTrigger className="h-8 text-xs cursor-pointer bg-white border-slate-200 flex-1">
                    <SelectValue placeholder="Pick a source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {cloneSources.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.className} · {s.subjectName} · {s.evaluationName}
                        <span className="text-[10px] text-slate-400 ml-1.5">({s.componentsCount} comp · I:{s.internalMax}/E:{s.externalMax})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => handleClone("APPEND")}
                  disabled={pending || !pickedSource}
                  className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
                  Append
                </Button>
                <Button size="sm" onClick={() => handleClone("REPLACE")}
                  disabled={pending || !pickedSource}
                  className="gap-1.5 cursor-pointer text-xs h-8 shadow-md shadow-primary/20">
                  Replace
                </Button>
              </div>
              <p className="text-[10px] text-violet-700">
                <strong>Replace</strong> wipes current components and copies caps too. <strong>Append</strong> adds onto the end without touching caps.
              </p>
            </div>
          )}

          {/* Caps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Max</label>
              <Input type="number" min={0} value={internalMax} onChange={e => setInternalMax(e.target.value)}
                className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg text-center font-semibold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">External Max</label>
              <Input type="number" min={0} value={externalMax} onChange={e => setExternalMax(e.target.value)}
                className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg text-center font-semibold" />
            </div>
          </div>

          {/* Internal components */}
          <ComponentList
            title="Internal Components"
            color="blue"
            total={internalTotal}
            cap={intCap}
            rows={internalRows}
            exams={exams}
            onAdd={() => addRow("INTERNAL")}
            onRemove={removeRow}
            onMove={moveRow}
            onUpdate={updateRow}
          />

          {/* External components */}
          <ComponentList
            title="External Components"
            color="emerald"
            total={externalTotal}
            cap={extCap}
            rows={externalRows}
            exams={exams}
            onAdd={() => addRow("EXTERNAL")}
            onRemove={removeRow}
            onMove={moveRow}
            onUpdate={updateRow}
          />
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

function ComponentList({
  title, color, total, cap, rows, exams, onAdd, onRemove, onMove, onUpdate,
}: {
  title:   string
  color:   "blue" | "emerald"
  total:   number
  cap:     number
  rows:    { c: ComponentInput; i: number }[]
  exams:   { id: string; name: string }[]
  onAdd:    () => void
  onRemove: (i: number) => void
  onMove:   (i: number, dir: -1 | 1) => void
  onUpdate: (i: number, patch: Partial<ComponentInput>) => void
}) {
  const bg = color === "blue" ? "bg-blue-50/40 border-blue-200/60" : "bg-emerald-50/40 border-emerald-200/60"
  const ok = cap > 0 ? total === cap : true
  return (
    <div className={cn("border rounded-xl p-4 space-y-3", bg)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> {title}
        </p>
        <Badge className={cn("text-[10px] font-bold", ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {total} {cap > 0 ? `/ ${cap}` : ""}
        </Badge>
      </div>
      <div className="space-y-2">
        {rows.map(({ c, i }, idx) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => onMove(i, -1)} className="text-slate-400 hover:text-slate-700 cursor-pointer" disabled={idx === 0}>
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => onMove(i, 1)}  className="text-slate-400 hover:text-slate-700 cursor-pointer" disabled={idx === rows.length - 1}>
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <Input value={c.label} onChange={e => onUpdate(i, { label: e.target.value })}
                placeholder="Label (e.g. Attendance, Project, Term 1)"
                className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg flex-1 font-medium" />
              <Input type="number" min={0} step={0.5} value={c.maxMarks}
                onChange={e => onUpdate(i, { maxMarks: parseFloat(e.target.value) || 0 })}
                placeholder="Max"
                className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg w-20 text-center font-semibold" />
              <Button size="icon" variant="ghost" onClick={() => onRemove(i)}
                className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 pl-7">
              <Select value={c.source} onValueChange={(v) => onUpdate(i, { source: v as ComponentSource })}>
                <SelectTrigger className="h-7 text-[11px] cursor-pointer w-44 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual entry</SelectItem>
                  <SelectItem value="ATTENDANCE">Attendance (auto)</SelectItem>
                  <SelectItem value="DERIVED_FROM_EXAM">Derived from Terminal Exam</SelectItem>
                </SelectContent>
              </Select>
              {c.source === "DERIVED_FROM_EXAM" && (
                <>
                  <Select value={c.sourceExamId ?? ""} onValueChange={(v) => onUpdate(i, { sourceExamId: v })}>
                    <SelectTrigger className="h-7 text-[11px] cursor-pointer w-44 bg-white">
                      <SelectValue placeholder="Terminal Exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} step={0.5} value={c.sourceMaxMarks ?? ""}
                    onChange={e => onUpdate(i, { sourceMaxMarks: parseFloat(e.target.value) || 0 })}
                    placeholder="Source max"
                    className="h-7 text-[11px] bg-white border-slate-200 rounded-lg w-20 text-center" />
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">scaled → {c.maxMarks}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={onAdd}
        className="gap-1.5 cursor-pointer text-xs h-8 w-full bg-white">
        <Plus className="w-3.5 h-3.5" /> Add Component
      </Button>
    </div>
  )
}
