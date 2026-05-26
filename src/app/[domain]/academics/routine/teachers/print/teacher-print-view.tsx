"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer, Clock, FolderTree, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar-img"
import { subjectShort, facultyColor } from "@/lib/routine-format"
import { DAY_LABELS_SHORT } from "@/lib/working-days"
import { cn } from "@/lib/utils"
import type { TeacherWeek, TeacherWeekCell } from "@/actions/routine"

interface FacultySubWeek {
  facultyId:   string | null
  facultyName: string
  periods:     number
  minutes:     number
  slots:       TeacherWeek["slots"]
  workingDays: number[]
  weekMatrix:  Record<string, Record<number, TeacherWeekCell[]>>
}

function splitWeekByFaculty(teacher: TeacherWeek): FacultySubWeek[] {
  return teacher.facultyBreakdown.map(fb => {
    const matrix: Record<string, Record<number, TeacherWeekCell[]>> = {}
    const slotIds = new Set<string>()
    const days    = new Set<number>()
    for (const slot of teacher.slots) {
      const byDay = teacher.weekMatrix[slot.id]
      if (!byDay) continue
      for (const [dStr, cells] of Object.entries(byDay)) {
        const d = Number(dStr)
        const filtered = cells.filter(c => c.facultyId === fb.facultyId)
        if (filtered.length === 0) continue
        if (!matrix[slot.id]) matrix[slot.id] = {}
        matrix[slot.id][d] = filtered
        slotIds.add(slot.id)
        days.add(d)
      }
    }
    return {
      facultyId:   fb.facultyId,
      facultyName: fb.facultyName,
      periods:     fb.periods,
      minutes:     fb.minutes,
      slots:       teacher.slots.filter(s => slotIds.has(s.id)),
      workingDays: [...days].sort((a, b) => a - b),
      weekMatrix:  matrix,
    }
  })
}

interface Props {
  schoolName: string
  teachers:   TeacherWeek[]
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function TeacherPrintView({ schoolName, teachers }: Props) {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/academics/routine/teachers")
    }
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 8mm 6mm 10mm 6mm;
        }

        /* WYSIWYG — same compact styles on screen + print */
        .teacher-print .max-w-\\[1400px\\] { max-width: 100% !important; }
        .teacher-print .overflow-auto,
        .teacher-print .overflow-x-auto,
        .teacher-print .overflow-y-auto {
          overflow: visible !important;
          max-height: none !important;
          max-width: 100% !important;
        }
        .teacher-print .sticky { position: static !important; }
        .teacher-print .backdrop-blur-xl { backdrop-filter: none !important; }
        .teacher-print table {
          font-size: 10pt;
          width: 100%;
          table-layout: fixed;
          min-width: 0;
        }
        .teacher-print th, .teacher-print td {
          min-width: 0;
          padding: 6px 8px;
          word-break: break-word;
          overflow-wrap: break-word;
          border-color: #475569;
        }
        .teacher-print th:first-child,
        .teacher-print td:first-child {
          width: 12%;
        }

        /* Force the tiny pixel-based labels up to readable sizes
           on BOTH screen preview and printed output. */
        .teacher-print { font-size: 11pt; }
        .teacher-print h3 { font-size: 13pt !important; }
        .teacher-print .text-\\[8px\\]  { font-size: 8pt  !important; }
        .teacher-print .text-\\[9px\\]  { font-size: 9pt  !important; }
        .teacher-print .text-\\[10px\\] { font-size: 10pt !important; }
        .teacher-print .text-\\[11px\\] { font-size: 11pt !important; }
        .teacher-print .text-xs        { font-size: 11pt !important; }
        .teacher-print .text-sm        { font-size: 12pt !important; }
        /* Keep icons proportional — Tailwind's w-3 etc are tiny at large font.
           Bump them so they don't look like specks next to the larger text. */
        .teacher-print .w-2,   .teacher-print .h-2   { width: 9px !important;  height: 9px !important; }
        .teacher-print .w-2\\.5, .teacher-print .h-2\\.5 { width: 11px !important; height: 11px !important; }
        .teacher-print .w-3,   .teacher-print .h-3   { width: 12px !important; height: 12px !important; }
        .teacher-print .w-3\\.5, .teacher-print .h-3\\.5 { width: 14px !important; height: 14px !important; }

        .teacher-print {
          background: #f8fafc;
          padding: 16px;
        }
        .teacher-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .faculty-section {
          page-break-inside: avoid;
        }
        .faculty-section + .faculty-section {
          margin-top: 8px;
        }

        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          aside, header,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"] { display: none !important; }
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          main { padding: 0 !important; background: white !important; }
          .teacher-print { background: white !important; padding: 0 !important; }
          .teacher-card { border: 1px solid #475569 !important; box-shadow: none !important; margin-bottom: 8mm; page-break-inside: auto; }
          .teacher-card + .teacher-card { page-break-before: always; }
          .faculty-section + .faculty-section { page-break-before: auto; }
          .teacher-print thead { display: table-header-group; }
          .teacher-print tr     { page-break-inside: avoid; }
        }
      `}</style>

      {/* Floating no-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {teachers.length} teacher{teachers.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="teacher-print">
        <div className="max-w-[1400px] mx-auto mb-3">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-slate-800 pb-2">
            <div>
              <h1 className="text-base font-black text-slate-900">{schoolName}</h1>
              <p className="text-[11px] text-slate-600 font-semibold">Teacher Weekly Routine</p>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tabular-nums">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })}
            </p>
          </div>
        </div>

        {teachers.length === 0 ? (
          <div className="max-w-[1400px] mx-auto teacher-card text-center">
            <p className="text-sm text-slate-500">No teachers match the filter.</p>
          </div>
        ) : (
          <div className="max-w-[1400px] mx-auto">
            {teachers.map(t => <TeacherCard key={t.teacherId} teacher={t} />)}
          </div>
        )}
      </div>
    </>
  )
}

function TeacherCard({ teacher }: { teacher: TeacherWeek }) {
  const sections = splitWeekByFaculty(teacher)
  return (
    <div className="teacher-card">
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200 mb-2">
        <Avatar name={teacher.teacherName} url={teacher.teacherAvatar} size={36} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900 truncate">{teacher.teacherName}</h3>
          <p className="text-[10px] text-slate-500">
            {teacher.weeklyPeriods} period{teacher.weeklyPeriods === 1 ? "" : "s"}/week · {sections.length} {sections.length === 1 ? "faculty" : "faculties"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 text-sky-700 text-[10px] font-black tabular-nums">
          <Clock className="w-3 h-3" /> {formatHours(teacher.weeklyMinutes)}/week
        </span>
      </div>

      {sections.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic text-center py-3">No scheduled periods.</p>
      ) : (
        <div className="space-y-3">
          {sections.map(s => <FacultySection key={s.facultyId ?? "__none__"} section={s} />)}
        </div>
      )}
    </div>
  )
}

function FacultySection({ section }: { section: FacultySubWeek }) {
  const sw = facultyColor(section.facultyId)
  return (
    <div className="faculty-section">
      {/* Section header */}
      <div className={cn("flex items-center gap-1.5 px-2 py-1 border border-b-0 rounded-t-md", sw.bg, sw.border)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", sw.dot)} />
        {section.facultyId
          ? <FolderTree className={cn("w-3 h-3", sw.text)} />
          : <Building2 className={cn("w-3 h-3", sw.text)} />}
        <span className={cn("text-[10px] font-black uppercase tracking-widest", sw.text)}>
          {section.facultyName}
        </span>
        <span className="flex-1" />
        <span className="text-[9px] font-mono tabular-nums text-slate-500">
          {section.periods} period{section.periods === 1 ? "" : "s"} · {formatHours(section.minutes)}
        </span>
      </div>

      <table className="w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-2 py-1.5 border-b border-r border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">
              Period
            </th>
            {section.workingDays.map((d, i, arr) => (
              <th key={d}
                className={cn(
                  "px-2 py-1.5 border-b border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500",
                  i < arr.length - 1 && "border-r border-slate-300",
                )}>
                {DAY_LABELS_SHORT[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.slots.map((slot, rowIdx) => (
            <tr key={slot.id} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
              <th className="px-2 py-1.5 border-b border-r border-slate-300 text-[10px] font-bold text-slate-700 text-left align-middle">
                <div className="leading-tight">{slot.label ?? `P${slot.orderIndex + 1}`}</div>
                {(slot.startTime || slot.endTime) && (
                  <div className="text-[8px] font-mono text-slate-400 tabular-nums">
                    {slot.startTime ?? "—"}–{slot.endTime ?? "—"}
                  </div>
                )}
              </th>
              {section.workingDays.map((d, i, arr) => {
                const cells = section.weekMatrix[slot.id]?.[d] ?? []
                return (
                  <td key={d}
                    className={cn(
                      "px-1.5 py-1 border-b border-slate-200 align-middle text-center",
                      i < arr.length - 1 && "border-r border-slate-200",
                      cells.length === 0 && "bg-slate-50/40",
                    )}>
                    {cells.length === 0 ? (
                      <span className="text-[10px] text-slate-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {cells.map((c, i) => {
                          const subj = c.subjectName
                            ? subjectShort({ name: c.subjectName, shortName: c.subjectShortName })
                            : "—"
                          return (
                            <div key={i} className="text-[10px] leading-tight flex items-center justify-center gap-0.5 flex-wrap"
                              title={[c.className, c.subjectName].filter(Boolean).join(" · ")}>
                              <code className="font-mono text-emerald-700 font-black">{c.classShortName}</code>
                              <span className="text-slate-300">·</span>
                              <span className="font-semibold text-slate-700">{subj}</span>
                              {c.studentGroupName && (
                                <span className="text-[8px] text-violet-600">★</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
