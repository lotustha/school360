"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Printer, Download, FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  ClassLedger, LedgerCell, LedgerEvaluation, LedgerStudent, LedgerSubject,
} from "@/actions/evaluation-results"
import { exportLedgerToXlsx } from "@/lib/ledger-export"
import { formatMark } from "@/lib/format-marks"

interface Props {
  ledger: ClassLedger
}

export type LedgerMode = "grade" | "mark" | "both"
type SortKey            = "roll" | "gpa" | "name"

export function ClassLedgerTable({ ledger }: Props) {
  const [mode,   setMode]   = useState<LedgerMode>("grade")
  const [sortBy, setSortBy] = useState<SortKey>("roll")
  const [search, setSearch] = useState("")

  const visibleStudents = useMemo(() => {
    let rows: LedgerStudent[] = ledger.students
    if (search.trim()) {
      const k = search.trim().toLowerCase()
      rows = rows.filter(s =>
        `${s.fullName} ${s.rollNumber ?? ""} ${s.admissionNo} ${s.symbolNumber ?? ""}`
          .toLowerCase()
          .includes(k),
      )
    }
    const cmpRoll = (a: LedgerStudent, b: LedgerStudent) => {
      const ar = parseInt(a.rollNumber ?? "0", 10) || 0
      const br = parseInt(b.rollNumber ?? "0", 10) || 0
      return ar - br
    }
    switch (sortBy) {
      case "roll": rows = [...rows].sort(cmpRoll); break
      case "name": rows = [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName)); break
      case "gpa":  rows = [...rows].sort((a, b) => (b.gpa ?? -1) - (a.gpa ?? -1)); break
    }
    return rows
  }, [ledger.students, search, sortBy])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ledger Type</span>
          <Select value={mode} onValueChange={(v) => setMode(v as LedgerMode)}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grade">Grade Ledger</SelectItem>
              <SelectItem value="mark">Mark Ledger</SelectItem>
              <SelectItem value="both">Grade and Mark Ledger</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort By</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 text-xs cursor-pointer bg-white border-slate-200 min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roll">Roll No</SelectItem>
              <SelectItem value="gpa">GPA</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search</span>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, roll, symbol, admission no…"
              className="h-9 pl-8 text-xs bg-white border-slate-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportLedgerToXlsx(ledger, mode, visibleStudents)}
            className="gap-1.5 cursor-pointer h-9 text-xs bg-white"
            aria-label="Download Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="gap-1.5 cursor-pointer h-9 text-xs bg-white"
            aria-label="Print"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Toolbar summary */}
      <div className="text-xs text-slate-600 flex items-center gap-1.5 print:hidden">
        <FileText className="w-3 h-3" />
        <span className="font-semibold text-slate-700">{ledger.className}</span>
        <span className="text-slate-400">·</span>
        <span>{ledger.yearName}</span>
        <span className="text-slate-400">·</span>
        <span>{visibleStudents.length} of {ledger.students.length} students</span>
        <span className="text-slate-400">·</span>
        <span className="italic text-slate-500">
          {mode === "grade" ? "Grade letters" : mode === "mark" ? "Obtained / max" : "Grade + Mark per cell"}
        </span>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center pb-2 border-b-2 border-slate-700 mb-3">
        <h1 className="text-base font-bold uppercase tracking-wide">
          {mode === "grade" ? "Grade" : mode === "mark" ? "Mark" : "Grade & Mark"} Ledger · {ledger.className} · {ledger.yearName}
        </h1>
      </div>

      {/* One section per evaluation */}
      {ledger.evaluations.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400 italic">
          No evaluations recorded for this class in {ledger.yearName}.
        </div>
      ) : (
        ledger.evaluations.map(ev => (
          <EvaluationSection
            key={ev.id}
            evaluation={ev}
            students={visibleStudents}
            cells={ledger.cells}
            optedOut={ledger.optedOut}
            anyFail={ledger.anyFail}
            mode={mode}
            className={ledger.className}
            yearName={ledger.yearName}
          />
        ))
      )}

      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 10mm; }
          body  { background: white !important; }
        }
      `}</style>
    </div>
  )
}

// ─── One evaluation block ──────────────────────────────────────────────────

/**
 * Per-subject column count.
 * - Subjects with no external pillar (e.g. CAS-only Moral Education) drop the
 *   EX column so we don't render empty cells.
 *   - grade/mark mode: 3 cols (IN/EX/FGL) → 2 cols (IN/FGL) when no external
 *   - both         mode: 6 cols → 4 cols (IN-G/IN-M/FGL-G/FGL-M)
 */
function partsForSubject(s: LedgerSubject, mode: LedgerMode): number {
  const hasExternal = s.externalMax > 0
  if (mode === "both") return hasExternal ? 6 : 4
  return hasExternal ? 3 : 2
}

function EvaluationSection({
  evaluation, students, cells, optedOut, anyFail, mode, className, yearName,
}: {
  evaluation: LedgerEvaluation
  students:   LedgerStudent[]
  cells:      Record<string, LedgerCell>
  optedOut:   Record<string, boolean>
  anyFail:    Record<string, boolean>
  mode:       LedgerMode
  className:  string
  yearName:   string
}) {
  // Bucket subjects: regular + optional render before GPA, extra renders after.
  const beforeGpa = evaluation.subjects.filter(s => s.subjectType !== "EXTRA")
  const afterGpa  = evaluation.subjects.filter(s => s.subjectType === "EXTRA")

  // Sum of subject sub-columns for empty-row colSpan.
  const totalSubjectCols =
    beforeGpa.reduce((n, s) => n + partsForSubject(s, mode), 0) +
    afterGpa .reduce((n, s) => n + partsForSubject(s, mode), 0)

  return (
    <div className="bg-white border-2 border-slate-800 rounded-md overflow-hidden">
      <div className="bg-slate-800 text-white px-4 py-2 text-sm font-bold flex items-center justify-between">
        <span>
          {evaluation.name} Result Record · {className} · {yearName}
        </span>
        <span className="text-[11px] font-mono opacity-80">
          {evaluation.subjects.length} subjects ({beforeGpa.length} regular + {afterGpa.length} extra) · {students.length} students
        </span>
      </div>

      <div className="overflow-auto max-h-[calc(100svh-300px)] print:max-h-none print:overflow-visible">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 print:static">
            {/* Row 1: top-level identity + subject groups + GPA */}
            <tr className="bg-slate-100 text-center">
              <th rowSpan={2} className="border border-slate-700 px-2 py-1 font-bold uppercase tracking-wide text-[10px]" style={{ width: 32 }}>SN</th>
              <th rowSpan={2} className="border border-slate-700 px-2 py-1 font-bold uppercase tracking-wide text-[10px]" style={{ width: 70 }}>Symbol</th>
              <th rowSpan={2} className="border border-slate-700 px-2 py-1 font-bold uppercase tracking-wide text-[10px]" style={{ width: 50 }}>Roll</th>
              <th rowSpan={2} className="sticky left-0 z-30 bg-slate-100 border border-slate-700 px-2 py-1 text-left font-bold uppercase tracking-wide text-[10px] min-w-[180px]">
                Student Name
              </th>
              {beforeGpa.map(s => (
                <SubjectGroupTopHeader key={s.subjectEvaluationId} subject={s} partsPerGroup={partsForSubject(s, mode)} />
              ))}
              <th rowSpan={2}
                className="border-l-4 border-r-4 border-slate-800 px-2 py-1 font-bold uppercase tracking-wide text-[10px] bg-amber-50/60"
                style={{ width: 60 }}>
                GPA
              </th>
              {afterGpa.map(s => (
                <SubjectGroupTopHeader key={s.subjectEvaluationId} subject={s} partsPerGroup={partsForSubject(s, mode)} />
              ))}
            </tr>
            {/* Row 2: per subject, sub-column part labels (mode-aware + per-subject) */}
            <tr className="bg-slate-50 text-center text-[9px] font-bold uppercase tracking-wide">
              {beforeGpa.map(s => (
                <SubjectPartHeaders key={s.subjectEvaluationId} mode={mode} hasExternal={s.externalMax > 0} />
              ))}
              {afterGpa.map(s => (
                <SubjectPartHeaders key={s.subjectEvaluationId} mode={mode} hasExternal={s.externalMax > 0} />
              ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={4 + totalSubjectCols + 1} className="border border-slate-700 px-3 py-6 text-center text-xs italic text-slate-400">
                  No students match the current search.
                </td>
              </tr>
            ) : students.map((stu, i) => (
              <tr key={stu.id} className={cn(i % 2 === 0 ? "bg-white" : "bg-slate-50/40", "hover:bg-blue-50/40 print:hover:bg-transparent")}>
                <td className="border border-slate-700 text-center px-1 py-1">{i + 1}</td>
                <td className="border border-slate-700 text-center font-mono px-1 py-1">{stu.symbolNumber ?? "—"}</td>
                <td className="border border-slate-700 text-center font-mono px-1 py-1">{stu.rollNumber ?? "—"}</td>
                <td className="sticky left-0 z-10 bg-inherit border border-slate-700 px-2 py-1 align-middle min-w-[180px]">
                  <Link
                    href={`/academics/evaluations/ledger/${stu.id}`}
                    className="block text-xs font-semibold text-slate-800 truncate hover:text-primary transition-colors"
                  >
                    {stu.fullName}
                  </Link>
                </td>
                {beforeGpa.map(s => (
                  <SubjectPartCells
                    key={s.subjectEvaluationId}
                    cell={cells[`${stu.id}::${s.subjectEvaluationId}`]}
                    isFinal={evaluation.isFinal}
                    mode={mode}
                    hasExternal={s.externalMax > 0}
                    isOptedOut={s.subjectType !== "REGULAR" && !!optedOut[`${stu.id}::${s.subjectId}`]}
                  />
                ))}
                <td className="border-l-4 border-r-4 border-slate-800 text-center font-bold px-1 py-1 bg-amber-50/40">
                  {anyFail[stu.id]
                    ? <span className="text-rose-700 font-extrabold">NG</span>
                    : stu.gpa !== null
                      ? formatMark(stu.gpa, "gpa")
                      : "—"}
                </td>
                {afterGpa.map(s => (
                  <SubjectPartCells
                    key={s.subjectEvaluationId}
                    cell={cells[`${stu.id}::${s.subjectEvaluationId}`]}
                    isFinal={evaluation.isFinal}
                    mode={mode}
                    hasExternal={s.externalMax > 0}
                    isOptedOut={false}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Top header (subject group) ───────────────────────────────────────────

function SubjectGroupTopHeader({
  subject, partsPerGroup,
}: {
  subject:       LedgerSubject
  partsPerGroup: number
}) {
  const typeChip =
    subject.subjectType === "OPTIONAL" ? <span className="ml-1 text-[8px] text-violet-700 font-bold">·O</span>
    : subject.subjectType === "EXTRA"  ? <span className="ml-1 text-[8px] text-amber-700  font-bold">·E</span>
    : null
  return (
    <th
      colSpan={partsPerGroup}
      className={cn(
        "border border-slate-700 px-1 py-1 font-bold uppercase tracking-wide text-[10px]",
        subject.subjectType === "EXTRA" && "bg-amber-50/50",
      )}
      title={subject.subjectName}
    >
      {shortSubjectName(subject.subjectName)}{typeChip}
    </th>
  )
}

// ─── Sub-column headers per subject (mode + per-subject pillars) ──────────

function SubjectPartHeaders({ mode, hasExternal }: { mode: LedgerMode; hasExternal: boolean }) {
  if (mode === "both") {
    return (
      <>
        <th className="border border-slate-700 px-1 py-1" style={{ width: 38 }}>IN-G</th>
        <th className="border border-slate-700 px-1 py-1" style={{ width: 46 }}>IN-M</th>
        {hasExternal && (
          <>
            <th className="border border-slate-700 px-1 py-1" style={{ width: 38 }}>EX-G</th>
            <th className="border border-slate-700 px-1 py-1" style={{ width: 46 }}>EX-M</th>
          </>
        )}
        <th className="border border-slate-700 px-1 py-1" style={{ width: 38 }}>FGL-G</th>
        <th className="border border-slate-700 px-1 py-1" style={{ width: 46 }}>FGL-M</th>
      </>
    )
  }
  return (
    <>
      <th className="border border-slate-700 px-1 py-1" style={{ width: 42 }}>IN</th>
      {hasExternal && (
        <th className="border border-slate-700 px-1 py-1" style={{ width: 42 }}>EX</th>
      )}
      <th className="border border-slate-700 px-1 py-1" style={{ width: 48 }}>FGL</th>
    </>
  )
}

// ─── Sub-column cells per subject ─────────────────────────────────────────

function SubjectPartCells({
  cell, isFinal, mode, hasExternal, isOptedOut,
}: {
  cell:        LedgerCell | undefined
  isFinal:     boolean
  mode:        LedgerMode
  hasExternal: boolean
  isOptedOut:  boolean
}) {
  const partsCount =
    mode === "both" ? (hasExternal ? 6 : 4)
                    : (hasExternal ? 3 : 2)

  if (isOptedOut) {
    return (
      <>
        {Array.from({ length: partsCount }).map((_, i) => (
          <td key={i} className="border border-slate-700 px-1 py-1 bg-slate-50/40" title="Not enrolled" />
        ))}
      </>
    )
  }

  if (!cell) {
    return (
      <>
        {Array.from({ length: partsCount }).map((_, i) => (
          <td key={i} className="border border-slate-700 text-center text-slate-300 px-1 py-1">–</td>
        ))}
      </>
    )
  }

  // Treat NG grade as failed too — keeps coloring correct for rows that haven't
  // been recomputed since the status-NG fix landed (stored status may be PASS
  // while the displayed grade is NG).
  const failed  = cell.status === "FAIL" || cell.status === "ABSENT" || cell.grade === "NG"
  const baseCls = cn(
    "border border-slate-700 text-center text-[11px] font-semibold px-1 py-1",
    failed && "text-rose-700",
  )

  // Grade Ledger — letter cells per pillar + total
  if (mode === "grade") {
    return (
      <>
        <td className={baseCls}>{cell.internalMax > 0 ? (cell.internalGrade ?? "—") : (isFinal ? "—" : "")}</td>
        {hasExternal && (
          <td className={baseCls}>{cell.externalMax > 0 ? (cell.externalGrade ?? "—") : (isFinal ? "—" : "")}</td>
        )}
        <td className={cn(baseCls, "font-bold")}>{cell.grade ?? "—"}</td>
      </>
    )
  }

  // Mark Ledger — obtained/max per pillar + total
  if (mode === "mark") {
    return (
      <>
        <td className={baseCls}>
          {cell.internalMax > 0
            ? <>{formatMark(cell.internalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.internalMax}</span></>
            : (isFinal ? "—" : "")}
        </td>
        {hasExternal && (
          <td className={baseCls}>
            {cell.externalMax > 0
              ? <>{formatMark(cell.externalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.externalMax}</span></>
              : (isFinal ? "—" : "")}
          </td>
        )}
        <td className={cn(baseCls, "font-bold")}>
          {cell.totalFull > 0
            ? <>{formatMark(cell.totalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.totalFull}</span></>
            : "—"}
        </td>
      </>
    )
  }

  // Grade & Mark Ledger — grade + mark side-by-side per pillar + total
  return (
    <>
      <td className={baseCls}>{cell.internalMax > 0 ? (cell.internalGrade ?? "—") : (isFinal ? "—" : "")}</td>
      <td className={baseCls}>
        {cell.internalMax > 0
          ? <>{formatMark(cell.internalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.internalMax}</span></>
          : (isFinal ? "—" : "")}
      </td>
      {hasExternal && (
        <>
          <td className={baseCls}>{cell.externalMax > 0 ? (cell.externalGrade ?? "—") : (isFinal ? "—" : "")}</td>
          <td className={baseCls}>
            {cell.externalMax > 0
              ? <>{formatMark(cell.externalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.externalMax}</span></>
              : (isFinal ? "—" : "")}
          </td>
        </>
      )}
      <td className={cn(baseCls, "font-bold")}>{cell.grade ?? "—"}</td>
      <td className={cn(baseCls, "font-bold")}>
        {cell.totalFull > 0
          ? <>{formatMark(cell.totalObtained, "integer")}<span className="text-slate-400 font-normal">/{cell.totalFull}</span></>
          : "—"}
      </td>
    </>
  )
}

function shortSubjectName(name: string): string {
  const upper = name.trim().toUpperCase()
  const map: Record<string, string> = {
    "NEPALI": "NEP",
    "ENGLISH": "ENG",
    "MATHEMATICS": "MATH",
    "SCIENCE": "SCI",
    "SCIENCE AND TECHNOLOGY": "SCI & TECH",
    "SCIENCE & TECHNOLOGY":   "SCI & TECH",
    "SOCIAL STUDIES": "SOC",
    "SOCIAL": "SOC",
    "OCCUPATION, BUSINESS AND TECHNOLOGY": "OBT",
    "HEALTH, PHYSICAL AND CREATIVE ARTS":   "HPCA",
    "NEPAL BHASA": "N.BHA",
    "COMPUTER":    "COM",
    "COMPUTER SCIENCE": "COM",
  }
  if (map[upper]) return map[upper]
  if (upper.length <= 8) return upper
  return upper.slice(0, 6) + "…"
}
