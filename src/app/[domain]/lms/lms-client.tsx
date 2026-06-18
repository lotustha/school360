"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus, Search, BookOpen, Users, Layers, GraduationCap, Pencil, Trash2, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { cn } from "@/lib/utils"
import {
  createCourse, updateCourse, deleteCourse,
  type CourseRow, type CourseStatus,
} from "@/actions/lms/courses"

interface Instructor { id: string; fullName: string; role: string }
interface SubjectOpt { id: string; name: string; className: string }

const STATUS_STYLE: Record<CourseStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DRAFT:     "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED:  "bg-slate-100 text-slate-500 border-slate-200",
}

const STATUS_FILTER = [
  { value: "ALL",       label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT",     label: "Drafts" },
  { value: "ARCHIVED",  label: "Archived" },
] as const

type FormState = {
  id?: string
  title: string
  description: string
  instructorId: string
  subjectId: string
  status: CourseStatus
}

const EMPTY_FORM: FormState = {
  title: "", description: "", instructorId: "", subjectId: "", status: "DRAFT",
}

export function LmsClient({
  courses, canManage, instructors, subjects,
}: {
  courses: CourseRow[]
  canManage: boolean
  instructors: Instructor[]
  subjects: SubjectOpt[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter(c => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q) ||
        (c.subjectName ?? "").toLowerCase().includes(q)
      )
    })
  }, [courses, query, statusFilter])

  function openCreate() {
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(c: CourseRow) {
    setForm({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      instructorId: c.instructorId,
      subjectId: c.subjectId ?? "",
      status: c.status,
    })
    setDialogOpen(true)
  }

  function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!form.instructorId) { toast.error("Pick an instructor"); return }

    startTransition(async () => {
      try {
        if (form.id) {
          await updateCourse({
            id: form.id,
            title: form.title,
            description: form.description || null,
            instructorId: form.instructorId,
            subjectId: form.subjectId || null,
            status: form.status,
          })
          toast.success("Course updated")
        } else {
          await createCourse({
            title: form.title,
            description: form.description || null,
            instructorId: form.instructorId,
            subjectId: form.subjectId || null,
            status: form.status,
          })
          toast.success("Course created")
        }
        setDialogOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Something went wrong")
      }
    })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      try {
        await deleteCourse(deleteTarget.id)
        toast.success("Course deleted")
        setDeleteTarget(null)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not delete course")
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search courses, instructors, subjects…"
            className="pl-9 bg-white/70"
          />
        </div>
        <div className="inline-flex rounded-lg bg-white/70 border border-white/40 p-0.5">
          {STATUS_FILTER.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                statusFilter === f.value ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> New course
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-12 text-center">
          <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No courses found</p>
          <p className="text-xs text-slate-500 mt-1">
            {courses.length === 0 ? "Create your first course to get started." : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              className="group bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <Link href={`/lms/courses/${c.id}`} className="block">
                <div className="h-28 bg-gradient-to-br from-primary/15 via-indigo-100 to-emerald-100 relative">
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-primary/40" />
                    </div>
                  )}
                  <span className={cn(
                    "absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                    STATUS_STYLE[c.status]
                  )}>
                    {c.status}
                  </span>
                </div>
              </Link>

              <div className="p-4 flex flex-col flex-1">
                <Link href={`/lms/courses/${c.id}`}>
                  <h3 className="font-bold text-sm text-slate-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {c.title}
                  </h3>
                </Link>
                <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> {c.instructorName}
                  {c.subjectName && <span className="text-slate-300">·</span>}
                  {c.subjectName && <span className="truncate">{c.subjectName}</span>}
                </p>

                <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {c.moduleCount} modules</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> {c.lessonCount} lessons</span>
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {c.enrollmentCount}</span>
                </div>

                <div className="mt-auto pt-3 flex items-center justify-between">
                  <Link
                    href={`/lms/courses/${c.id}`}
                    className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all"
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </Link>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Edit course"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        aria-label="Delete course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit course" : "New course"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Grade 9 Algebra — Term 1"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What learners will achieve in this course…"
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Instructor</Label>
                <SearchableSelect
                  value={form.instructorId}
                  onChange={v => setForm(f => ({ ...f, instructorId: v }))}
                  options={instructors.map(i => ({ value: i.id, label: i.fullName, hint: i.role }))}
                  placeholder="Select instructor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subject <span className="text-slate-400 font-normal">(optional)</span></Label>
                <SearchableSelect
                  value={form.subjectId}
                  onChange={v => setForm(f => ({ ...f, subjectId: v }))}
                  options={subjects.map(s => ({ value: s.id, label: s.name, hint: s.className }))}
                  placeholder="Link to a subject"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                {(["DRAFT", "PUBLISHED", "ARCHIVED"] as CourseStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                      form.status === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? "Saving…" : form.id ? "Save changes" : "Create course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete course?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{deleteTarget?.title}</span> and all its modules and lessons will be
            permanently removed. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
