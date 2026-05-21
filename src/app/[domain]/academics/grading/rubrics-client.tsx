"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardList, Plus, Sparkles, Trash2, Pencil, X, Save, GripVertical,
  Eye, ChevronDown, Layers, MessageSquare, BadgeCheck, ClipboardCheck,
} from "lucide-react"
import { RubricGradingSheet } from "./rubric-grading-sheet"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  seedRubricTemplates,
  createRubric,
  updateRubric,
  deleteRubric,
} from "@/actions/evaluation"
import type { Rubric, RubricCriterion, RubricType, RatingScale } from "../../../../../generated/prisma/client"

type RubricWithCriteria = Rubric & {
  criteria: RubricCriterion[]
  _count:   { evaluations: number }
}

// ─── Category styling ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; emoji: string }> = {
  FIELD_TRIP:        { label: "Field Trip",       bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200",  emoji: "🌳" },
  STORYTELLING:      { label: "Storytelling",     bg: "bg-violet-50",   text: "text-violet-700",   border: "border-violet-200",   emoji: "📖" },
  MODEL_MAKING:      { label: "Model Making",     bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",    emoji: "🛠️" },
  PRESENTATION:      { label: "Presentation",     bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",     emoji: "🎤" },
  PRACTICAL:         { label: "Practical",        bg: "bg-rose-50",     text: "text-rose-700",     border: "border-rose-200",     emoji: "🔬" },
  GROUP_DISCUSSION:  { label: "Group Discussion", bg: "bg-indigo-50",   text: "text-indigo-700",   border: "border-indigo-200",   emoji: "💬" },
  CUSTOM:            { label: "Custom",           bg: "bg-slate-50",    text: "text-slate-700",    border: "border-slate-200",    emoji: "✨" },
}

const CATEGORIES = ["FIELD_TRIP", "STORYTELLING", "MODEL_MAKING", "PRESENTATION", "PRACTICAL", "GROUP_DISCUSSION", "CUSTOM"]

interface Props {
  schoolId:       string
  userId:         string
  initialRubrics: RubricWithCriteria[]
}

export function RubricsClient({ schoolId, userId, initialRubrics }: Props) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const [editing,  setEditing]  = useState<RubricWithCriteria | null>(null)
  const [creating, setCreating] = useState(false)
  const [grading,  setGrading]  = useState<RubricWithCriteria | null>(null)
  const rubrics = initialRubrics

  const grouped = useMemo(() => {
    const m = new Map<string, RubricWithCriteria[]>()
    for (const cat of CATEGORIES) m.set(cat, [])
    for (const r of rubrics) {
      const k = r.category ?? "CUSTOM"
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return m
  }, [rubrics])

  function handleSeed() {
    startT(async () => {
      try {
        await seedRubricTemplates(schoolId)
        toast.success("CDC rubric templates seeded")
        router.refresh()
      } catch {
        toast.error("Failed to seed templates")
      }
    })
  }

  function handleDelete(id: string, name: string, evalCount: number) {
    const msg = evalCount > 0
      ? `Delete "${name}"? ${evalCount} existing evaluations will also be removed.`
      : `Delete rubric "${name}"?`
    if (!confirm(msg)) return
    startT(async () => {
      try {
        await deleteRubric(id)
        toast.success("Rubric deleted")
        router.refresh()
      } catch {
        toast.error("Failed to delete")
      }
    })
  }

  const hasTemplates = rubrics.some(r => r.isTemplate)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Rubric Templates</h2>
            <p className="text-sm text-muted-foreground">Pre-built and custom rubrics for grading projects, presentations, and practicals</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasTemplates && (
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={pending}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <Sparkles className="w-3.5 h-3.5" /> Seed CDC Templates
            </Button>
          )}
          <Button size="sm" onClick={() => setCreating(true)}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Plus className="w-3.5 h-3.5" /> New Rubric
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {rubrics.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No rubrics yet</p>
          <p className="text-xs text-muted-foreground mb-4">Seed the CDC-aligned rubric templates to get started</p>
          <Button size="sm" onClick={handleSeed} disabled={pending} className="gap-1.5 cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" /> Seed CDC Templates
          </Button>
        </div>
      )}

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const cards = grouped.get(cat) ?? []
        if (cards.length === 0) return null
        const cfg = CATEGORY_CONFIG[cat]
        return (
          <div key={cat} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{cfg.emoji}</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{cfg.label}</h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{cards.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map(r => (
                <RubricCard
                  key={r.id}
                  rubric={r}
                  onEdit={() => setEditing(r)}
                  onDelete={() => handleDelete(r.id, r.name, r._count.evaluations)}
                  onGrade={() => setGrading(r)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Builder — mount fresh per session to avoid state-stale across reopens */}
      {(editing !== null || creating) && (
        <RubricBuilder
          key={editing?.id ?? "new-rubric"}
          open={true}
          onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false) } }}
          schoolId={schoolId}
          rubric={editing}
          onSaved={() => { setEditing(null); setCreating(false); router.refresh() }}
        />
      )}

      {/* Grading sheet — mount fresh per session */}
      {grading !== null && (
        <RubricGradingSheet
          key={grading.id}
          open={true}
          onOpenChange={(o) => { if (!o) setGrading(null) }}
          schoolId={schoolId}
          rubric={grading}
          evaluatedById={userId}
        />
      )}
    </div>
  )
}

// ─── Rubric Card ─────────────────────────────────────────────────────────────

function RubricCard({
  rubric, onEdit, onDelete, onGrade,
}: {
  rubric:   RubricWithCriteria
  onEdit:   () => void
  onDelete: () => void
  onGrade:  () => void
}) {
  const cfg = CATEGORY_CONFIG[rubric.category ?? "CUSTOM"]
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-start gap-2.5">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0", cfg.bg)}>
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm truncate">{rubric.name}</p>
            {rubric.isTemplate && (
              <Badge variant="secondary" className="text-[9px] gap-0.5 font-bold px-1 py-0">
                <BadgeCheck className="w-2.5 h-2.5" /> Template
              </Badge>
            )}
          </div>
          {rubric.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{rubric.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className={cn("text-[10px] font-bold uppercase border", cfg.bg, cfg.text, cfg.border)}>{rubric.type}</Badge>
            <span className="text-[10px] font-bold text-slate-500">{rubric.totalMarks} marks</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[10px] text-slate-500">{rubric.criteria.length} criteria</span>
            {rubric._count.evaluations > 0 && (
              <>
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-emerald-600 font-medium">{rubric._count.evaluations} used</span>
              </>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/40">
          <div className="pt-2 space-y-1.5">
            {rubric.criteria.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}.</span>
                <span className="flex-1 text-slate-700">{c.name}</span>
                <span className="font-bold text-slate-600">{c.maxMarks}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-1 mt-auto">
        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}
          className="gap-1 cursor-pointer text-[11px] h-6 px-1.5">
          <Eye className="w-3 h-3" /> {expanded ? "Hide" : "Preview"}
          <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onGrade}
          className="gap-1 cursor-pointer text-[11px] h-6 px-1.5 text-primary hover:bg-primary/10">
          <ClipboardCheck className="w-3 h-3" /> Grade
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={onEdit}
            className="h-6 w-6 cursor-pointer">
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete}
            className="h-6 w-6 cursor-pointer text-rose-600 hover:bg-rose-50">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Builder Drawer ──────────────────────────────────────────────────────────

type DraftCriterion = { id?: string; name: string; description?: string; maxMarks: number }

function RubricBuilder({
  open, onOpenChange, schoolId, rubric, onSaved,
}: {
  open:         boolean
  onOpenChange: (open: boolean) => void
  schoolId:     string
  rubric:       RubricWithCriteria | null
  onSaved:      () => void
}) {
  const isEdit = rubric !== null

  const [name,         setName]         = useState(rubric?.name ?? "")
  const [description,  setDescription]  = useState(rubric?.description ?? "")
  const [type,         setType]         = useState<RubricType>((rubric?.type ?? "ANALYTICAL") as RubricType)
  const [scale,        setScale]        = useState<RatingScale>((rubric?.scale ?? "POINT_4") as RatingScale)
  const [category,     setCategory]     = useState<string>(rubric?.category ?? "CUSTOM")
  const [criteria,     setCriteria]     = useState<DraftCriterion[]>(
    rubric?.criteria.map(c => ({ id: c.id, name: c.name, description: c.description ?? undefined, maxMarks: c.maxMarks })) ?? [
      { name: "", maxMarks: 4 },
    ]
  )
  const [pending, startT] = useTransition()

  const totalMarks = criteria.reduce((s, c) => s + c.maxMarks, 0)

  function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (criteria.length === 0 || criteria.some(c => !c.name.trim())) {
      toast.error("All criteria need a name")
      return
    }
    startT(async () => {
      try {
        if (isEdit && rubric) {
          await updateRubric(rubric.id, {
            name, description, type, scale, category,
            criteria: criteria.map(c => ({ id: c.id, name: c.name, description: c.description, maxMarks: c.maxMarks })),
          })
          toast.success("Rubric updated")
        } else {
          await createRubric({
            schoolId, name, description, type, scale, category,
            criteria: criteria.map(c => ({ id: c.id, name: c.name, description: c.description, maxMarks: c.maxMarks })),
          })
          toast.success("Rubric created")
        }
        onSaved()
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  function moveUp(i: number)   { if (i === 0) return; const n = [...criteria]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCriteria(n) }
  function moveDown(i: number) { if (i === criteria.length - 1) return; const n = [...criteria]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; setCriteria(n) }

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Rubric" : "New Rubric"}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {type === "ANALYTICAL" ? "Multi-criterion scoring, summed for total" : "Single overall holistic rating"}
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Rubric editor</SheetDescription>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Field Trip Report, Storytelling, Science Project"
                className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="What this rubric evaluates and when teachers should use it"
                className="mt-1 text-sm bg-white border-slate-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type</label>
                <Select value={type} onValueChange={(v) => setType(v as RubricType)}>
                  <SelectTrigger className="h-9 text-xs mt-1 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANALYTICAL">Analytical</SelectItem>
                    <SelectItem value="HOLISTIC">Holistic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scale</label>
                <Select value={scale} onValueChange={(v) => setScale(v as RatingScale)}>
                  <SelectTrigger className="h-9 text-xs mt-1 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POINT_4">4-Point</SelectItem>
                    <SelectItem value="POINT_5">5-Point</SelectItem>
                    <SelectItem value="PERCENT">Percent</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-xs mt-1 cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Criteria */}
          <div className="bg-slate-50/40 border border-slate-200/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Criteria
                {type === "HOLISTIC" && <span className="text-[10px] font-normal text-slate-500 ml-1">(use one criterion for holistic)</span>}
              </p>
              <Badge className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                Total: {totalMarks} marks
              </Badge>
            </div>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" onClick={() => moveUp(i)}
                        className="h-4 w-4 cursor-pointer p-0">
                        <GripVertical className="w-3 h-3 rotate-90" />
                      </Button>
                      <span className="text-[9px] font-bold text-slate-400 text-center">{i + 1}</span>
                    </div>
                    <Input value={c.name} onChange={e => {
                      const next = [...criteria]; next[i] = { ...next[i], name: e.target.value }
                      setCriteria(next)
                    }}
                      placeholder="Criterion name (e.g. Accuracy, Presentation)"
                      className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg flex-1 font-medium" />
                    <Input type="number" min={0} step={0.5} value={c.maxMarks} onChange={e => {
                      const next = [...criteria]; next[i] = { ...next[i], maxMarks: Number(e.target.value) }
                      setCriteria(next)
                    }} className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg w-20 text-center font-semibold" />
                    <Button size="icon" variant="ghost" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
                      className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Textarea value={c.description ?? ""} onChange={e => {
                    const next = [...criteria]; next[i] = { ...next[i], description: e.target.value }
                    setCriteria(next)
                  }}
                    rows={1}
                    placeholder="What this criterion measures (optional)"
                    className="text-[11px] bg-white border-slate-200 rounded-lg resize-none" />
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setCriteria([...criteria, { name: "", maxMarks: 4 }])}
              className="gap-1.5 cursor-pointer text-xs h-8 w-full bg-white">
              <Plus className="w-3.5 h-3.5" /> Add Criterion
            </Button>
          </div>

          {/* Rating scale info */}
          {scale === "POINT_4" && (
            <div className="bg-violet-50/40 border border-violet-200/60 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-violet-900 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> 4-Point Scale (per criterion)
              </p>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div className="text-center bg-white rounded-lg p-1.5 border border-violet-100">
                  <div className="font-black text-violet-700">4</div>
                  <div className="text-slate-600">Outstanding</div>
                </div>
                <div className="text-center bg-white rounded-lg p-1.5 border border-violet-100">
                  <div className="font-black text-violet-700">3</div>
                  <div className="text-slate-600">Excellent</div>
                </div>
                <div className="text-center bg-white rounded-lg p-1.5 border border-violet-100">
                  <div className="font-black text-violet-700">2</div>
                  <div className="text-slate-600">Medium</div>
                </div>
                <div className="text-center bg-white rounded-lg p-1.5 border border-violet-100">
                  <div className="font-black text-violet-700">1</div>
                  <div className="text-slate-600">Low</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save Rubric"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
