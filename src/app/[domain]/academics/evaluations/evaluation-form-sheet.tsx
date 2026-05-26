"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardCheck, GraduationCap, Hash, Save, X, Layers, CalendarRange, BookOpen, Check, Eye,
} from "lucide-react"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { toBS, toAD } from "@/lib/nepali-date"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select"
import { createEvaluation, updateEvaluation } from "@/actions/evaluations"
import { EVALUATION_BANDS, EVALUATION_BAND_RECIPES, type BandKey, type BandRecipe } from "@/lib/evaluation-bands"
import { naturalCompare } from "@/lib/class-sort"
import { cn } from "@/lib/utils"

// Common evaluation names. Picking one also pre-fills sequence number and the
// final-result toggle so the form is fully usable after a single click.
// Users can still type any custom name — SearchableSelect's allowFreeText.
interface EvalNamePreset extends SearchableSelectOption {
  sequenceNumber: number
  isFinal:        boolean
}
const EVAL_NAME_PRESETS: EvalNamePreset[] = [
  { value: "First Terminal Examination",  label: "First Terminal Examination",  hint: "Seq 1 · Interim",  sequenceNumber: 1, isFinal: false },
  { value: "Second Terminal Examination", label: "Second Terminal Examination", hint: "Seq 2 · Interim",  sequenceNumber: 2, isFinal: false },
  { value: "Third Terminal Examination",  label: "Third Terminal Examination",  hint: "Seq 3 · Interim",  sequenceNumber: 3, isFinal: false },
  { value: "Pre-Board Examination",       label: "Pre-Board Examination",       hint: "Seq 4 · Mock",     sequenceNumber: 4, isFinal: false },
  { value: "Final Examination",           label: "Final Examination",           hint: "Seq 5 · Final",    sequenceNumber: 5, isFinal: true  },
]

type ClassOpt        = { id: string; name: string; facultyId: string | null }
type FacultyOpt      = { id: string; name: string }
type AcademicYearOpt = { id: string; name: string; isCurrent: boolean; facultyId: string | null }

export type EvaluationFormValue = {
  id:             string
  name:           string
  sequenceNumber: number
  description:    string | null
  classIds:       string[]      // existing class memberships (for edit mode)
  academicYearId: string
  facultyId:      string | null  // inferred from first class (for prefill)
  isFinal:        boolean
  publishAt:      Date | null
}

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  schoolId:      string
  faculties:     FacultyOpt[]
  classes:       ClassOpt[]
  academicYears: AcademicYearOpt[]
  editing:       EvaluationFormValue | null
  /** Pre-fill from the page's active global filter when creating a new evaluation. */
  defaultFacultyId?:      string | null
  defaultAcademicYearId?: string | null
}

const NONE_FACULTY = "__none__"

export function EvaluationFormSheet({
  open, onOpenChange, schoolId, faculties, classes, academicYears, editing,
  defaultFacultyId       = null,
  defaultAcademicYearId  = null,
}: Props) {
  const router = useRouter()
  const isEdit = editing !== null

  // Faculty: NONE_FACULTY for "General" (null facultyId). Otherwise a real id.
  // Priority: editing value → page filter default → first faculty in the list.
  const initialFaculty: string =
    editing
      ? (editing.facultyId === null ? NONE_FACULTY : editing.facultyId ?? NONE_FACULTY)
      : (defaultFacultyId === null ? NONE_FACULTY : defaultFacultyId ?? faculties[0]?.id ?? NONE_FACULTY)

  const initialYearId: string =
    editing?.academicYearId ?? defaultAcademicYearId ?? ""

  const [facultyKey,     setFacultyKey]     = useState(initialFaculty)
  const [academicYearId, setAcademicYearId] = useState(initialYearId)
  const [name,           setName]           = useState(editing?.name ?? "")
  const [seq,            setSeq]            = useState<string>(editing?.sequenceNumber?.toString() ?? "1")
  const [description,    setDescription]    = useState(editing?.description ?? "")
  // Initial band — best-effort inference from existing description text (helps edit mode).
  const initialBandKey: BandKey | null = editing?.description
    ? EVALUATION_BANDS.find(b => b.value === editing.description)?.key ?? null
    : null
  const [bandKey,        setBandKey]        = useState<BandKey | null>(initialBandKey)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(editing?.classIds ?? [])
  const [isFinal,        setIsFinal]        = useState(editing?.isFinal ?? false)
  // Default ON when creating — most users want subjects pre-seeded so the
  // evaluation is immediately gradable. They can untick it for a blank shell.
  const [autoSeed,       setAutoSeed]       = useState(!editing)
  // Publish date — stored as BS string in the form; converted back to AD on save.
  // Empty = draft (not yet published).
  const [publishBS, setPublishBS] = useState<string>(() => {
    if (!editing?.publishAt) return ""
    try { return toBS(editing.publishAt instanceof Date ? editing.publishAt : new Date(editing.publishAt)) }
    catch { return "" }
  })
  const [pending, startT] = useTransition()

  const facultyValue: string | null = facultyKey === NONE_FACULTY ? null : facultyKey

  // Years filtered by the picked faculty. Latest = isCurrent first, then descending name.
  const filteredYears = useMemo(() => {
    return academicYears.filter(y =>
      facultyValue === null ? y.facultyId === null
                            : y.facultyId === facultyValue || y.facultyId === null,
    )
  }, [academicYears, facultyValue])

  // When faculty changes, auto-pick the latest year of that faculty.
  // (Skipped on edit so user's stored choice is preserved.)
  useMaybeEffect(() => {
    if (isEdit) return
    const latest = filteredYears.find(y => y.isCurrent) ?? filteredYears[0]
    setAcademicYearId(latest?.id ?? "")
  }, [facultyKey, filteredYears, isEdit])

  // Classes filtered by faculty, sorted naturally so "Class 2" lands before
  // "Class 10" instead of after.
  const filteredClasses = useMemo(() => {
    return classes
      .filter(c => facultyValue === null ? c.facultyId === null : c.facultyId === facultyValue)
      .sort((a, b) => naturalCompare(a.name, b.name))
  }, [classes, facultyValue])

  function toggleClass(id: string) {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function selectAllClasses() {
    setSelectedClassIds(filteredClasses.map(c => c.id))
  }
  function clearClasses() {
    setSelectedClassIds([])
  }

  function applyBand(key: string) {
    // Picked band key — set both bandKey + description label.
    const band = EVALUATION_BANDS.find(b => b.key === (key as BandKey))
    if (!band) return
    setBandKey(band.key)
    setDescription(band.value)
    // The schema dictates which classes are covered — replace the selection
    // with the matching classes so picking "Grade 6 to 8" resets to just
    // grades 6–8, not adds to whatever was already ticked. CUSTOM has no
    // matcher and leaves the existing selection alone.
    if (band.matches) {
      const matched = filteredClasses.filter(c => band.matches!(c.name)).map(c => c.id)
      setSelectedClassIds(matched)
    }
  }

  function pickName(v: string) {
    setName(v)
    const preset = EVAL_NAME_PRESETS.find(p => p.value === v)
    if (preset) {
      setSeq(String(preset.sequenceNumber))
      setIsFinal(preset.isFinal)
    }
  }

  // Preview of what auto-seed will produce.
  const previewRecipe = useMemo(() => {
    if (!bandKey) return null
    const set = EVALUATION_BAND_RECIPES[bandKey]
    return isFinal ? set.final : set.interim
  }, [bandKey, isFinal])

  function handleSave() {
    if (!name.trim())                  { toast.error("Name is required");      return }
    if (!academicYearId)               { toast.error("Pick a session");        return }
    if (selectedClassIds.length === 0) { toast.error("Pick at least one class"); return }

    // Resolve the BS publish date back to an AD ISO string for the server.
    let publishAtIso: string | null = null
    if (publishBS.trim()) {
      try { publishAtIso = toAD(publishBS.trim()).toISOString() }
      catch { toast.error("Invalid publish date"); return }
    }

    startT(async () => {
      try {
        if (isEdit && editing) {
          await updateEvaluation(editing.id, {
            name,
            description:    description || null,
            sequenceNumber: parseInt(seq, 10) || 1,
            isFinal,
            classIds:       selectedClassIds,
            publishAt:      publishAtIso,
          })
          toast.success("Evaluation updated")
        } else {
          await createEvaluation({
            schoolId,
            classIds:       selectedClassIds,
            academicYearId,
            name,
            description:    description || undefined,
            sequenceNumber: parseInt(seq, 10) || 1,
            isFinal,
            autoSeedSubjects: autoSeed,
            bandKey:        bandKey ?? undefined,
            publishAt:      publishAtIso,
          })
          toast.success(autoSeed
            ? "Evaluation created with subjects seeded — open to add components"
            : "Evaluation created — open it to add subjects and components")
        }
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Evaluation" : "New Evaluation"}</div>
              <div className="text-xs text-muted-foreground font-normal">
                One evaluation schema can cover multiple classes (e.g. ECD–5, Grades 6–8)
              </div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Evaluation editor</SheetDescription>
        </div>

        <div className="p-6 space-y-5">
          {/* Faculty + Session */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Faculty" icon={<Layers className="w-3 h-3" />}>
              <Select value={facultyKey} onValueChange={setFacultyKey} disabled={isEdit}>
                <SelectTrigger className="h-9 text-sm cursor-pointer bg-white border-slate-200">
                  <SelectValue placeholder="Pick faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                  <SelectItem value={NONE_FACULTY}>General (no faculty)</SelectItem>
                </SelectContent>
              </Select>
              {isEdit && <p className="text-[10px] text-slate-400 mt-1">Faculty can&apos;t be changed once created.</p>}
            </Field>

            <Field label="Session" icon={<CalendarRange className="w-3 h-3" />}>
              <Select value={academicYearId} onValueChange={setAcademicYearId} disabled={isEdit}>
                <SelectTrigger className="h-9 text-sm cursor-pointer bg-white border-slate-200">
                  <SelectValue placeholder="Pick session" />
                </SelectTrigger>
                <SelectContent>
                  {filteredYears.length === 0
                    ? <div className="px-2 py-1.5 text-xs italic text-slate-400">No sessions for this faculty</div>
                    : filteredYears.map(y => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                          {y.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {isEdit && <p className="text-[10px] text-slate-400 mt-1">Session can&apos;t be changed once created.</p>}
            </Field>
          </div>

          {/* Name + sequence + isFinal */}
          <Field label="Evaluation name">
            <SearchableSelect
              value={name}
              onChange={pickName}
              options={EVAL_NAME_PRESETS}
              placeholder="Pick a preset or type your own…"
              searchPlaceholder="Search presets or type custom name…"
              emptyText="No preset matches — type to use as custom name."
              allowFreeText
              variant="plain"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Picking a preset auto-fills sequence number and the final-result toggle.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sequence" icon={<Hash className="w-3 h-3" />}>
              <Input
                type="number"
                min={1}
                max={20}
                value={seq}
                onChange={e => setSeq(e.target.value)}
                placeholder="1, 2, 3..."
                className="h-9 text-sm bg-white border-slate-200 rounded-lg text-center"
              />
            </Field>
            <Field label="Final result?">
              <div className="h-9 flex items-center gap-2 px-3 bg-white border border-slate-200 rounded-lg">
                <Switch checked={isFinal} onCheckedChange={setIsFinal} />
                <span className="text-xs text-slate-700">{isFinal ? "Yes — year-end result" : "No — interim"}</span>
              </div>
            </Field>
          </div>

          {/* Result publish date (BS) — printed on grade sheets */}
          <Field label="Result publish date (BS)" icon={<Eye className="w-3 h-3" />}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <NepaliDateInput value={publishBS} onChange={setPublishBS} />
              </div>
              {!publishBS && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPublishBS(toBS(new Date()))}
                  className="cursor-pointer text-xs h-9 whitespace-nowrap"
                  title="Stamp today as the publish date"
                >
                  Today
                </Button>
              )}
              {publishBS && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPublishBS("")}
                  className="cursor-pointer text-xs h-9 whitespace-nowrap text-rose-600 border-rose-200 hover:bg-rose-50"
                  title="Mark as draft (unpublished)"
                >
                  Unpublish
                </Button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {publishBS
                ? <>This date prints as <strong>&quot;Date of Publication&quot;</strong> on each student&apos;s grade sheet.</>
                : "Leave blank for a Draft. You can publish from the row toggle later."}
            </p>
          </Field>

          {/* Description: preset dropdown + override */}
          <Field label="Description (which schema?)">
            <Select
              value={bandKey ?? ""}
              onValueChange={applyBand}
            >
              <SelectTrigger className="h-9 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue placeholder="Pick a preset, or write your own below" />
              </SelectTrigger>
              <SelectContent>
                {EVALUATION_BANDS.map(b => (
                  <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. ECD to Grade 5 (Basic 1)"
              className="h-9 text-sm bg-white border-slate-200 rounded-lg mt-1.5"
            />
          </Field>

          {/* Classes multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Classes covered
                <span className="text-slate-500 normal-case font-semibold ml-1">
                  ({selectedClassIds.length} / {filteredClasses.length})
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllClasses}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  disabled={filteredClasses.length === 0}
                >Select all</button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={clearClasses}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                  disabled={selectedClassIds.length === 0}
                >Clear</button>
              </div>
            </div>
            {filteredClasses.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-xs italic text-slate-400">
                No classes in this faculty.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-1 grid grid-cols-2 md:grid-cols-3 gap-0.5 max-h-72 overflow-auto">
                {filteredClasses.map(c => {
                  const checked = selectedClassIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors",
                        checked ? "bg-primary/10 text-primary font-semibold" : "hover:bg-slate-100 text-slate-700",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleClass(c.id)}
                        className="cursor-pointer"
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Auto-seed subjects */}
          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                <Checkbox
                  checked={autoSeed}
                  onCheckedChange={(v) => setAutoSeed(v === true)}
                  className="cursor-pointer mt-0.5"
                  id="auto-seed"
                />
                <label htmlFor="auto-seed" className="text-xs text-slate-700 cursor-pointer flex-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    Auto-seed subject evaluations
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Create a SubjectEvaluation per subject in every selected class.
                    {previewRecipe
                      ? " Components are seeded from the preset below."
                      : " Components stay empty — configure them per subject afterwards."}
                  </p>
                </label>
              </div>

              {autoSeed && (
                <SeedPreviewCard
                  recipe={previewRecipe}
                  bandLabel={bandKey ? EVALUATION_BANDS.find(b => b.key === bandKey)?.label ?? null : null}
                  isFinal={isFinal}
                />
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1.5 cursor-pointer text-xs h-8"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8"
          >
            {pending ? <>Saving…</> : <><Save className="w-3.5 h-3.5" /> {isEdit ? "Save" : "Create"}</>}
            {!pending && autoSeed && !isEdit && <Check className="w-3.5 h-3.5 text-emerald-200" />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label, icon, children,
}: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1">
        {icon} {label}
      </label>
      {children}
    </div>
  )
}

function SeedPreviewCard({
  recipe, bandLabel, isFinal,
}: {
  recipe:    BandRecipe | null
  bandLabel: string | null
  isFinal:   boolean
}) {
  if (!recipe) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 italic">
        {bandLabel
          ? `${bandLabel} has no preset for ${isFinal ? "final" : "interim"} evaluations — empty subjects will be created.`
          : "No preset selected — empty subjects will be created."}
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
        <span className="uppercase tracking-wide">Will seed per subject</span>
        <span className="font-mono text-slate-600">
          Internal {recipe.internalMax} · External {recipe.externalMax}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {recipe.components.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-slate-50 border border-slate-100"
          >
            <span className={cn(
              "px-1.5 py-0 rounded-full text-[9px] font-bold",
              c.part === "INTERNAL" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700",
            )}>{c.part}</span>
            <span className="font-semibold text-slate-700 flex-1 truncate">{c.label}</span>
            <span className="font-mono text-slate-500">{c.maxMarks}</span>
            <span className={cn(
              "px-1.5 py-0 rounded text-[9px] font-bold",
              c.source === "MANUAL"             && "bg-slate-100 text-slate-600",
              c.source === "ATTENDANCE"         && "bg-emerald-50 text-emerald-700",
              c.source === "DERIVED_FROM_EXAM"  && "bg-amber-50 text-amber-700",
            )}>
              {c.source === "DERIVED_FROM_EXAM"
                ? c.examMatchHint
                  ? `LINK "${c.examMatchHint}"`
                  : "LINK by name"
                : c.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Skip-first-render effect so the initial editing state isn't clobbered.
function useMaybeEffect(fn: () => void, deps: React.DependencyList) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
