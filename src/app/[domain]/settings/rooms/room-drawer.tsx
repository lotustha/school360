"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Plus, DoorOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createRoom, updateRoom } from "@/actions/rooms"

const schema = z.object({
  name:  z.string().min(1, "Required").max(60, "Too long"),
  notes: z.string().max(200, "Too long").optional(),
})
type FormValues = z.infer<typeof schema>

interface EditItem { id: string; name: string; notes: string | null }

interface Props {
  schoolId:     string
  editItem?:    EditItem
  open?:        boolean
  onOpenChange?: (open: boolean) => void
}

export function RoomDrawer({ schoolId, editItem, open: externalOpen, onOpenChange }: Props) {
  const isEdit = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEdit ? (externalOpen ?? false) : localOpen
  const setOpen = isEdit ? (onOpenChange ?? (() => {})) : setLocalOpen
  const router  = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: editItem?.name ?? "", notes: editItem?.notes ?? "" },
  })

  useEffect(() => {
    if (editItem) form.reset({ name: editItem.name, notes: editItem.notes ?? "" })
    else          form.reset({ name: "", notes: "" })
  }, [editItem, form])

  async function onSubmit(v: FormValues) {
    try {
      if (isEdit && editItem) {
        await updateRoom(editItem.id, schoolId, { name: v.name, notes: v.notes ?? null })
        toast.success(`"${v.name}" saved`)
      } else {
        const { id } = await createRoom({ schoolId, name: v.name, notes: v.notes ?? null })
        toast.success(`"${v.name}" created — edit the seat layout next.`)
        setOpen(false)
        router.push(`/settings/rooms/${id}`)
        return
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Room
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DoorOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEdit ? "Rename Room" : "Add Room"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEdit
                ? "Rename or update notes. Seat layout is edited on the room's detail page."
                : "Create a physical room. You'll set the seat layout on the next screen."}
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          <Form {...form}>
            <form id="room-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Room Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Hall A, Room 204"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Notes (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ground floor, near library"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />
            </form>
          </Form>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="room-form" type="submit"
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (isEdit ? "Saving…" : "Creating…")
              : (isEdit ? "Save Changes" : "Create & Edit Layout")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
