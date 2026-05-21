"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardCheck, Search, Save, X, User, GraduationCap, Star,
  MessageSquare, Sparkles,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { saveRubricEvaluation, getRubricEvaluation } from "@/actions/evaluation"
import { getStudents } from "@/actions/students"
import { POINT_4_SCALE } from "@/lib/evaluation-frameworks"
import type { Rubric, RubricCriterion, RatingScale } from "../../../../../generated/prisma/client"

type RubricWithCriteria = Rubric & { criteria: RubricCriterion[] }

type StudentRow = {
  id:          string
  user:        { fullName: string }
  admissionNo: string
  class:       { name: string }
  section:     { name: string } | null
}

interface Props {
  open:           boolean
  onOpenChange:   (open: boolean) => void
  schoolId:       string
  rubric:         RubricWithCriteria | null
  evaluatedById:  string
}

export function RubricGradingSheet({ open, onOpenChange, schoolId, rubric, evaluatedById }: Props) {
  const router = useRouter()
  const [students,  setStudents]  = useState<StudentRow[]>([])
  const [search,    setSearch]    = useState("")
  const [selected,  setSelected]  = useState<StudentRow | null>(null)
  const [scores,    setScores]    = useState<Record<string, number>>({})
  const [comments,  setComments]  = useState("")
  const [pending,   startT]       = useTransition()
  const [loading,   setLoading]   = useState(false)

  // Load students when sheet opens
  useEffect(() => {
    if (!open || !rubric) return
    setLoading(true)
    getStudents(schoolId)
      .then(rows => setStudents(rows as unknown as StudentRow[]))
      .catch(() => toast.error("Failed to load students"))
      .finally(() => setLoading(false))
  }, [open, schoolId, rubric])

  // Reset state when sheet closes or rubric changes
  useEffect(() => {
    if (!open) {
      setSelected(null); setScores({}); setComments(""); setSearch("")
    }
  }, [open])

  // Load existing evaluation when student picked
  useEffect(() => {
    if (!selected || !rubric) return
    getRubricEvaluation({ rubricId: rubric.id, studentId: selected.id })
      .then(ev => {
        if (ev) {
          const next: Record<string, number> = {}
          for (const s of ev.scores) next[s.criterionId] = s.score
          setScores(next)
          setComments(ev.comments ?? "")
        } else {
          setScores({}); setComments("")
        }
      })
      .catch(() => {})
  }, [selected, rubric])

  const filtered = students.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return s.user.fullName.toLowerCase().includes(q)
        || s.admissionNo.toLowerCase().includes(q)
        || s.class.name.toLowerCase().includes(q)
  })

  if (!rubric) return null

  const totalScore = Object.values(scores).reduce((s, v) => s + (v || 0), 0)
  const allScored  = rubric.criteria.every(c => scores[c.id] !== undefined && scores[c.id] !== null)

  function handleSave() {
    if (!rubric)   { toast.error("Rubric missing"); return }
    if (!selected) { toast.error("Pick a student first"); return }
    if (!allScored) { toast.error("Score every criterion before saving"); return }
    const r = rubric
    startT(async () => {
      try {
        await saveRubricEvaluation({
          rubricId:      r.id,
          studentId:     selected.id,
          evaluatedById,
          comments:      comments || undefined,
          scores: r.criteria.map(c => ({ criterionId: c.id, score: scores[c.id] })),
        })
        toast.success(`Saved evaluation for ${selected.user.fullName}`)
        // Reset for next student
        setSelected(null); setScores({}); setComments("")
        router.refresh()
      } catch {
        toast.error("Failed to save evaluation")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">Grade: {rubric.name}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {rubric.criteria.length} criteria · {rubric.totalMarks} marks total
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Apply rubric to student</SheetDescription>
        </div>

        <div className="p-6 space-y-4">
          {!selected ? (
            <>
              {/* Student picker */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, admission no, or class"
                    className="h-10 pl-9 text-sm bg-white border-slate-200 rounded-xl" />
                </div>

                {loading ? (
                  <div className="text-center text-xs text-slate-400 py-10">Loading students…</div>
                ) : filtered.length === 0 ? (
                  <div className="bg-slate-50/60 border border-slate-200/60 rounded-xl p-8 text-center">
                    <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No students found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                    {filtered.map(s => (
                      <button key={s.id} onClick={() => setSelected(s)}
                        className="w-full text-left bg-white hover:bg-primary/5 border border-slate-200 hover:border-primary/30 rounded-lg px-3 py-2 flex items-center gap-3 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{s.user.fullName}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span className="font-mono">{s.admissionNo}</span>
                            <span className="text-slate-300">·</span>
                            <GraduationCap className="w-2.5 h-2.5" /> {s.class.name}
                            {s.section && <><span className="text-slate-300">·</span> {s.section.name}</>}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Selected student banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{selected.user.fullName}</p>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <span className="font-mono">{selected.admissionNo}</span>
                    <span className="text-slate-300">·</span>
                    <GraduationCap className="w-2.5 h-2.5" /> {selected.class.name}
                    {selected.section && <><span className="text-slate-300">·</span> {selected.section.name}</>}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}
                  className="text-xs h-7 cursor-pointer">
                  Change
                </Button>
              </div>

              {/* Criterion scoring grid */}
              <div className="space-y-2.5">
                {rubric.criteria.map((c) => (
                  <CriterionScorer
                    key={c.id}
                    criterion={c}
                    scale={rubric.scale}
                    value={scores[c.id]}
                    onChange={(v) => setScores(prev => ({ ...prev, [c.id]: v }))}
                  />
                ))}
              </div>

              {/* Comments */}
              <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Comments (optional)
                </label>
                <Textarea value={comments} onChange={e => setComments(e.target.value)}
                  rows={2}
                  placeholder="Constructive feedback or notes for the student"
                  className="text-xs bg-white border-amber-100 rounded-lg" />
              </div>

              {/* Total */}
              <div className="bg-primary text-white rounded-xl px-5 py-3 flex items-center justify-between shadow-md">
                <span className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Total Score
                </span>
                <span className="text-2xl font-black tabular-nums">
                  {totalScore.toFixed(1)} <span className="text-sm font-medium opacity-70">/ {rubric.totalMarks}</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Sticky footer */}
        {selected && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending || !allScored}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
              <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save Evaluation"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Criterion Scorer ────────────────────────────────────────────────────────

function CriterionScorer({
  criterion, scale, value, onChange,
}: {
  criterion: RubricCriterion
  scale:     RatingScale
  value:     number | undefined
  onChange:  (v: number) => void
}) {
  // 4-point scale → buttons; PERCENT/CUSTOM/POINT_5 → numeric input
  const usePointButtons = scale === "POINT_4"
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{criterion.name}</p>
          {criterion.description && (
            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{criterion.description}</p>
          )}
        </div>
        <Badge className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200 flex-shrink-0">
          max {criterion.maxMarks}
        </Badge>
      </div>

      {usePointButtons ? (
        <div className="grid grid-cols-4 gap-1.5">
          {POINT_4_SCALE.map(p => {
            // Scale the point value to fit the criterion's maxMarks (e.g., 4-point on 4-mark → identity; on 8-mark → ×2)
            const mark = (p.value / 4) * criterion.maxMarks
            const isActive = value !== undefined && Math.abs(value - mark) < 0.001
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(mark)}
                className={cn(
                  "rounded-lg border-2 px-2 py-2 text-center cursor-pointer transition-all",
                  isActive
                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <div className="flex items-center justify-center gap-0.5">
                  {Array.from({ length: p.value }).map((_, i) => (
                    <Star key={i} className={cn("w-2.5 h-2.5", isActive ? "fill-white text-white" : "fill-primary/40 text-primary/40")} />
                  ))}
                </div>
                <div className={cn("text-[10px] font-bold mt-0.5", isActive ? "text-white" : "text-slate-700")}>
                  {p.label}
                </div>
                <div className={cn("text-[10px] tabular-nums", isActive ? "text-white/80" : "text-slate-400")}>
                  {mark.toFixed(1)} mark{mark === 1 ? "" : "s"}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={criterion.maxMarks}
            step={0.5}
            value={value ?? ""}
            onChange={e => onChange(Math.min(criterion.maxMarks, Math.max(0, Number(e.target.value))))}
            placeholder={`0 – ${criterion.maxMarks}`}
            className="h-9 text-sm bg-white border-slate-200 rounded-lg w-32 text-center font-semibold"
          />
          <span className="text-xs text-slate-500">/ {criterion.maxMarks}</span>
        </div>
      )}
    </div>
  )
}
