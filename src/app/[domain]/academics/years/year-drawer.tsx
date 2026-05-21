"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, CalendarRange, Save, Star, FolderTree } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { MultiSelectFilter } from "@/components/ui/multi-select-filter"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import {
  createAcademicYear, updateAcademicYear,
  getPreviousAcademicYear, copySubjectYearConfigs,
} from "@/actions/academic-years"

const NULL_FACULTY = "__NULL__"

// Edit-mode form: still a single facultyId per row
const editSchema = z.object({
  name:        z.string().min(1, "Required"),
  facultyId:   z.string().min(1, "Pick a scope"),
  startDateBS: z.string().min(6, "Start date required (YYYY-MM-DD)"),
  endDateBS:   z.string().min(6, "End date required (YYYY-MM-DD)"),
  isCurrent:   z.boolean().optional(),
})
type EditFormValues = z.infer<typeof editSchema>

// Add-mode form: multi-faculty scope; submit fans out to N rows
const createSchema = z.object({
  name:        z.string().min(1, "Required"),
  startDateBS: z.string().min(6, "Start date required (YYYY-MM-DD)"),
  endDateBS:   z.string().min(6, "End date required (YYYY-MM-DD)"),
  isCurrent:   z.boolean().optional(),
})
type CreateFormValues = z.infer<typeof createSchema>

interface FacultyOpt { id: string; name: string }

interface EditItem {
  id:          string
  name:        string
  facultyId:   string | null
  startDateBS: string
  endDateBS:   string
  isCurrent:   boolean
}

interface Props {
  schoolId:      string
  faculties:     FacultyOpt[]
  editItem?:     EditItem
  open?:         boolean
  onOpenChange?: (open: boolean) => void
}

export function YearDrawer({
  schoolId, faculties, editItem, open: externalOpen, onOpenChange,
}: Props) {
  const isEditMode = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEditMode ? (externalOpen ?? false) : localOpen
  const setOpen = isEditMode ? (onOpenChange ?? (() => {})) : setLocalOpen

  const router = useRouter()

  // ─── Edit-mode form ───────────────────────────────────────────────────────
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name:        editItem?.name           ?? "",
      facultyId:   editItem ? (editItem.facultyId ?? NULL_FACULTY) : NULL_FACULTY,
      startDateBS: editItem?.startDateBS    ?? "",
      endDateBS:   editItem?.endDateBS      ?? "",
      isCurrent:   editItem?.isCurrent      ?? false,
    },
  })

  // ─── Create-mode form ─────────────────────────────────────────────────────
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", startDateBS: "", endDateBS: "", isCurrent: false },
  })
  // Multi-faculty selection (only meaningful in create mode)
  const [scopeFacultyIds, setScopeFacultyIds] = useState<string[]>([])

  useEffect(() => {
    if (editItem) {
      editForm.reset({
        name:        editItem.name,
        facultyId:   editItem.facultyId ?? NULL_FACULTY,
        startDateBS: editItem.startDateBS,
        endDateBS:   editItem.endDateBS,
        isCurrent:   editItem.isCurrent,
      })
    } else {
      createForm.reset({ name: "", startDateBS: "", endDateBS: "", isCurrent: false })
      setScopeFacultyIds([])
    }
  }, [editItem, editForm, createForm])

  async function onSubmitEdit(v: EditFormValues) {
    if (!editItem) return
    try {
      const facultyId = v.facultyId === NULL_FACULTY ? null : v.facultyId
      await updateAcademicYear(editItem.id, {
        name:        v.name,
        startDateBS: v.startDateBS,
        endDateBS:   v.endDateBS,
        facultyId,
        isCurrent:   v.isCurrent ?? false,
      })
      toast.success(`"${v.name}" saved`)
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    }
  }

  /**
   * After creating one or more academic years, offer to copy subject configs
   * (isActive + CH split) from each new year's most recent prior peer. Uses
   * a single confirm prompt summarising all eligible copies — defaults to yes.
   * No-op when nothing to copy (e.g. first year for a faculty).
   */
  async function offerSubjectCopy(results: PromiseSettledResult<{ id: string }>[]) {
    const newYearIds = results
      .filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === "fulfilled")
      .map(r => r.value.id)
    if (newYearIds.length === 0) return

    const pairs = (await Promise.all(
      newYearIds.map(async id => {
        const prev = await getPreviousAcademicYear(id)
        return prev ? { newId: id, prevId: prev.id, prevName: prev.name } : null
      }),
    )).filter((p): p is { newId: string; prevId: string; prevName: string } => p !== null)
    if (pairs.length === 0) return

    const summary = pairs.length === 1
      ? `Copy subjects (active status + credit hour split) from "${pairs[0].prevName}" into the new year?`
      : `Copy subjects from previous years into ${pairs.length} new years?`
    if (!window.confirm(`${summary}\n\nClick OK to copy, Cancel to skip.`)) return

    const copyResults = await Promise.allSettled(
      pairs.map(p => copySubjectYearConfigs(p.prevId, p.newId)),
    )
    const totalCopied = copyResults
      .filter((r): r is PromiseFulfilledResult<{ copied: number; skipped: number }> => r.status === "fulfilled")
      .reduce((sum, r) => sum + r.value.copied, 0)
    if (totalCopied > 0) {
      toast.success(`Copied ${totalCopied} subject config${totalCopied === 1 ? "" : "s"}`)
      router.refresh()
    } else {
      toast.info("No subject configs to copy")
    }
  }

  async function onSubmitCreate(v: CreateFormValues) {
    if (scopeFacultyIds.length === 0) {
      toast.error("Pick at least one scope")
      return
    }
    const ids = scopeFacultyIds  // may include NULL_FACULTY sentinel
    const results = await Promise.allSettled(
      ids.map(id =>
        createAcademicYear({
          schoolId,
          name:        v.name,
          startDateBS: v.startDateBS,
          endDateBS:   v.endDateBS,
          facultyId:   id === NULL_FACULTY ? null : id,
          isCurrent:   v.isCurrent ?? false,
        }),
      ),
    )
    const ok     = results.filter(r => r.status === "fulfilled").length
    const failed = results.length - ok
    if (failed === 0) {
      toast.success(
        ok === 1 ? `"${v.name}" created`
                 : `Created ${ok} sessions named "${v.name}" across ${ok} scopes`,
      )
      setOpen(false)
      createForm.reset({ name: "", startDateBS: "", endDateBS: "", isCurrent: false })
      setScopeFacultyIds([])
      router.refresh()
      // Offer to copy subject configs from each new year's previous peer.
      await offerSubjectCopy(results)
    } else if (ok > 0) {
      const firstErr = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined
      toast.error(
        `Created ${ok}, failed ${failed}. First error: ${firstErr?.reason?.message ?? "unknown"}`,
      )
      router.refresh()
    } else {
      const firstErr = results[0] as PromiseRejectedResult
      toast.error(firstErr?.reason?.message ?? "Save failed")
    }
  }

  const isCurrent = isEditMode ? editForm.watch("isCurrent") : createForm.watch("isCurrent")

  const scopeOptions = [
    { id: NULL_FACULTY, label: "School-wide / General", secondary: "no faculty" },
    ...faculties.map(f => ({ id: f.id, label: f.name })),
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Session
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CalendarRange className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEditMode ? "Edit Session" : "Add Session"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEditMode
                ? "An academic session is owned by one faculty (or shared school-wide)."
                : "Pick one or more scopes — one session will be created for each selected scope, sharing the same name and dates."}
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          {isEditMode ? (
            <Form {...editForm}>
              <form id="year-form" onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-5">
                <FormField control={editForm.control} name="facultyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Scope
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                          <SelectValue placeholder="Pick a scope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NULL_FACULTY}>
                          School-wide / General
                          <span className="ml-2 text-[10px] text-slate-400">no faculty</span>
                        </SelectItem>
                        {faculties.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Session name</FormLabel>
                    <FormControl>
                      <Input placeholder="2082 or 2082/83"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={editForm.control} name="startDateBS" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Start (BS)</FormLabel>
                      <FormControl>
                        <NepaliDateInput value={field.value ?? ""} onChange={field.onChange} minYear={2070} maxYear={2095} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="endDateBS" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">End (BS)</FormLabel>
                      <FormControl>
                        <NepaliDateInput value={field.value ?? ""} onChange={field.onChange} minYear={2070} maxYear={2095} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>

                <CurrentToggle isCurrent={!!isCurrent} onToggle={() => editForm.setValue("isCurrent", !isCurrent)} />
              </form>
            </Form>
          ) : (
            <Form {...createForm}>
              <form id="year-form" onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Scope (one or more)</label>
                  <MultiSelectFilter
                    icon={<FolderTree className="w-3.5 h-3.5 text-amber-600" />}
                    label="Scope"
                    color="amber"
                    options={scopeOptions}
                    selected={scopeFacultyIds}
                    onChange={setScopeFacultyIds}
                    placeholder="Search scopes…"
                    emptyText="No faculties."
                    className="w-full"
                  />
                  <p className="text-[11px] text-slate-400">
                    One session row will be created per scope. Each faculty has its own independent
                    &quot;current&quot; flag.
                  </p>
                  {scopeFacultyIds.length === 0 && (
                    <p className="text-[11px] text-rose-500 font-semibold">Pick at least one scope.</p>
                  )}
                </div>

                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Session name</FormLabel>
                    <FormControl>
                      <Input placeholder="2082 or 2082/83"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm font-mono" {...field} />
                    </FormControl>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Use <code className="font-mono">2082</code> for BS single-year, <code className="font-mono">2082/83</code> for NEB / +2 spans.
                    </p>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={createForm.control} name="startDateBS" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Start (BS)</FormLabel>
                      <FormControl>
                        <NepaliDateInput value={field.value ?? ""} onChange={field.onChange} minYear={2070} maxYear={2095} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="endDateBS" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">End (BS)</FormLabel>
                      <FormControl>
                        <NepaliDateInput value={field.value ?? ""} onChange={field.onChange} minYear={2070} maxYear={2095} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>

                <CurrentToggle isCurrent={!!isCurrent} onToggle={() => createForm.setValue("isCurrent", !isCurrent)} />
              </form>
            </Form>
          )}
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="year-form" type="submit"
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={isEditMode ? editForm.formState.isSubmitting : createForm.formState.isSubmitting}>
            <Save className="w-4 h-4 mr-1.5" />
            {isEditMode
              ? (editForm.formState.isSubmitting ? "Saving…" : "Save Changes")
              : (createForm.formState.isSubmitting
                  ? (scopeFacultyIds.length > 1 ? `Creating ${scopeFacultyIds.length}…` : "Creating…")
                  : (scopeFacultyIds.length > 1 ? `Create ${scopeFacultyIds.length} Sessions` : "Create Session"))}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CurrentToggle({ isCurrent, onToggle }: { isCurrent: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle}
        className={cn(
          "w-full h-11 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2",
          isCurrent
            ? "bg-amber-50 border-amber-300 text-amber-700 shadow-sm shadow-amber-500/15"
            : "bg-white border-slate-200 text-slate-500 hover:border-amber-200",
        )}
      >
        <Star className={cn("w-4 h-4", isCurrent && "fill-amber-500 stroke-amber-500")} />
        {isCurrent ? "Current session for this scope" : "Mark as current session"}
      </button>
      {isCurrent && (
        <p className="text-[11px] text-amber-600 mt-1.5">
          Any other session marked current in the same scope will be demoted automatically.
        </p>
      )}
    </div>
  )
}
