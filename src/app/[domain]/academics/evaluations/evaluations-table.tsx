"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ClipboardCheck, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { updateEvaluation, deleteEvaluation } from "@/actions/evaluations"
import { getEvaluationColumns, type EvaluationRow } from "./evaluations-columns"
import { EvaluationFormSheet, type EvaluationFormValue } from "./evaluation-form-sheet"

interface Props {
  schoolId:      string
  evaluations:   EvaluationRow[]
  faculties:     { id: string; name: string }[]
  classes:       { id: string; name: string; facultyId: string | null }[]
  academicYears: { id: string; name: string; isCurrent: boolean; facultyId: string | null }[]
  /** Pre-fill the New Evaluation form from the page's global filter. */
  defaultFacultyId?:      string | null
  defaultAcademicYearId?: string | null
}

export function EvaluationsTable({
  schoolId, evaluations, faculties, classes, academicYears,
  defaultFacultyId       = null,
  defaultAcademicYearId  = null,
}: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editing,  setEditing]  = useState<EvaluationFormValue | null>(null)

  function handleDelete(row: EvaluationRow) {
    if (!confirm(`Delete "${row.name}"? All SubjectEvaluations and their components/marks cascade-delete.`)) return
    startT(async () => {
      try {
        await deleteEvaluation(row.id)
        toast.success("Evaluation deleted")
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  function handleToggleLock(row: EvaluationRow) {
    startT(async () => {
      try {
        await updateEvaluation(row.id, { isLocked: !row.isLocked })
        toast.success(row.isLocked ? "Evaluation unlocked" : "Evaluation locked")
        router.refresh()
      } catch { toast.error("Failed to toggle lock") }
    })
  }

  function handleTogglePublish(row: EvaluationRow) {
    const next = row.publishAt ? null : new Date().toISOString()
    startT(async () => {
      try {
        await updateEvaluation(row.id, { publishAt: next })
        toast.success(next ? "Results published" : "Results unpublished")
        router.refresh()
      } catch { toast.error("Failed to update publish state") }
    })
  }

  function handleEdit(row: EvaluationRow) {
    // Faculty inferred from the first class in the membership set.
    const firstClass = row.classes[0]
    const facultyId = firstClass
      ? classes.find(c => c.id === firstClass.id)?.facultyId ?? null
      : null
    setEditing({
      id:             row.id,
      name:           row.name,
      description:    row.description,
      sequenceNumber: row.sequenceNumber,
      classIds:       row.classes.map(c => c.id),
      academicYearId: row.academicYearId,
      facultyId,
      isFinal:        row.isFinal,
    })
  }

  const columns = useMemo(
    () => getEvaluationColumns({
      onEdit:          handleEdit,
      onDelete:        handleDelete,
      onToggleLock:    handleToggleLock,
      onTogglePublish: handleTogglePublish,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Badge variant="secondary" className="text-[10px] font-bold gap-1">
          <ClipboardCheck className="w-3 h-3" />
          {evaluations.length} {evaluations.length === 1 ? "evaluation" : "evaluations"}
        </Badge>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5" /> New Evaluation
        </Button>
      </div>

      {evaluations.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No evaluations match these filters</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            Try changing the filters above, or create the first evaluation for this faculty.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Evaluation
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={evaluations}
          searchKey="name"
          storageKey="evaluations-v2"
        />
      )}

      {(creating || editing !== null) && (
        <EvaluationFormSheet
          key={editing?.id ?? "new"}
          open={true}
          onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null) } }}
          schoolId={schoolId}
          faculties={faculties}
          classes={classes}
          academicYears={academicYears}
          editing={editing}
          defaultFacultyId={defaultFacultyId}
          defaultAcademicYearId={defaultAcademicYearId}
        />
      )}
    </div>
  )
}
