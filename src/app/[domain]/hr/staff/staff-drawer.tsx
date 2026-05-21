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
import { createEmployee } from "@/actions/hr"

const schema = z.object({
  fullName:     z.string().min(2, "Min 2 characters"),
  email:        z.string().email("Valid email required"),
  password:     z.string().min(6, "Min 6 characters"),
  role:         z.enum(["TEACHER", "STAFF", "SCHOOL_ADMIN"]),
  panNumber:    z.string().regex(/^\d{9}$/, "Must be 9 digits").or(z.literal("")),
  ssfNumber:    z.string().optional(),
  bankName:     z.string().optional(),
  bankAccount:  z.string().optional(),
  baseSalary:   z.string().optional(),
  tdsPercentage:z.string().optional(),
  ssfEnabled:   z.enum(["yes", "no"]).optional(),
})

type FormValues = z.infer<typeof schema>

export function StaffDrawer({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "", email: "", password: "", role: "TEACHER",
      panNumber: "", ssfNumber: "", bankName: "", bankAccount: "",
      ssfEnabled: "no",
    },
  })

  async function onSubmit(v: FormValues) {
    try {
      await createEmployee(schoolId, {
        fullName:     v.fullName,
        email:        v.email,
        password:     v.password,
        role:         v.role,
        panNumber:    v.panNumber || undefined,
        ssfNumber:    v.ssfNumber || undefined,
        bankName:     v.bankName  || undefined,
        bankAccount:  v.bankAccount || undefined,
        baseSalary:   v.baseSalary    ? Number(v.baseSalary)     : undefined,
        tdsPercentage:v.tdsPercentage ? Number(v.tdsPercentage)  : undefined,
        ssfEnabled:   v.ssfEnabled === "yes",
      })
      toast.success(`${v.fullName} added as ${v.role.toLowerCase()}`)
      setOpen(false)
      form.reset()
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      toast.error(msg.includes("Unique constraint") ? "Email already in use" : "Failed to add staff")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" /> Add Staff
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 px-7 pt-8 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 pt-0.5">
            <SheetTitle className="text-base font-bold text-slate-900">Add Staff Member</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              Creates a login account and employee record. Payroll details are optional.
            </SheetDescription>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Basic info */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basic Info</p>
              </div>

              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ram Bahadur Thapa"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="ram@school.edu.np"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min 6 chars"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl text-sm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="SCHOOL_ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              {/* HR details */}
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">HR Details (optional)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="panNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">PAN No.</FormLabel>
                    <FormControl>
                      <Input placeholder="9-digit PAN"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="ssfNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">SSF No.</FormLabel>
                    <FormControl>
                      <Input placeholder="SSF number"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="bankName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. NIC Asia Bank"
                      className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              {/* Payroll */}
              <div className="pt-2 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payroll (optional)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="baseSalary" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Base Salary (Rs.)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 35000"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="tdsPercentage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">TDS %</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 1"
                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="ssfEnabled" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">SSF Contribution</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl text-sm">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="no">Not enrolled</SelectItem>
                      <SelectItem value="yes">SSF enrolled</SelectItem>
                    </SelectContent>
                  </Select>
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
            {form.formState.isSubmitting ? "Adding…" : "Add Staff Member"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
