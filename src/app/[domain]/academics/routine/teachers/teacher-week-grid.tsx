import Link from "next/link"
import { Printer, Clock, FolderTree, Building2 } from "lucide-react"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import { subjectShort, facultyColor } from "@/lib/routine-format"
import { DAY_LABELS_SHORT } from "@/lib/working-days"
import type { TeacherWeek, TeacherWeekCell } from "@/actions/routine"

function fmtMinutes(m: number): string {
  if (m <= 0) return "0m"
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h === 0) return `${rem}m`
  if (rem === 0) return `${h}h`
  return `${h}h ${rem}m`
}

interface FacultySubWeek {
  facultyId:   string | null
  facultyName: string
  periods:     number
  minutes:     number
  slots:       TeacherWeek["slots"]
  workingDays: number[]
  weekMatrix:  Record<string, Record<number, TeacherWeekCell[]>>
}

/** Split the teacher's combined week into one sub-week per faculty they teach in. */
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
  teacher:       TeacherWeek
  workloadLabel?: string
  printHref?:    string
}

export function TeacherWeekGrid({ teacher, workloadLabel, printHref }: Props) {
  const cellCount = teacher.slots.length * teacher.workingDays.length
  const filled = Object.values(teacher.weekMatrix).reduce(
    (acc, byDay) => acc + Object.values(byDay).reduce((a, cells) => a + cells.length, 0),
    0,
  )
  const sections = splitWeekByFaculty(teacher)

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
        <Avatar name={teacher.teacherName} url={teacher.teacherAvatar} size={36} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900 truncate">{teacher.teacherName}</h3>
          <p className="text-[10px] text-slate-500">
            {filled} session{filled === 1 ? "" : "s"} · {teacher.weeklyPeriods} period{teacher.weeklyPeriods === 1 ? "" : "s"} · {sections.length} {sections.length === 1 ? "faculty" : "faculties"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {workloadLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 text-sky-700 text-[10px] font-black tabular-nums" title="Weekly teaching load">
              <Clock className="w-3 h-3" /> {workloadLabel}
            </span>
          )}
          <span className="text-[10px] text-slate-400 tabular-nums" title="Filled cells / available cells (combined)">
            {Math.round((filled / Math.max(cellCount, 1)) * 100)}%
          </span>
          {printHref && (
            <Link
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
              title={`Print ${teacher.teacherName}'s week`}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-primary hover:bg-primary/8 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* One grid per faculty */}
      {sections.length === 0 ? (
        <div className="px-5 py-6 text-center text-[11px] text-slate-400 italic">
          No scheduled periods.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sections.map(s => (
            <FacultySection key={s.facultyId ?? "__none__"} section={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function FacultySection({ section }: { section: FacultySubWeek }) {
  const sw = facultyColor(section.facultyId)
  return (
    <div>
      {/* Section header */}
      <div className={cn("flex items-center gap-2 px-5 py-2 border-b border-slate-100", sw.bg)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", sw.dot)} />
        {section.facultyId
          ? <FolderTree className={cn("w-3 h-3", sw.text)} />
          : <Building2 className={cn("w-3 h-3", sw.text)} />}
        <span className={cn("text-[11px] font-black uppercase tracking-widest", sw.text)}>
          {section.facultyName}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] font-mono tabular-nums text-slate-500">
          {section.periods} period{section.periods === 1 ? "" : "s"} · {fmtMinutes(section.minutes)}
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-2 py-1.5 border-b border-r border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky left-0 bg-slate-50/95 z-10 w-20">
                Period
              </th>
              {section.workingDays.map(d => (
                <th key={d} className="px-2 py-1.5 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 min-w-[100px]">
                  {DAY_LABELS_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.slots.map((slot, rowIdx) => (
              <tr key={slot.id} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                <th className="px-2 py-1.5 border-b border-r border-slate-100 text-[10px] font-bold text-slate-600 sticky left-0 bg-inherit z-10 text-left">
                  {slot.label ?? `P${slot.orderIndex + 1}`}
                </th>
                {section.workingDays.map(d => {
                  const cells = section.weekMatrix[slot.id]?.[d] ?? []
                  return (
                    <td key={d}
                      className={cn(
                        "px-1.5 py-1 border-b border-slate-100 align-top min-w-[100px]",
                        cells.length === 0 && "bg-slate-50/40",
                      )}>
                      {cells.length === 0 ? (
                        <span className="text-[10px] text-slate-300 italic">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {cells.map((c, i) => {
                            const subj = c.subjectName
                              ? subjectShort({ name: c.subjectName, shortName: c.subjectShortName })
                              : "—"
                            return (
                              <div key={i} className="flex items-center gap-1 text-[10px]"
                                title={[c.className, c.subjectName, c.studentGroupName ? `Group: ${c.studentGroupName}` : null].filter(Boolean).join(" · ")}>
                                <code className="text-[9px] font-mono text-emerald-700">{c.classShortName}</code>
                                <span className="text-slate-300">·</span>
                                <span className="font-semibold text-slate-700 truncate">{subj}</span>
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
    </div>
  )
}
