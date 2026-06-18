"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, CheckCircle2, Circle, Video, FileText, Presentation, Link2, Type, Code,
  PlayCircle, ChevronRight, ExternalLink, Trophy, ClipboardList, ListChecks, Radio, MessagesSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { getLearnerCourse, markLessonComplete, markLessonIncomplete } from "@/actions/lms/progress"

type Data = Awaited<ReturnType<typeof getLearnerCourse>>
type Course = Data["course"]
type Module = Course["modules"][number]
type Lesson = Module["lessons"][number]

const TYPE_ICON: Record<string, React.ElementType> = {
  VIDEO: Video, PDF: FileText, SLIDES: Presentation, LINK: Link2, TEXT: Type, EMBED: Code,
}

/** Convert common video URLs to an embeddable src. */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v")
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
  } catch { /* fall through */ }
  return url
}

export function CoursePlayer({
  course, completedLessonIds,
}: {
  course: Course
  completedLessonIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedLessonIds))

  const flatLessons = useMemo(
    () => course.modules.flatMap(m => m.lessons),
    [course.modules],
  )
  const totalLessons = flatLessons.length

  const [currentId, setCurrentId] = useState<string | null>(
    flatLessons.find(l => !completedLessonIds.includes(l.id))?.id ?? flatLessons[0]?.id ?? null,
  )
  const current = flatLessons.find(l => l.id === currentId) ?? null

  const progress = totalLessons === 0 ? 0 : Math.round((completed.size / totalLessons) * 100)

  function setDone(lessonId: string, done: boolean) {
    startTransition(async () => {
      try {
        if (done) await markLessonComplete(lessonId)
        else await markLessonIncomplete(lessonId)
        setCompleted(prev => {
          const next = new Set(prev)
          if (done) next.add(lessonId); else next.delete(lessonId)
          return next
        })
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message || "Could not update progress")
      }
    })
  }

  function goNext() {
    if (!current) return
    const idx = flatLessons.findIndex(l => l.id === current.id)
    const next = flatLessons[idx + 1]
    if (next) setCurrentId(next.id)
  }

  const currentIdx = current ? flatLessons.findIndex(l => l.id === current.id) : -1
  const hasNext = currentIdx >= 0 && currentIdx < flatLessons.length - 1

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/lms/learn" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> My Learning
        </Link>
        {progress >= 100 && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Trophy className="w-3.5 h-3.5" /> Course complete
          </span>
        )}
      </div>

      {/* Title + progress */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">{course.title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{course.instructor.fullName}{course.subject ? ` · ${course.subject.name}` : ""}</p>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs font-bold text-slate-600 tabular-nums">{completed.size}/{totalLessons} · {progress}%</span>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Link href={`/lms/learn/${course.id}/assignments`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><ClipboardList className="w-3.5 h-3.5" /> Assignments</Link>
          <span className="text-slate-200">·</span>
          <Link href={`/lms/learn/${course.id}/quizzes`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><ListChecks className="w-3.5 h-3.5" /> Quizzes</Link>
          <span className="text-slate-200">·</span>
          <Link href={`/lms/learn/${course.id}/live`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Radio className="w-3.5 h-3.5" /> Live classes</Link>
          <span className="text-slate-200">·</span>
          <Link href={`/lms/learn/${course.id}/discussions`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><MessagesSquare className="w-3.5 h-3.5" /> Discussions</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Content viewer */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden order-2 lg:order-1">
          {current ? (
            <div>
              <LessonContent lesson={current} />
              <div className="p-4 border-t border-slate-100">
                <h2 className="font-bold text-base text-slate-800">{current.title}</h2>
                {current.type === "TEXT" && current.content && (
                  <div
                    className="prose prose-sm max-w-none mt-3 text-slate-700"
                    dangerouslySetInnerHTML={{ __html: current.content }}
                  />
                )}
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant={completed.has(current.id) ? "outline" : "default"}
                    onClick={() => setDone(current.id, !completed.has(current.id))}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    {completed.has(current.id)
                      ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed</>
                      : <><Circle className="w-4 h-4" /> Mark complete</>}
                  </Button>
                  {hasNext && (
                    <Button variant="ghost" onClick={goNext} className="gap-1">
                      Next lesson <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <PlayCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No lessons available yet</p>
              <p className="text-xs text-slate-500 mt-1">Check back once your instructor publishes content.</p>
            </div>
          )}
        </div>

        {/* Curriculum sidebar */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden order-1 lg:order-2">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Curriculum</h3>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {course.modules.map((m, mi) => (
              <div key={m.id} className="border-b border-slate-50 last:border-0">
                <div className="px-4 py-2.5 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-700">M{mi + 1}. {m.title}</p>
                </div>
                {m.lessons.map(l => {
                  const Icon = TYPE_ICON[l.type] ?? Type
                  const isDone = completed.has(l.id)
                  const isCurrent = l.id === currentId
                  return (
                    <button
                      key={l.id}
                      onClick={() => setCurrentId(l.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors",
                        isCurrent ? "bg-primary/8" : "hover:bg-slate-50"
                      )}
                    >
                      {isDone
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <Icon className={cn("w-4 h-4 shrink-0", isCurrent ? "text-primary" : "text-slate-400")} />}
                      <span className={cn("text-sm truncate flex-1", isCurrent ? "text-primary font-semibold" : "text-slate-600")}>
                        {l.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO" && lesson.videoUrl) {
    return (
      <div className="aspect-video bg-black">
        <iframe
          src={toEmbedUrl(lesson.videoUrl)}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  if ((lesson.type === "PDF" || lesson.type === "SLIDES") && lesson.fileUrl) {
    return <iframe src={lesson.fileUrl} className="w-full h-[60vh] bg-slate-100" />
  }
  if (lesson.type === "EMBED" && lesson.content) {
    return <div className="p-4" dangerouslySetInnerHTML={{ __html: lesson.content }} />
  }
  if (lesson.type === "LINK" && lesson.fileUrl) {
    return (
      <div className="p-10 text-center">
        <Link2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <a
          href={lesson.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Open resource <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    )
  }
  if (lesson.type === "TEXT") {
    // Text body is rendered below the title in the parent.
    return <div className="h-2" />
  }
  return (
    <div className="p-10 text-center text-sm text-slate-400 italic">
      No content provided for this lesson.
    </div>
  )
}
