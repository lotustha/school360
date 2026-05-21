"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, FolderTree, Globe2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { WorkingDaysPicker } from "@/components/ui/working-days-picker"
import { createFaculty, updateFaculty, setWorkingDays } from "@/actions/academics"
import { cn } from "@/lib/utils"

const schema = z.object({
  name: z.string().min(2, "Min 2 characters"),
})
type FormValues = z.infer<typeof schema>

interface EditItem {
  id:          string
  name:        string
  workingDays: number[]
}

interface Props {
  schoolId:           string
  schoolWorkingDays:  number[]
  editItem?:          EditItem
  /** When true, the drawer edits the school-wide General default — no faculty row is created/renamed. */
  generalMode?:       boolean
  open?:              boolean
  onOpenChange?:      (open: boolean) => void
}

export function FacultyDrawer({
  schoolId, schoolWorkingDays, editItem, generalMode = false,
  open: externalOpen, onOpenChange,
}: Props) {
  const isEditMode    = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEditMode ? (externalOpen ?? false) : localOpen
  const setOpen = isEditMode ? (onOpenChange ?? (() => {})) : setLocalOpen

  const [days, setDays] = useState<number[]>(editItem?.workingDays ?? [])

  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: editItem?.name ?? "" },
  })

  useEffect(() => {
    if (editItem) {
      form.reset({ name: editItem.name })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDays(editItem.workingDays)
    } else {
      setDays([])
    }
  }, [editItem, form])

  async function onSubmit(v: FormValues) {
    try {
      if (generalMode) {
        // Save school-wide working days; the General row reflects School.workingDays.
        await setWorkingDays(schoolId, days)
        toast.success("General working days saved")
      } else if (isEditMode && editItem) {
        await updateFaculty(editItem.id, v.name, days)
        toast.success(`Faculty "${v.name}" saved`)
      } else {
        await createFaculty(schoolId, v.name, days)
        toast.success(`Faculty "${v.name}" created`)
      }
      setOpen(false)
      form.reset()
      setDays([])
      router.refresh()
    } catch {
      toast.error(
        generalMode      ? "Failed to update General working days" :
        isEditMode       ? "Failed to update faculty" :
                           "Failed to create faculty"
      )
    }
  }

  // For generalMode, bypass form validation (name field is hidden)
  function onSubmitGeneral(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name: "General" })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Faculty
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
            generalMode ? "bg-slate-100" : "bg-violet-100",
          )}>
            {generalMode
              ? <Globe2 className="w-5 h-5 text-slate-500" />
              : <FolderTree className="w-5 h-5 text-violet-600" />}
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {generalMode  ? "General Working Days" :
               isEditMode   ? "Edit Faculty" :
                              "Add Faculty"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {generalMode
                ? "Set the school-wide default. Classes with no faculty assignment inherit these days."
                : isEditMode
                ? "Rename this academic stream or change its working days."
                : "Create an academic stream — e.g. Science, Management, Humanities."}
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          {generalMode ? (
            <form id="faculty-form" onSubmit={onSubmitGeneral} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Working Days
                </label>
                <WorkingDaysPicker
                  value={days}
                  onChange={setDays}
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Saved on the school. Faculties and classes inherit these unless they set an override.
                </p>
              </div>
            </form>
          ) : (
            <Form {...form}>
              <form id="faculty-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Faculty Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Science, Management, Humanities"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Working Days (override)
                  </label>
                  <WorkingDaysPicker
                    value={days}
                    onChange={setDays}
                    inheritedFrom={{ label: "school default", days: schoolWorkingDays }}
                  />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Classes under this faculty inherit these days unless they set their own override.
                  </p>
                </div>
              </form>
            </Form>
          )}
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="faculty-form" type="submit"
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (generalMode ? "Saving…" : isEditMode ? "Saving…" : "Creating…")
              : (generalMode ? "Save Working Days" : isEditMode ? "Save Changes" : "Create Faculty")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
