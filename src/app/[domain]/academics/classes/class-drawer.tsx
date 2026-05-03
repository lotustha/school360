"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, GraduationCap } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClass } from "@/actions/academics"

const schema = z.object({
  name:      z.string().min(2, "Min 2 characters"),
  facultyId: z.string().optional(),
})

interface Props {
  schoolId:  string
  faculties: { id: string; name: string }[]
}

export function ClassDrawer({ schoolId, faculties }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", facultyId: "none" },
  })

  async function onSubmit(v: z.infer<typeof schema>) {
    try {
      await createClass(schoolId, v.name, v.facultyId === "none" ? undefined : v.facultyId)
      toast.success(`Class "${v.name}" created`)
      setOpen(false)
      form.reset()
      router.refresh()
    } catch {
      toast.error("Failed to create class")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Add Class
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Add Class</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create a new class (e.g. Class 1, Class 11) and optionally assign it to a faculty stream.
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          <Form {...form}>
            <form id="class-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Class Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Class 11, Grade 5" className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="facultyId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Faculty / Stream <span className="normal-case font-normal text-slate-400">(optional)</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                        <SelectValue placeholder="Select a faculty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">General — No Stream</SelectItem>
                      {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400 mt-1.5">Assign for +2 level streams like Science, Management.</p>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="class-form" type="submit" className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating…" : "Create Class"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
