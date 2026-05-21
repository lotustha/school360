"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, GraduationCap, User, DoorOpen } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WorkingDaysPicker } from "@/components/ui/working-days-picker"
import { createClass, updateClass } from "@/actions/academics"

const schema = z.object({
  name:           z.string().min(2, "Min 2 characters"),
  facultyId:      z.string().optional(),
  classTeacherId: z.string().optional(),
  roomId:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface EditItem {
  id:             string
  name:           string
  facultyId:      string | null
  classTeacherId: string | null
  roomId:         string | null
  classroom:      string | null     // legacy text (read-only fallback if no roomId)
  workingDays:    number[]
}

interface FacultyOpt {
  id:          string
  name:        string
  workingDays: number[]
}

interface RoomOpt {
  id:           string
  name:         string
  capacity:     number    // physical SEAT count — shown next to the name
  isActive:     boolean
}

interface Props {
  schoolId:           string
  schoolWorkingDays:  number[]
  faculties:          FacultyOpt[]
  teachers:           { id: string; fullName: string; role: string }[]
  rooms:              RoomOpt[]
  editItem?:          EditItem
  open?:              boolean
  onOpenChange?:      (open: boolean) => void
}

export function ClassDrawer({
  schoolId, schoolWorkingDays, faculties, teachers, rooms, editItem,
  open: externalOpen, onOpenChange,
}: Props) {
  const isEditMode = editItem !== undefined
  const [localOpen, setLocalOpen] = useState(false)
  const open    = isEditMode ? (externalOpen ?? false) : localOpen
  const setOpen = isEditMode ? (onOpenChange ?? (() => {})) : setLocalOpen

  const [workingDays, setWorkingDays] = useState<number[]>(editItem?.workingDays ?? [])

  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:           editItem?.name           ?? "",
      facultyId:      editItem?.facultyId      ?? "none",
      classTeacherId: editItem?.classTeacherId ?? "none",
      roomId:         editItem?.roomId         ?? "none",
    },
  })

  useEffect(() => {
    if (editItem) {
      form.reset({
        name:           editItem.name,
        facultyId:      editItem.facultyId      ?? "none",
        classTeacherId: editItem.classTeacherId ?? "none",
        roomId:         editItem.roomId         ?? "none",
      })
      setWorkingDays(editItem.workingDays)
    } else {
      setWorkingDays([])
    }
  }, [editItem, form])

  // Determine the inheritance source for working days display
  const watchedFacultyId = form.watch("facultyId")
  const inheritedFrom = (() => {
    if (watchedFacultyId && watchedFacultyId !== "none") {
      const f = faculties.find(fac => fac.id === watchedFacultyId)
      if (f && f.workingDays.length > 0) {
        return { label: `faculty (${f.name})`, days: f.workingDays }
      }
    }
    return { label: "school default", days: schoolWorkingDays }
  })()

  async function onSubmit(v: FormValues) {
    try {
      const fid  = v.facultyId      === "none" ? null : (v.facultyId      || null)
      const tid  = v.classTeacherId === "none" ? null : (v.classTeacherId || null)
      const rid  = v.roomId         === "none" ? null : (v.roomId         || null)
      if (isEditMode && editItem) {
        await updateClass(editItem.id, v.name, {
          facultyId: fid, classTeacherId: tid, roomId: rid, workingDays,
        })
        toast.success(`Class "${v.name}" saved`)
      } else {
        await createClass(schoolId, v.name, {
          facultyId: fid ?? undefined, classTeacherId: tid ?? undefined,
          roomId: rid ?? undefined, workingDays,
        })
        toast.success(`Class "${v.name}" created`)
      }
      setOpen(false)
      form.reset()
      setWorkingDays([])
      router.refresh()
    } catch {
      toast.error(isEditMode ? "Failed to update class" : "Failed to create class")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <SheetTrigger asChild>
          <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Add Class
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">
              {isEditMode ? "Edit Class" : "Add Class"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEditMode
                ? "Update the class name or faculty stream."
                : "Create a new class and optionally assign it to a faculty stream."}
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
                    <Input placeholder="e.g. Class 11, Grade 5"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="facultyId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Faculty / Stream <span className="normal-case font-normal text-slate-400">(optional)</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="classTeacherId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Class Teacher <span className="normal-case font-normal text-slate-400">(optional)</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                        <SelectValue placeholder="Assign a teacher" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none"><span className="text-muted-foreground italic">Unassigned</span></SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.fullName} <span className="text-[10px] text-slate-400 ml-1">{t.role}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="roomId" render={({ field }) => {
                const legacyText = editItem?.classroom?.trim() || null
                const isUnlinked = field.value === "none" || !field.value
                return (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <DoorOpen className="w-3 h-3" /> Room <span className="normal-case font-normal text-slate-400">(optional)</span>
                    </FormLabel>
                    {rooms.length === 0 ? (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-3 py-2.5 text-[11px] text-amber-700 leading-relaxed">
                        No rooms registered yet. Add one in{" "}
                        <Link href="/settings/rooms" className="underline font-semibold hover:text-amber-900">Settings → Rooms</Link>,
                        then come back and link it here.
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                        <FormControl>
                          <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl cursor-pointer text-sm">
                            <SelectValue placeholder="Select a room" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground italic">Unassigned</span>
                          </SelectItem>
                          {rooms.map(r => (
                            <SelectItem key={r.id} value={r.id} disabled={!r.isActive}>
                              {r.name}
                              <span className="ml-2 text-[10px] text-slate-400">
                                {r.capacity} seat{r.capacity === 1 ? "" : "s"}
                                {!r.isActive && " · disabled"}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isUnlinked && legacyText && (
                      <p className="text-[11px] text-slate-500 italic mt-1.5">
                        Legacy entry: <span className="font-mono">{legacyText}</span> — link a room above to upgrade this.
                      </p>
                    )}
                    <FormMessage className="text-xs" />
                  </FormItem>
                )
              }} />

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Working Days (override)
                </label>
                <WorkingDaysPicker
                  value={workingDays}
                  onChange={setWorkingDays}
                  inheritedFrom={inheritedFrom}
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Routine grids only show these days for this class.
                </p>
              </div>
            </form>
          </Form>
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60">
          <Button form="class-form" type="submit"
            className="w-full h-11 cursor-pointer shadow-lg shadow-primary/20 font-bold rounded-xl"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (isEditMode ? "Saving…" : "Creating…")
              : (isEditMode ? "Save Changes" : "Create Class")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
