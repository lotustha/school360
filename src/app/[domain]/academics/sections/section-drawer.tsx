"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSection, updateSection } from "@/actions/academics"

const schema = z.object({
  name:    z.string().min(1, "Section name required"),
  classId: z.string().min(1, "Select a class"),
})
type FormValues = z.infer<typeof schema>

interface EditItem { id: string; name: string; classId: string }

interface Props {
  schoolId:    string
  classes:     { id: string; name: string; facultyName: string | null }[]
  editItem?:   EditItem
  open?:       boolean
  onOpenChange?: (open: boolean) => void
}

export function SectionDrawer({ schoolId, classes, editItem, open: externalOpen, onOpenChange }: Props) {
  const isEditMode = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEditMode ? (externalOpen ?? false) : localOpen
  const setOpen = isEditMode ? (onOpenChange ?? (() => {})) : setLocalOpen

  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: editItem?.name ?? "", classId: editItem?.classId ?? "" },
  })

  useEffect(() => {
    if (editItem) form.reset({ name: editItem.name, classId: editItem.classId })
  }, [editItem, form])

  async function onSubmit(v: FormValues) {
    try {
      if (isEditMode && editItem) {
        await updateSection(editItem.id, v.name, v.classId)
        toast.success(`Section updated to "${v.name}"`)
      } else {
        await createSection(schoolId, v.classId, v.name)
        toast.success(`Section "${v.name}" created`)
      }
      setOpen(false)
      form.reset()
      router.refresh()
    } catch {
      toast.error(isEditMode ? "Failed to update section" : "Failed to create section")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Section
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEditMode ? "Edit Section" : "Add Section"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEditMode
                ? "Update the section name or reassign it to a different class."
                : "Create a section within a class to group students (e.g. A, B, Rose, Daisy)."}
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          <Form {...form}>
            <form id="section-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Class</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}{cls.facultyName ? ` — ${cls.facultyName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Section Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. A, B, Rose, Daisy"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="section-form" type="submit"
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (isEditMode ? "Saving…" : "Creating…")
              : (isEditMode ? "Save Changes" : "Create Section")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
