"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Megaphone, AlertTriangle, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { createNotice } from "@/actions/notices"

const AUDIENCES = [
  { value: "ALL",      label: "Everyone" },
  { value: "STUDENTS", label: "Students" },
  { value: "STAFF",    label: "Staff" },
  { value: "PARENTS",  label: "Parents" },
] as const

const PRIORITIES = [
  { value: "NORMAL", label: "Normal", icon: Minus,         activeCls: "bg-slate-700 text-white border-slate-700" },
  { value: "HIGH",   label: "High",   icon: Megaphone,     activeCls: "bg-amber-500 text-white border-amber-500" },
  { value: "URGENT", label: "Urgent", icon: AlertTriangle, activeCls: "bg-rose-600 text-white border-rose-600" },
] as const

const formSchema = z.object({
  title:     z.string().min(1, "Title is required").max(200, "Max 200 characters"),
  body:      z.string().min(1, "Notice body is required").max(10_000, "Max 10,000 characters"),
  audience:  z.enum(["ALL", "STUDENTS", "STAFF", "PARENTS"]),
  priority:  z.enum(["NORMAL", "HIGH", "URGENT"]),
  expiresAt: z.string().optional(), // "YYYY-MM-DD" or ""
})

type FormValues = z.infer<typeof formSchema>

export function NoticeForm() {
  const router = useRouter()
  const [pending, start] = useTransition()

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", body: "", audience: "ALL", priority: "NORMAL", expiresAt: "" },
  })

  const audience = watch("audience")
  const priority = watch("priority")

  function onSubmit(values: FormValues) {
    start(async () => {
      try {
        await createNotice({
          title:     values.title,
          body:      values.body,
          audience:  values.audience,
          priority:  values.priority,
          expiresAt: values.expiresAt ? values.expiresAt : null,
        })
        toast.success("Notice published")
        router.push("/notices")
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" placeholder="e.g. School closed for Dashain holidays" {...register("title")} />
        {errors.title && <p className="text-[11px] font-bold text-rose-600">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          rows={7}
          placeholder="Write the full announcement here…"
          {...register("body")}
        />
        {errors.body && <p className="text-[11px] font-bold text-rose-600">{errors.body.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Audience</Label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => setValue("audience", a.value, { shouldValidate: true })}
              className={cn(
                "h-9 px-4 rounded-xl border text-xs font-bold cursor-pointer transition",
                audience === a.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white/75 border-slate-200 text-slate-500 hover:border-slate-300",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Who this notice is addressed to.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Priority</Label>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setValue("priority", p.value, { shouldValidate: true })}
              className={cn(
                "h-9 px-4 rounded-xl border text-xs font-bold cursor-pointer transition inline-flex items-center gap-1.5",
                priority === p.value
                  ? p.activeCls
                  : "bg-white/75 border-slate-200 text-slate-500 hover:border-slate-300",
              )}
            >
              <p.icon className="w-3.5 h-3.5" />{p.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Urgent notices are highlighted in red on the board and dashboard.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expiresAt">Expiry date (AD) — optional</Label>
        <Input id="expiresAt" type="date" className="max-w-[220px]" {...register("expiresAt")} />
        <p className="text-[10px] text-slate-400">
          The notice automatically disappears from the board after this date. Leave empty to keep it up indefinitely.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={() => router.push("/notices")} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="gap-1.5">
          <Megaphone className="w-3.5 h-3.5" />
          {pending ? "Publishing…" : "Publish Notice"}
        </Button>
      </div>
    </form>
  )
}
