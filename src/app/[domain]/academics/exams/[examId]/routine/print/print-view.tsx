"use client"

import { useEffect, useMemo } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBS, toAD } from "@/lib/nepali-date"
import type { PaperRow } from "@/actions/exams"

export type PrintMode = "combined" | "faculty" | "class"

interface FacultyOpt { id: string;   name: string }
interface ClassOpt   { id: string;   name: string; facultyId: string | null; facultyName: string | null }

interface Props {
  schoolName: string
  examName:   string
  yearName:   string
  papers:     PaperRow[]
  faculties:  FacultyOpt[]
  classes:    ClassOpt[]
  mode:       PrintMode
  facultyIds: string[]   // restrict to these (empty = all)
  classIds:   string[]   // restrict to these (empty = all)
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function RoutinePrintView({
  schoolName, examName, yearName, papers, faculties, classes,
  mode, facultyIds, classIds,
}: Props) {
  useEffect(() => {
    // Defer print so layout settles
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  // ─── Filter papers by query ───────────────────────────────────────────
  const scopedPapers = useMemo(() => {
    return papers.filter(p => {
      if (facultyIds.length > 0) {
        const ok = p.targets.some(t => facultyIds.includes(t.facultyId ?? "_general_"))
        if (!ok) return false
      }
      if (classIds.length > 0) {
        const ok = p.targets.some(t => classIds.includes(t.classId))
        if (!ok) return false
      }
      return true
    })
  }, [papers, facultyIds, classIds])

  const scheduledOnly = scopedPapers
    .filter(p => p.schedule)
    .sort((a, b) => {
      const ad = a.schedule!.dateAD.getTime?.() ?? new Date(a.schedule!.dateAD).getTime()
      const bd = b.schedule!.dateAD.getTime?.() ?? new Date(b.schedule!.dateAD).getTime()
      if (ad !== bd) return ad - bd
      return a.schedule!.startTime.localeCompare(b.schedule!.startTime)
    })

  // ─── Choose which sections to render (faculty mode / class mode) ──────
  // - faculty mode: one section per faculty (filtered to those that have ≥1 paper in scope; includes a synthetic "General" bucket for null-faculty)
  // - class mode:   one section per class
  // - combined:     a single section

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
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          main { padding: 0 !important; background: white !important; }
          .print-shell { background: white !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
          .print-shell .backdrop-blur-xl { backdrop-filter: none !important; }
          .print-shell table { font-size: 9.5pt !important; }
          .print-shell th, .print-shell td { border-color: #475569 !important; }
          .print-shell tr { page-break-inside: avoid; }
          .print-shell .signature-cell { height: 28pt; }
          .print-section { page-break-after: always; }
          .print-section:last-child { page-break-after: auto; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.close()}
              className="gap-1.5 text-xs cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {scheduledOnly.length} scheduled · {scopedPapers.length - scheduledOnly.length} unscheduled
              · mode: <span className="text-slate-700 normal-case">{modeLabel(mode)}</span>
            </span>
          </div>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        {mode === "combined" && (
          <PrintSection
            schoolName={schoolName} examName={examName} yearName={yearName}
            title="All papers (combined)"
          >
            <CombinedTable papers={scheduledOnly} />
            <UnscheduledFootnote count={scopedPapers.length - scheduledOnly.length} />
          </PrintSection>
        )}

        {mode === "faculty" && (() => {
          // Buckets keyed by facultyId (or "_general_"). Only render faculties that have ≥1 paper in scope.
          const buckets = bucketByFaculty(scopedPapers, faculties, facultyIds)
          if (buckets.length === 0) {
            return <EmptyState />
          }
          return buckets.map(b => (
            <PrintSection
              key={b.facultyId ?? "_general_"}
              schoolName={schoolName} examName={examName} yearName={yearName}
              title={`Faculty: ${b.facultyName}`}
            >
              <CombinedTable papers={b.papers.filter(p => p.schedule).sort(sortByDateTime)} />
              <UnscheduledFootnote count={b.papers.filter(p => !p.schedule).length} />
            </PrintSection>
          ))
        })()}

        {mode === "class" && (() => {
          const buckets = bucketByClass(scopedPapers, classes, classIds)
          if (buckets.length === 0) {
            return <EmptyState />
          }
          return buckets.map(b => (
            <PrintSection
              key={b.classId}
              schoolName={schoolName} examName={examName} yearName={yearName}
              title={`Class: ${b.className}${b.facultyName ? ` — ${b.facultyName}` : ""}`}
            >
              <PerClassTable papers={b.papers.filter(p => p.schedule).sort(sortByDateTime)} forClassId={b.classId} />
              <UnscheduledFootnote count={b.papers.filter(p => !p.schedule).length} />
            </PrintSection>
          ))
        })()}
      </div>
    </>
  )
}

// ─── Print section wrapper (header per page) ────────────────────────────

function PrintSection({
  schoolName, examName, yearName, title, children,
}: {
  schoolName: string
  examName:   string
  yearName:   string
  title:      string
  children:   React.ReactNode
}) {
  return (
    <section className="print-section max-w-[1400px] mx-auto mb-6">
      <div className="border-b-2 border-slate-800 pb-2 mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-base font-black text-slate-900">{schoolName}</h1>
          <p className="text-[11px] text-slate-600 font-semibold">
            {examName} — {yearName} · <span className="text-slate-500">{title}</span>
          </p>
        </div>
        <p className="text-[10px] text-slate-500 font-mono tabular-nums">
          {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })}
        </p>
      </div>
      {children}
    </section>
  )
}

// ─── Combined columns: # · Date BS · Day · Time · Subject · Code · Classes · Duration · FM ─

function CombinedTable({ papers }: { papers: PaperRow[] }) {
  if (papers.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-xs text-slate-400 italic">
        No scheduled papers in this scope.
      </div>
    )
  }
  return (
    <table className="w-full border-collapse bg-white text-xs">
      <thead>
        <tr className="bg-slate-100/80">
          <Th width="w-8">#</Th>
          <Th width="w-28">Date (BS)</Th>
          <Th width="w-12">Day</Th>
          <Th width="w-16">Time</Th>
          <Th>Subject</Th>
          <Th width="w-16">Code</Th>
          <Th>Classes</Th>
          <Th width="w-16">Duration</Th>
          <Th width="w-12">FM</Th>
          <Th width="w-12">PM</Th>
        </tr>
      </thead>
      <tbody>
        {papers.map((p, i) => {
          const s = p.schedule!
          const ad = toAD(s.dateBS)
          return (
            <tr key={p.id} className="border-b border-slate-200">
              <Td className="text-slate-400 tabular-nums">{i + 1}</Td>
              <Td className="font-mono tabular-nums">{formatBS(s.dateBS)}</Td>
              <Td className="text-slate-500">{WEEKDAY[ad.getDay()]}</Td>
              <Td className="font-mono tabular-nums">{s.startTime}</Td>
              <Td className="font-bold text-slate-800">{p.subjectName}</Td>
              <Td className="font-mono tabular-nums text-slate-500">{p.code ?? "—"}</Td>
              <Td>
                <ClassesList targets={p.targets} />
              </Td>
              <Td className="font-mono tabular-nums">{s.durationMin ?? p.durationMin} min</Td>
              <Td className="font-mono tabular-nums">{p.fullMarks ?? "—"}</Td>
              <Td className="font-mono tabular-nums">{p.passMarks ?? "—"}</Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Per-class table: # · Date · Day · Time · Subject · Code · Duration · FM/PM · Signature ─

function PerClassTable({ papers, forClassId }: { papers: PaperRow[]; forClassId: string }) {
  if (papers.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-xs text-slate-400 italic">
        No scheduled papers for this class.
      </div>
    )
  }
  return (
    <table className="w-full border-collapse bg-white text-xs">
      <thead>
        <tr className="bg-slate-100/80">
          <Th width="w-8">#</Th>
          <Th width="w-28">Date (BS)</Th>
          <Th width="w-12">Day</Th>
          <Th width="w-16">Time</Th>
          <Th>Subject</Th>
          <Th width="w-16">Code</Th>
          <Th width="w-16">Duration</Th>
          <Th width="w-12">FM</Th>
          <Th width="w-12">PM</Th>
          <Th width="w-40">Student signature</Th>
        </tr>
      </thead>
      <tbody>
        {papers.map((p, i) => {
          const s = p.schedule!
          const ad = toAD(s.dateBS)
          // The subject row picks the subject NAME from the target matching this class.
          const target = p.targets.find(t => t.classId === forClassId)
          const subj   = target?.subjectName ?? p.subjectName
          return (
            <tr key={p.id} className="border-b border-slate-200">
              <Td className="text-slate-400 tabular-nums">{i + 1}</Td>
              <Td className="font-mono tabular-nums">{formatBS(s.dateBS)}</Td>
              <Td className="text-slate-500">{WEEKDAY[ad.getDay()]}</Td>
              <Td className="font-mono tabular-nums">{s.startTime}</Td>
              <Td className="font-bold text-slate-800">{subj}</Td>
              <Td className="font-mono tabular-nums text-slate-500">{p.code ?? "—"}</Td>
              <Td className="font-mono tabular-nums">{s.durationMin ?? p.durationMin} min</Td>
              <Td className="font-mono tabular-nums">{p.fullMarks ?? "—"}</Td>
              <Td className="font-mono tabular-nums">{p.passMarks ?? "—"}</Td>
              <Td className="signature-cell" />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

function Th({ children, width }: { children?: React.ReactNode; width?: string }) {
  return (
    <th className={cn(
      "text-left px-2 py-1.5 border border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-700",
      width,
    )}>{children}</th>
  )
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-2 py-1.5 border border-slate-300 align-top", className)}>{children}</td>
  )
}

function ClassesList({ targets }: { targets: PaperRow["targets"] }) {
  if (targets.length === 0) {
    return <span className="text-rose-500 italic text-[10px]">no classes attached</span>
  }
  // Group by class so combined papers read naturally
  const byClass = new Map<string, { className: string; facultyName: string | null }>()
  for (const t of targets) {
    if (!byClass.has(t.classId)) {
      byClass.set(t.classId, { className: t.className, facultyName: t.facultyName })
    }
  }
  return (
    <div className="flex flex-wrap gap-1">
      {[...byClass.values()].map((g, i) => (
        <span key={i}
          className="inline-block px-1.5 py-0.5 border border-slate-300 rounded text-[10px] font-bold bg-slate-50">
          {g.className}
          {g.facultyName && <span className="ml-1 text-slate-400 font-normal">{g.facultyName}</span>}
        </span>
      ))}
    </div>
  )
}

function UnscheduledFootnote({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <p className="text-[10px] text-slate-500 italic mt-2 no-print">
      Plus {count} unscheduled paper{count === 1 ? "" : "s"} in this scope (not printed).
    </p>
  )
}

function EmptyState() {
  return (
    <div className="max-w-[1400px] mx-auto p-12 text-center bg-white border border-dashed border-slate-300 rounded-xl">
      <p className="text-sm font-semibold text-slate-500">Nothing matches the chosen scope.</p>
      <p className="text-xs text-slate-400 mt-1">
        Try a different mode, or clear the faculty/class filter in the URL.
      </p>
    </div>
  )
}

function modeLabel(m: PrintMode): string {
  return m === "combined" ? "Combined" : m === "faculty" ? "Per faculty" : "Per class"
}

function sortByDateTime(a: PaperRow, b: PaperRow): number {
  const ad = a.schedule!.dateAD instanceof Date ? a.schedule!.dateAD.getTime() : new Date(a.schedule!.dateAD).getTime()
  const bd = b.schedule!.dateAD instanceof Date ? b.schedule!.dateAD.getTime() : new Date(b.schedule!.dateAD).getTime()
  if (ad !== bd) return ad - bd
  return a.schedule!.startTime.localeCompare(b.schedule!.startTime)
}

function bucketByFaculty(
  papers:     PaperRow[],
  faculties:  FacultyOpt[],
  filterIds:  string[],
): { facultyId: string | null; facultyName: string; papers: PaperRow[] }[] {
  const wanted = (id: string | null) => filterIds.length === 0 || filterIds.includes(id ?? "_general_") || filterIds.includes(id ?? "")
  const map = new Map<string, { facultyId: string | null; facultyName: string; papers: PaperRow[] }>()
  for (const p of papers) {
    const seen = new Set<string>()
    for (const t of p.targets) {
      const k = t.facultyId ?? "_general_"
      if (seen.has(k)) continue
      seen.add(k)
      if (!wanted(t.facultyId)) continue
      if (!map.has(k)) {
        map.set(k, {
          facultyId:   t.facultyId,
          facultyName: t.facultyName ?? "General",
          papers:      [],
        })
      }
      map.get(k)!.papers.push(p)
    }
  }
  // Sort: real faculties first by name, "General" last
  const out = [...map.values()]
  out.sort((a, b) => {
    if (!a.facultyId && b.facultyId) return  1
    if (a.facultyId && !b.facultyId) return -1
    return a.facultyName.localeCompare(b.facultyName)
  })
  // Ensure ordering of faculties matches the schoolwide order when no filter
  if (filterIds.length === 0 && faculties.length > 0) {
    const order = new Map(faculties.map((f, i) => [f.id, i]))
    out.sort((a, b) => {
      if (!a.facultyId && b.facultyId) return  1
      if (a.facultyId && !b.facultyId) return -1
      if (!a.facultyId && !b.facultyId) return 0
      return (order.get(a.facultyId!) ?? 999) - (order.get(b.facultyId!) ?? 999)
    })
  }
  return out
}

function bucketByClass(
  papers:    PaperRow[],
  classes:   ClassOpt[],
  filterIds: string[],
): { classId: string; className: string; facultyName: string | null; papers: PaperRow[] }[] {
  const wanted = (id: string) => filterIds.length === 0 || filterIds.includes(id)
  const map = new Map<string, { classId: string; className: string; facultyName: string | null; papers: PaperRow[] }>()
  for (const p of papers) {
    const seen = new Set<string>()
    for (const t of p.targets) {
      if (seen.has(t.classId)) continue
      seen.add(t.classId)
      if (!wanted(t.classId)) continue
      if (!map.has(t.classId)) {
        map.set(t.classId, {
          classId:     t.classId,
          className:   t.className,
          facultyName: t.facultyName,
          papers:      [],
        })
      }
      map.get(t.classId)!.papers.push(p)
    }
  }
  const out = [...map.values()]
  // Order by school's class order when no filter
  if (filterIds.length === 0 && classes.length > 0) {
    const order = new Map(classes.map((c, i) => [c.id, i]))
    out.sort((a, b) => (order.get(a.classId) ?? 999) - (order.get(b.classId) ?? 999))
  } else {
    out.sort((a, b) => a.className.localeCompare(b.className))
  }
  return out
}
