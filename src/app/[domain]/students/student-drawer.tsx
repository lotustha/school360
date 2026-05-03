"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { enrollStudent } from "@/actions/students"
import { GUARDIAN_RELATIONS, GENDER_OPTIONS, BLOOD_GROUPS } from "@/lib/nepal-data"
import { AddressFields, type AddressValue } from "@/components/ui/address-fields"

const schema = z.object({
  fullName:         z.string().min(2, "Full name required"),
  email:            z.string().email("Valid email required"),
  classId:          z.string().min(1, "Select a class"),
  sectionId:        z.string().optional(),
  dobBS:            z.string().min(6, "Date of birth required (YYYY-MM-DD in BS)"),
  gender:           z.string().min(1, "Select gender"),
  bloodGroup:       z.string().optional(),
  guardianName:     z.string().min(2, "Guardian name required"),
  guardianPhone:    z.string().min(7, "Guardian phone required"),
  guardianRelation: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  schoolId: string
  slug:     string
  classes:  { id: string; name: string; sections: { id: string; name: string }[] }[]
}

export function StudentDrawer({ schoolId, slug, classes }: Props) {
  const [open, setOpen]     = React.useState(false)
  const [classId, setClassId] = React.useState<string>("")
  const [address, setAddress] = React.useState<AddressValue>({
    province: "", district: "", municipality: "", wardNo: "", street: "",
  })
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { guardianRelation: "Father" },
  })

  const sections = classes.find(c => c.id === classId)?.sections ?? []

  async function onSubmit(values: FormValues) {
    const result = await enrollStudent(schoolId, slug, {
      ...values,
      province:     address.province,
      district:     address.district,
      municipality: address.municipality,
      wardNo:       address.wardNo,
      street:       address.street,
    })
    if (result.success) {
      toast.success(`Student enrolled — ${result.admissionNo}`)
      setOpen(false)
      form.reset()
      setAddress({ province: "", district: "", municipality: "", wardNo: "", street: "" })
      router.refresh()
    } else {
      toast.error(result.error ?? "Enrollment failed")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 cursor-pointer shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Enroll Student
        </Button>
      </SheetTrigger>

      <SheetContent className="glass-strong border-l border-white/25 dark:border-white/10 w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg font-bold">Enroll New Student</SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            Add a new student to the school records.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Personal */}
            <div className="space-y-1 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Personal Info</p>
            </div>

            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input placeholder="Student full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dobBS" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth (BS)</FormLabel>
                  <FormControl><Input placeholder="2068-01-15" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="bloodGroup" render={({ field }) => (
              <FormItem>
                <FormLabel>Blood Group</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Address */}
            <div className="pt-2 pb-1 border-t border-border/40" />
            <AddressFields value={address} onChange={setAddress} variant="plain" />

            {/* Academic */}
            <div className="space-y-1 pt-2 pb-2 border-t border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Academic</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); setClassId(v) }} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sectionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!sections.length}>
                    <FormControl><SelectTrigger className="cursor-pointer"><SelectValue placeholder={sections.length ? "Select" : "No sections"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Login */}
            <div className="space-y-1 pt-2 pb-2 border-t border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Login Account</p>
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="student@school.edu.np" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Guardian */}
            <div className="space-y-1 pt-2 pb-2 border-t border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary Guardian</p>
            </div>

            <FormField control={form.control} name="guardianName" render={({ field }) => (
              <FormItem>
                <FormLabel>Guardian Name</FormLabel>
                <FormControl><Input placeholder="Guardian full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="guardianPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="+977-..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="guardianRelation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {GUARDIAN_RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer shadow-lg shadow-primary/20"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Enrolling…" : "Enroll Student"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
