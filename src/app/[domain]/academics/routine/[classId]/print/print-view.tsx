"use client"

import { useEffect, useMemo } from "react"
import { ArrowLeft, Printer, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_LABELS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

type SlotShape = { id: string; orderIndex: number; label: string; startTime: string; endTime: string; isBreak: boolean }

type EntryShape = {
  id:             string
  subjectId:      string | null
  teacherUserId:  string | null
  studentGroupId: string | null
  subject:        { id: string; name: string; code: string } | null
  teacher:        { id: string; fullName: string } | null
  studentGroup:   { id: string; name: string } | null
}

interface Props {
  schoolName:       string
  className:        string
  facultyName:      string | null
  roomName:         string | null
  scheduleName:     string
  sessionName:      string | null
  sessionIsCurrent: boolean
  workingDays:      number[]
  slots:            SlotShape[]
  entries:          Record<string, EntryShape[]>
}

export function ClassRoutinePrintView({
  schoolName, className, facultyName, roomName, scheduleName, sessionName, sessionIsCurrent,
  workingDays, slots, entries,
}: Props) {
  useEffect(() => {
    // Small defer so layout settles before print
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  const sortedDays = useMemo(() => [...workingDays].sort((a, b) => a - b), [workingDays])
  const sortedSlots = useMemo(() => [...slots].sort((a, b) => a.orderIndex - b.orderIndex), [slots])

  // Build heading parts
  const headingMain = `${className} — Class Routine`
  const headingMeta = [
    sessionName && `Session ${sessionName}${sessionIsCurrent ? " (current)" : ""}`,
    facultyName && `Faculty: ${facultyName}`,
    roomName    && `Room: ${roomName}`,
    `Template: ${scheduleName}`,
  ].filter(Boolean).join("  ·  ")

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm 8mm 12mm 8mm;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          /* Hide global app chrome: sidebar + page header (tabs/breadcrumb). */
          aside,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"],
          header { display: none !important; }
          /* Reset the sidebar inset wrapper (no m-2/rounded/shadow during print). */
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          /* Drop the route-layout padding + radial background. */
          main { padding: 0 !important; background: white !important; }
          .print-shell {
            background: white !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-shell .backdrop-blur-xl { backdrop-filter: none !important; }
          .print-shell table  { font-size: 9.5pt !important; }
          .print-shell tr     { page-break-inside: avoid; }
          .print-shell th, .print-shell td { border-color: #475569 !important; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      {/* No-print toolbar with hint about PDF */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.close()}
              className="gap-1.5 text-xs cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {sortedSlots.length} slots × {sortedDays.length} days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] text-slate-500">
              For PDF, choose <strong>Save as PDF</strong> as the destination in the print dialog.
            </span>
            <Button size="sm" variant="outline" onClick={() => window.print()}
              className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
              <FileDown className="w-3.5 h-3.5" /> Save as PDF
            </Button>
            <Button size="sm" onClick={() => window.print()}
              className="gap-1.5 cursor-pointer text-xs h-8 font-bold">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div className="print-shell">
        <div className="max-w-[1400px] mx-auto">
          {/* Heading */}
          <div className="border-b-2 border-slate-800 pb-2 mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-lg font-black text-slate-900">{schoolName}</h1>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{headingMain}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">{headingMeta}</p>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tabular-nums whitespace-nowrap">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })}
            </p>
          </div>

          {/* Grid: rows = days, columns = slots */}
          <table className="w-full border-collapse bg-white text-xs">
            <thead>
              <tr className="bg-slate-100/80">
                <Th width="w-24">Day</Th>
                {sortedSlots.map(s => (
                  <Th key={s.id} className={cn(s.isBreak && "bg-amber-50/80")}>
                    <div className="text-[10px] font-black uppercase tracking-widest leading-tight">
                      {s.label}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5 tabular-nums">
                      {s.startTime} – {s.endTime}
                    </div>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDays.map(d => (
                <tr key={d} className="border-b border-slate-200">
                  <Td className="bg-slate-50/60 font-bold">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {DAY_LABELS_SHORT[d]}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{DAY_LABELS[d]}</div>
                  </Td>
                  {sortedSlots.map(s => {
                    const key  = `${s.id}:${d}`
                    const cell = entries[key] ?? []
                    if (s.isBreak) {
                      return (
                        <Td key={s.id} className="bg-amber-50/40 text-center">
                          <span className="text-[10px] italic text-amber-700">— break —</span>
                        </Td>
                      )
                    }
                    return (
                      <Td key={s.id} className="align-top">
                        {cell.length === 0 ? (
                          <span className="text-[10px] text-slate-300 italic">—</span>
                        ) : (
                          <div className="space-y-1">
                            {cell.map(e => (
                              <div key={e.id} className="leading-tight">
                                <div className="font-bold text-slate-800">
                                  {e.subject?.name ?? "—"}
                                  {e.subject?.code && (
                                    <span className="ml-1 text-[9px] font-mono font-medium text-slate-400">{e.subject.code}</span>
                                  )}
                                </div>
                                {e.teacher && (
                                  <div className="text-[10px] text-slate-600">{e.teacher.fullName}</div>
                                )}
                                {e.studentGroup && (
                                  <div className="text-[9px] font-bold text-violet-700">
                                    ★ {e.studentGroup.name}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature row */}
          <div className="mt-8 grid grid-cols-3 gap-8 text-[10px] text-slate-500">
            <div className="border-t border-slate-400 pt-1 text-center">Class Teacher</div>
            <div className="border-t border-slate-400 pt-1 text-center">Principal</div>
            <div className="border-t border-slate-400 pt-1 text-center">Issued</div>
          </div>
        </div>
      </div>
    </>
  )
}

function Th({ children, className, width }: { children?: React.ReactNode; className?: string; width?: string }) {
  return (
    <th className={cn(
      "text-left px-2 py-1.5 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-700 align-top",
      width, className,
    )}>{children}</th>
  )
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-2 py-1.5 border border-slate-300", className)}>{children}</td>
  )
}
