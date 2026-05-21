import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import { subjectShort } from "@/lib/routine-format"
import { DAY_LABELS_SHORT } from "@/lib/working-days"
import type { TeacherWeek } from "@/actions/routine"

interface Props {
  teacher: TeacherWeek
}

export function TeacherWeekGrid({ teacher }: Props) {
  const cellCount = teacher.slots.length * teacher.workingDays.length
  const filled = Object.values(teacher.weekMatrix).reduce(
    (acc, byDay) => acc + Object.values(byDay).reduce((a, cells) => a + cells.length, 0),
    0,
  )

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
        <Avatar name={teacher.teacherName} url={teacher.teacherAvatar} size={36} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900 truncate">{teacher.teacherName}</h3>
          <p className="text-[10px] text-slate-500">
            {filled} session{filled === 1 ? "" : "s"} · {teacher.slots.length} period{teacher.slots.length === 1 ? "" : "s"} · {teacher.workingDays.length} day{teacher.workingDays.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-[10px] text-slate-400 tabular-nums">
          load {Math.round((filled / Math.max(cellCount, 1)) * 100)}%
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-2 py-1.5 border-b border-r border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky left-0 bg-slate-50/95 z-10 w-20">
                Period
              </th>
              {teacher.workingDays.map(d => (
                <th key={d} className="px-2 py-1.5 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 min-w-[100px]">
                  {DAY_LABELS_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teacher.slots.map((slot, rowIdx) => (
              <tr key={slot.id} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                <th className="px-2 py-1.5 border-b border-r border-slate-100 text-[10px] font-bold text-slate-600 sticky left-0 bg-inherit z-10 text-left">
                  {slot.label ?? `P${slot.orderIndex + 1}`}
                </th>
                {teacher.workingDays.map(d => {
                  const cells = teacher.weekMatrix[slot.id]?.[d] ?? []
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
