"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Users } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSection } from "@/actions/academics"

const schema = z.object({
  name:    z.string().min(1, "Section name required"),
  classId: z.string().min(1, "Select a class"),
})

interface Props {
  schoolId: string
  classes:  { id: string; name: string; facultyName: string | null }[]
}

export function SectionDrawer({ schoolId, classes }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", classId: "" },
  })

  async function onSubmit(v: z.infer<typeof schema>) {
    try {
      await createSection(schoolId, v.classId, v.name)
      toast.success(`Section "${v.name}" created`)
      setOpen(false)
      form.reset()
      router.refresh()
    } catch {
      toast.error("Failed to create section")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Add Section
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Add Section</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create a section within a class to group students (e.g. Section A, B, Rose, Daisy).
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
                  <p className="text-xs text-slate-400 mt-1.5">Short name to identify this student group.</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="section-form" type="submit" className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating…" : "Create Section"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
