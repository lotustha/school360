"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff,
  Video, FileText, Presentation, Link2, Type, Code, BookOpen,
  GraduationCap, Users, Layers, ClipboardList, ListChecks, Radio, MessagesSquare, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getCourse, setCourseStatus, type CourseStatus } from "@/actions/lms/courses"
import {
  createModule, updateModule, deleteModule, toggleModulePublished, moveModule,
} from "@/actions/lms/modules"
import {
  createLesson, updateLesson, deleteLesson, toggleLessonPublished, moveLesson,
  type LessonType,
} from "@/actions/lms/lessons"

type Course = Awaited<ReturnType<typeof getCourse>>
type Module = Course["modules"][number]
type Lesson = Module["lessons"][number]

const STATUS_STYLE: Record<CourseStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DRAFT:     "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED:  "bg-slate-100 text-slate-500 border-slate-200",
}

const LESSON_META: Record<LessonType, { icon: React.ElementType; label: string }> = {
  VIDEO:  { icon: Video,        label: "Video" },
  PDF:    { icon: FileText,     label: "PDF" },
  SLIDES: { icon: Presentation, label: "Slides" },
  LINK:   { icon: Link2,        label: "Link" },
  TEXT:   { icon: Type,         label: "Text" },
  EMBED:  { icon: Code,         label: "Embed" },
}

const LESSON_TYPES = Object.keys(LESSON_META) as LessonType[]

export function CourseBuilder({ course, canManage }: { course: Course; canManage: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Module dialog state
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; id?: string; title: string; description: string }>({
    open: false, title: "", description: "",
  })
  // Lesson dialog state
  const [lessonDialog, setLessonDialog] = useState<LessonFormState>({ open: false, ...EMPTY_LESSON })
  // Delete confirm
  const [del, setDel] = useState<{ kind: "module" | "lesson"; id: string; name: string } | null>(null)

  function run(fn: () => Promise<unknown>, okMsg?: string) {
    startTransition(async () => {
      try {
        await fn()
        if (okMsg) toast.success(okMsg)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Something went wrong")
      }
    })
  }

  // ── Module handlers ──
  function openCreateModule() {
    setModuleDialog({ open: true, title: "", description: "" })
  }
  function openEditModule(m: Module) {
    setModuleDialog({ open: true, id: m.id, title: m.title, description: m.description ?? "" })
  }
  function submitModule() {
    if (!moduleDialog.title.trim()) { toast.error("Module title is required"); return }
    run(async () => {
      if (moduleDialog.id) {
        await updateModule({ id: moduleDialog.id, title: moduleDialog.title, description: moduleDialog.description || null })
      } else {
        await createModule({ courseId: course.id, title: moduleDialog.title, description: moduleDialog.description || null })
      }
      setModuleDialog(d => ({ ...d, open: false }))
    }, moduleDialog.id ? "Module updated" : "Module added")
  }

  // ── Lesson handlers ──
  function openCreateLesson(moduleId: string) {
    setLessonDialog({ open: true, ...EMPTY_LESSON, moduleId })
  }
  function openEditLesson(l: Lesson) {
    setLessonDialog({
      open: true, id: l.id, moduleId: l.moduleId,
      title: l.title, type: l.type as LessonType,
      content: l.content ?? "", fileUrl: l.fileUrl ?? "",
      videoUrl: l.videoUrl ?? "", videoDuration: l.videoDuration?.toString() ?? "",
      isFree: l.isFree,
    })
  }
  function submitLesson() {
    if (!lessonDialog.title.trim()) { toast.error("Lesson title is required"); return }
    const dur = lessonDialog.videoDuration ? parseInt(lessonDialog.videoDuration, 10) : null
    run(async () => {
      if (lessonDialog.id) {
        await updateLesson({
          id: lessonDialog.id,
          title: lessonDialog.title, type: lessonDialog.type,
          content: lessonDialog.content || null,
          fileUrl: lessonDialog.fileUrl || null,
          videoUrl: lessonDialog.videoUrl || null,
          videoDuration: Number.isFinite(dur as number) ? dur : null,
          isFree: lessonDialog.isFree,
        })
      } else {
        await createLesson({
          moduleId: lessonDialog.moduleId!,
          title: lessonDialog.title, type: lessonDialog.type,
          content: lessonDialog.content || null,
          fileUrl: lessonDialog.fileUrl || null,
          videoUrl: lessonDialog.videoUrl || null,
          videoDuration: Number.isFinite(dur as number) ? dur : null,
          isFree: lessonDialog.isFree,
        })
      }
      setLessonDialog(d => ({ ...d, open: false }))
    }, lessonDialog.id ? "Lesson updated" : "Lesson added")
  }

  function confirmDelete() {
    if (!del) return
    run(async () => {
      if (del.kind === "module") await deleteModule(del.id)
      else await deleteLesson(del.id)
      setDel(null)
    }, `${del.kind === "module" ? "Module" : "Lesson"} deleted`)
  }

  const lessonTotal = course.modules.reduce((n, m) => n + m.lessons.length, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/lms" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to courses
      </Link>

      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary/15 via-indigo-100 to-emerald-100 relative">
          {course.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">{course.title}</h1>
              <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {course.instructor.fullName}</span>
                {course.subject && <><span className="text-slate-300">·</span><span>{course.subject.name}</span></>}
              </p>
              {course.description && <p className="text-sm text-slate-600 mt-2 max-w-2xl">{course.description}</p>}
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border self-start",
              STATUS_STYLE[course.status as CourseStatus]
            )}>
              {course.status}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {course.modules.length} modules</span>
            <span className="inline-flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {lessonTotal} lessons</span>
            <Link href={`/lms/courses/${course.id}/students`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <Users className="w-3.5 h-3.5" /> {course._count.enrollments} enrolled
            </Link>
            <Link href={`/lms/courses/${course.id}/assignments`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <ClipboardList className="w-3.5 h-3.5" /> Assignments
            </Link>
            <Link href={`/lms/courses/${course.id}/quizzes`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <ListChecks className="w-3.5 h-3.5" /> Quizzes
            </Link>
            <Link href={`/lms/courses/${course.id}/live`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <Radio className="w-3.5 h-3.5" /> Live
            </Link>
            <Link href={`/lms/courses/${course.id}/discussions`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <MessagesSquare className="w-3.5 h-3.5" /> Discussions
            </Link>
            <Link href={`/lms/courses/${course.id}/analytics`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </Link>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Set status</span>
              {(["DRAFT", "PUBLISHED", "ARCHIVED"] as CourseStatus[]).map(s => (
                <button
                  key={s}
                  disabled={isPending || course.status === s}
                  onClick={() => run(() => setCourseStatus(course.id, s), `Course ${s.toLowerCase()}`)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50",
                    course.status === s
                      ? STATUS_STYLE[s]
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Curriculum */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Curriculum</h2>
        {canManage && (
          <Button size="sm" onClick={openCreateModule} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add module
          </Button>
        )}
      </div>

      {course.modules.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/40 p-10 text-center">
          <Layers className="w-9 h-9 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No modules yet</p>
          <p className="text-xs text-slate-500 mt-1">Modules group your lessons into sections.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {course.modules.map((m, mi) => (
            <div key={m.id} className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
              {/* Module header */}
              <div className="flex items-center gap-2 p-3.5 border-b border-slate-100">
                {canManage && (
                  <div className="flex flex-col -my-1">
                    <button disabled={isPending || mi === 0} onClick={() => run(() => moveModule(m.id, "up"))} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button disabled={isPending || mi === course.modules.length - 1} onClick={() => run(() => moveModule(m.id, "down"))} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400">M{mi + 1}</span>
                    <h3 className="font-bold text-sm text-slate-800 truncate">{m.title}</h3>
                    {!m.isPublished && <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Hidden</span>}
                  </div>
                  {m.description && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{m.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button title={m.isPublished ? "Hide module" : "Publish module"} onClick={() => run(() => toggleModulePublished(m.id, !m.isPublished))} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      {m.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => openEditModule(m)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDel({ kind: "module", id: m.id, name: m.title })} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {/* Lessons */}
              <div className="divide-y divide-slate-50">
                {m.lessons.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-3 italic">No lessons in this module yet.</p>
                ) : m.lessons.map((l, li) => {
                  const Meta = LESSON_META[l.type as LessonType] ?? LESSON_META.TEXT
                  const Icon = Meta.icon
                  return (
                    <div key={l.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                      {canManage && (
                        <div className="flex flex-col -my-1">
                          <button disabled={isPending || li === 0} onClick={() => run(() => moveLesson(l.id, "up"))} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                          <button disabled={isPending || li === m.lessons.length - 1} onClick={() => run(() => moveLesson(l.id, "down"))} className="text-slate-300 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{l.title}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{Meta.label}{l.videoDuration ? ` · ${Math.round(l.videoDuration / 60)} min` : ""}</p>
                      </div>
                      {l.isFree && <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Free</span>}
                      {!l.isPublished && <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Hidden</span>}
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button title={l.isPublished ? "Hide" : "Publish"} onClick={() => run(() => toggleLessonPublished(l.id, !l.isPublished))} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                            {l.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openEditLesson(l)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDel({ kind: "lesson", id: l.id, name: l.title })} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {canManage && (
                <button onClick={() => openCreateLesson(m.id)} className="w-full text-xs font-semibold text-primary inline-flex items-center justify-center gap-1 py-2.5 hover:bg-primary/5 transition-colors border-t border-slate-100">
                  <Plus className="w-3.5 h-3.5" /> Add lesson
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Module dialog */}
      <Dialog open={moduleDialog.open} onOpenChange={o => setModuleDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{moduleDialog.id ? "Edit module" : "Add module"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={moduleDialog.title} onChange={e => setModuleDialog(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Unit 1 — Foundations" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={moduleDialog.description} onChange={e => setModuleDialog(d => ({ ...d, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModuleDialog(d => ({ ...d, open: false }))} disabled={isPending}>Cancel</Button>
            <Button onClick={submitModule} disabled={isPending}>{isPending ? "Saving…" : moduleDialog.id ? "Save" : "Add module"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog.open} onOpenChange={o => setLessonDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{lessonDialog.id ? "Edit lesson" : "Add lesson"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={lessonDialog.title} onChange={e => setLessonDialog(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Introduction to variables" autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {LESSON_TYPES.map(t => {
                  const Icon = LESSON_META[t].icon
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLessonDialog(d => ({ ...d, type: t }))}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors",
                        lessonDialog.type === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> {LESSON_META[t].label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Type-specific fields */}
            {lessonDialog.type === "VIDEO" && (
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Video URL</Label>
                  <Input value={lessonDialog.videoUrl} onChange={e => setLessonDialog(d => ({ ...d, videoUrl: e.target.value }))} placeholder="YouTube / Vimeo / file URL" />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number" min={0}
                    value={lessonDialog.videoDuration ? String(Math.round(Number(lessonDialog.videoDuration) / 60)) : ""}
                    onChange={e => setLessonDialog(d => ({ ...d, videoDuration: e.target.value ? String(Number(e.target.value) * 60) : "" }))}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
            )}
            {(lessonDialog.type === "PDF" || lessonDialog.type === "SLIDES") && (
              <div className="space-y-1.5">
                <Label>File URL</Label>
                <Input value={lessonDialog.fileUrl} onChange={e => setLessonDialog(d => ({ ...d, fileUrl: e.target.value }))} placeholder="https://… (PDF or slides)" />
              </div>
            )}
            {lessonDialog.type === "LINK" && (
              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input value={lessonDialog.fileUrl} onChange={e => setLessonDialog(d => ({ ...d, fileUrl: e.target.value }))} placeholder="https://…" />
              </div>
            )}
            {(lessonDialog.type === "TEXT" || lessonDialog.type === "EMBED") && (
              <div className="space-y-1.5">
                <Label>{lessonDialog.type === "EMBED" ? "Embed code" : "Content"}</Label>
                <Textarea
                  value={lessonDialog.content}
                  onChange={e => setLessonDialog(d => ({ ...d, content: e.target.value }))}
                  rows={5}
                  placeholder={lessonDialog.type === "EMBED" ? "<iframe …></iframe>" : "Lesson text (HTML supported)…"}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <div>
                <Label className="text-sm">Free preview</Label>
                <p className="text-[11px] text-slate-500">Viewable without enrollment</p>
              </div>
              <Switch checked={lessonDialog.isFree} onCheckedChange={v => setLessonDialog(d => ({ ...d, isFree: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLessonDialog(d => ({ ...d, open: false }))} disabled={isPending}>Cancel</Button>
            <Button onClick={submitLesson} disabled={isPending}>{isPending ? "Saving…" : lessonDialog.id ? "Save" : "Add lesson"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!del} onOpenChange={o => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete {del?.kind}?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{del?.name}</span>
            {del?.kind === "module" ? " and all its lessons" : ""} will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>{isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Lesson form state ──
type LessonFormState = {
  open: boolean
  id?: string
  moduleId?: string
  title: string
  type: LessonType
  content: string
  fileUrl: string
  videoUrl: string
  videoDuration: string
  isFree: boolean
}

const EMPTY_LESSON: Omit<LessonFormState, "open"> = {
  title: "", type: "VIDEO", content: "", fileUrl: "", videoUrl: "", videoDuration: "", isFree: false,
}
