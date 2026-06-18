"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Search, UserMinus, Users, Layers, CheckCircle2, Trophy, X, UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  enrollStudents, enrollByClass, unenrollStudent, type EnrollmentRow,
} from "@/actions/lms/enrollment"

interface ClassOpt { id: string; name: string; sections: { id: string; name: string }[] }
interface EnrollableStudent {
  id: string; name: string; rollNumber: string | null
  classId: string; sectionId: string | null; className: string; sectionName: string | null
}

export function StudentsClient({
  courseId, courseTitle, enrollments, canManage, enrollable,
}: {
  courseId: string
  courseTitle: string
  enrollments: EnrollmentRow[]
  canManage: boolean
  enrollable: { classes: ClassOpt[]; students: EnrollableStudent[] }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<EnrollmentRow | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return enrollments
    return enrollments.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.rollNumber ?? "").toLowerCase().includes(q) ||
      e.className.toLowerCase().includes(q)
    )
  }, [enrollments, query])

  const completed = enrollments.filter(e => e.completedAt).length
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((n, e) => n + e.progress, 0) / enrollments.length)
    : 0

  function confirmRemove() {
    if (!removeTarget) return
    startTransition(async () => {
      try {
        await unenrollStudent(courseId, removeTarget.studentId)
        toast.success("Student unenrolled")
        setRemoveTarget(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not unenroll")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href={`/lms/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to course
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{courseTitle}</p>
        </div>
        {canManage && (
          <Button onClick={() => setEnrollOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Enroll students
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Enrolled"     value={`${enrollments.length}`} icon={Users}        tone="primary" />
        <Stat label="Completed"    value={`${completed}`}          icon={Trophy}       tone="emerald" />
        <Stat label="Avg progress" value={`${avgProgress}%`}       icon={CheckCircle2} tone="indigo"  />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, roll, class…" className="pl-9 bg-white/70" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <Users className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No students enrolled</p>
          <p className="text-xs text-slate-500 mt-1">Enroll students individually or a whole class.</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden divide-y divide-slate-50">
          {filtered.map(e => (
            <div key={e.enrollmentId} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {e.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{e.name}</p>
                <p className="text-[11px] text-slate-500">
                  {e.className}{e.sectionName ? ` · ${e.sectionName}` : ""}{e.rollNumber ? ` · Roll ${e.rollNumber}` : ""}
                </p>
              </div>
              <div className="w-32 hidden sm:block">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>{e.progress}%</span>
                  {e.completedAt && <span className="text-emerald-600 font-semibold">Done</span>}
                </div>
                <Progress value={e.progress} className="h-1.5" />
              </div>
              {canManage && (
                <button
                  onClick={() => setRemoveTarget(e)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  aria-label="Unenroll"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <EnrollDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          courseId={courseId}
          enrollable={enrollable}
          onDone={() => { setEnrollOpen(false); router.refresh() }}
        />
      )}

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onOpenChange={o => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Unenroll student?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{removeTarget?.name}</span> will lose access and their progress for this
            course will be cleared.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={isPending}>{isPending ? "Removing…" : "Unenroll"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EnrollDialog({
  open, onOpenChange, courseId, enrollable, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  courseId: string
  enrollable: { classes: ClassOpt[]; students: EnrollableStudent[] }
  onDone: () => void
}) {
  const [tab, setTab] = useState<"individual" | "class">("individual")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [classId, setClassId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [isPending, startTransition] = useTransition()

  const sections = enrollable.classes.find(c => c.id === classId)?.sections ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return enrollable.students
    return enrollable.students.filter(s =>
      s.name.toLowerCase().includes(q) || (s.rollNumber ?? "").toLowerCase().includes(q) || s.className.toLowerCase().includes(q)
    )
  }, [enrollable.students, query])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function submitIndividual() {
    if (selected.size === 0) { toast.error("Select at least one student"); return }
    startTransition(async () => {
      try {
        const res = await enrollStudents({ courseId, studentIds: [...selected] })
        toast.success(`Enrolled ${res.enrolled} student${res.enrolled === 1 ? "" : "s"}`)
        setSelected(new Set())
        onDone()
      } catch (e) {
        toast.error((e as Error).message || "Enrollment failed")
      }
    })
  }

  function submitClass() {
    if (!classId) { toast.error("Pick a class"); return }
    startTransition(async () => {
      try {
        const res = await enrollByClass({ courseId, classId, sectionId: sectionId || null })
        toast.success(`Enrolled ${res.enrolled} student${res.enrolled === 1 ? "" : "s"}`)
        onDone()
      } catch (e) {
        toast.error((e as Error).message || "Enrollment failed")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Enroll students</DialogTitle></DialogHeader>

        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 self-start">
          {(["individual", "class"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize",
                tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t === "individual" ? "Individual" : "By class"}
            </button>
          ))}
        </div>

        {tab === "individual" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students…" className="pl-9" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-3 py-4 text-center">No un-enrolled students match.</p>
              ) : filtered.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.className}{s.sectionName ? ` · ${s.sectionName}` : ""}{s.rollNumber ? ` · Roll ${s.rollNumber}` : ""}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{selected.size} selected</span>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
              <Button onClick={submitIndividual} disabled={isPending} className="gap-1.5">
                <UserPlus className="w-4 h-4" /> {isPending ? "Enrolling…" : `Enroll ${selected.size || ""}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Class</label>
              <SearchableSelect
                value={classId}
                onChange={v => { setClassId(v); setSectionId("") }}
                options={enrollable.classes.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Select class"
              />
            </div>
            {sections.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Section <span className="text-slate-400 font-normal">(optional — all if blank)</span></label>
                <SearchableSelect
                  value={sectionId}
                  onChange={setSectionId}
                  options={sections.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="All sections"
                />
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              All active students in the selected scope who aren&apos;t already enrolled will be added.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
              <Button onClick={submitClass} disabled={isPending} className="gap-1.5">
                <Layers className="w-4 h-4" /> {isPending ? "Enrolling…" : "Enroll class"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label, value, icon: Icon, tone,
}: {
  label: string; value: string; icon: React.ElementType; tone: "primary" | "emerald" | "indigo"
}) {
  const palette = {
    primary: { ring: "ring-primary/10",  icon: "text-primary bg-primary/8",      value: "text-primary" },
    emerald: { ring: "ring-emerald-100", icon: "text-emerald-600 bg-emerald-50", value: "text-emerald-700" },
    indigo:  { ring: "ring-indigo-100",  icon: "text-indigo-600 bg-indigo-50",   value: "text-indigo-700" },
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3.5 ring-1", palette.ring)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", palette.icon)}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className={cn("text-lg font-bold font-mono tabular-nums", palette.value)}>{value}</p>
    </div>
  )
}
