"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, FolderTree } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createFaculty } from "@/actions/academics"

const schema = z.object({
  name: z.string().min(2, "Min 2 characters"),
})

export function FacultyDrawer({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  async function onSubmit(v: z.infer<typeof schema>) {
    try {
      await createFaculty(schoolId, v.name)
      toast.success(`Faculty "${v.name}" created`)
      setOpen(false)
      form.reset()
      router.refresh()
    } catch {
      toast.error("Failed to create faculty")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Add Faculty
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <FolderTree className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Add Faculty</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create an academic stream — e.g. Science, Management, Humanities — for +2 or specialist branches.
            </SheetDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button onClick={form.handleSubmit(onSubmit)}
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating…" : "Create Faculty"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
