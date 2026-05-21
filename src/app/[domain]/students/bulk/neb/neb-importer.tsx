"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight, ArrowLeft,
  Loader2, Sparkles, ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff, Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar-img"
import { GlobalFiltersBar } from "@/components/ui/global-filters-bar"
import { cn } from "@/lib/utils"
import {
  applyNebImport, getStudentsForNebScope,
  type NebScopeStudent, type NebApplyItem,
} from "@/actions/students-bulk"
import { parseFlexibleDate, type Calendar } from "@/lib/flexible-date"

// ─── Props ───────────────────────────────────────────────────────────────────

export type ScopeFaculty = { id: string; name: string }
export type ScopeClass   = {
  id:           string
  name:         string
  facultyId:    string | null
  facultyName:  string | null
}

interface Props {
  schoolId:           string
  schoolSlug:         string
  faculties:          ScopeFaculty[]
  classes:            ScopeClass[]
  initialFacultyIds:  string[]
  initialClassIds:    string[]
  initialStudents:    NebScopeStudent[]
}

type Step = 1 | 2 | 3 | 4

// ─── Mapping field types ─────────────────────────────────────────────────────

type NebField = "name" | "nebRegistrationNo" | "dobBS"
const FIELD_LABEL: Record<NebField, string> = {
  name:              "Student Name",
  nebRegistrationNo: "NEB Reg. No",
  dobBS:             "Date of Birth",
}
const FIELD_HINTS: Record<NebField, string[]> = {
  name:              ["name", "fullname", "studentname"],
  nebRegistrationNo: ["neb", "regno", "registrationno", "regnumber"],
  dobBS:             ["dob", "dateofbirth", "birthdate", "janma", "dobbs"],
}

function loose(s: string): string { return s.toLowerCase().replace(/[\s_\-./()]+/g, "") }

function autoDetect(header: string): NebField | null {
  const k = loose(header)
  if (!k) return null
  for (const f of Object.keys(FIELD_HINTS) as NebField[]) {
    for (const h of FIELD_HINTS[f]) if (k === h || k.includes(h)) return f
  }
  return null
}

// ─── Name normalisation + Levenshtein ────────────────────────────────────────

function normName(s: string): string {
  return s.normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")     // strip Latin diacritics
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function nameCompare(a: string, b: string): number {
  return normName(a).localeCompare(normName(b), "ne", { sensitivity: "base" })
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length, n = b.length
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

type MatchTier = "exact" | "near" | "different"
function matchTier(a: string, b: string): MatchTier {
  if (normName(a) === normName(b)) return "exact"
  const d = levenshtein(a.trim(), b.trim())
  return d <= 3 ? "near" : "different"
}

// ─── Excel row shape ─────────────────────────────────────────────────────────

interface ExcelRow {
  sheetRow:    number   // 1-indexed original sheet row
  name:        string
  nebRegRaw:   string
  dobRaw:      string | Date | null
  /** dobAD/dobBS resolved at preview-time. null when DOB cell is blank. */
  resolvedDob: { dobAD: Date; dobBS: string } | null
  parseError:  string | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NebImporter({
  schoolId, schoolSlug, faculties, classes,
  initialFacultyIds, initialClassIds, initialStudents,
}: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [, startT]   = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Step state derived from URL: scope present + students loaded → at least step 2
  const hasValidScope = initialFacultyIds.length === 1 && initialClassIds.length > 0
  const [step, setStep] = useState<Step>(hasValidScope ? 2 : 1)

  // Calendar choice — persisted per school
  const [calendar, setCalendar] = useState<Calendar>("AD")
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const k = `school360.neb-calendar.${schoolSlug}`
      const saved = window.localStorage.getItem(k)
      if (saved === "AD" || saved === "BS") setCalendar(saved)
    } catch { /* ignore */ }
  }, [schoolSlug])
  function setAndPersistCalendar(next: Calendar) {
    setCalendar(next)
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`school360.neb-calendar.${schoolSlug}`, next) } catch {}
    }
  }

  // Upload state
  const [fileName, setFileName] = useState("")
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<NebField, number | null>>({
    name: null, nebRegistrationNo: null, dobBS: null,
  })

  // Alignment state — Excel rows sorted by name, students sorted by name
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([])
  const [excludedRows, setExcludedRows] = useState<{ sheetRow: number; reason: string }[]>([])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())   // studentIds skipped
  const [showExcluded, setShowExcluded] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null)

  // Refresh scope students when URL filters change
  const [scopeStudents, setScopeStudents] = useState<NebScopeStudent[]>(initialStudents)
  useEffect(() => {
    const fids = (searchParams.get("facultyId") ?? "").split(",").filter(Boolean)
    const cids = (searchParams.get("classId")   ?? "").split(",").filter(Boolean)
    if (cids.length === 0) {
      setScopeStudents([])
      if (step !== 1) setStep(1)
      return
    }
    let cancelled = false
    startT(async () => {
      try {
        const list = await getStudentsForNebScope({
          schoolId,
          classIds:   cids,
          facultyIds: fids.length > 0 ? fids : undefined,
        })
        if (!cancelled) {
          setScopeStudents(list)
          if (step === 1 && list.length > 0) setStep(2)
        }
      } catch {
        if (!cancelled) toast.error("Couldn't load students for the chosen scope")
      }
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  // ─── Sorted students (memoised) ──────────────────────────────────────────
  const sortedStudents = useMemo(() => {
    return [...scopeStudents].sort((a, b) => {
      const c = nameCompare(a.fullName, b.fullName)
      if (c !== 0) return c
      return a.admissionNo.localeCompare(b.admissionNo)
    })
  }, [scopeStudents])

  // ─── Step 2 → 3: parse + sort Excel ───────────────────────────────────────
  async function handleFile(f: File) {
    setFileName(f.name)
    try {
      const buf = await f.arrayBuffer()
      const XLSX = await import("xlsx")
      const wb = XLSX.read(buf, { type: "array", cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) { toast.error("No sheets found in file"); return }
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: true, defval: "" })
      if (data.length === 0) { toast.error("Sheet is empty"); return }
      const headers = (data[0] as string[]).map(h => String(h ?? "").trim())
      const rows    = data.slice(1) as unknown[][]
      // Drop trailing empty rows
      while (rows.length && (rows[rows.length - 1] as unknown[]).every(c => c == null || String(c).trim() === "")) {
        rows.pop()
      }
      setParsedHeaders(headers)
      setParsedRows(rows.map(r => r.map(c => c instanceof Date ? c.toISOString() : String(c ?? "").trim())))

      // Re-parse keeping Date instances for DOB column once mapping is picked.
      // We stash raw cells too to preserve Dates for parseFlexibleDate later.
      ;(rows as unknown as { _rawCells?: unknown[][] }[]).forEach((_, i) => {
        ;(rawCellsRef.current ??= [])[i] = rows[i]
      })

      // Auto-detect mapping
      const next: Record<NebField, number | null> = { name: null, nebRegistrationNo: null, dobBS: null }
      const taken = new Set<NebField>()
      headers.forEach((h, idx) => {
        const f = autoDetect(h)
        if (f && !taken.has(f)) { next[f] = idx; taken.add(f) }
      })
      setMapping(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read this file")
    }
  }
  const rawCellsRef = useRef<unknown[][] | null>(null)

  // Build sorted Excel rows + parse DOBs once mapping is complete
  function buildAndAdvance() {
    if (mapping.name == null) { toast.error("Map the Name column first"); return }
    const nameIdx = mapping.name!
    const nebIdx  = mapping.nebRegistrationNo
    const dobIdx  = mapping.dobBS

    const built: ExcelRow[]    = []
    const excluded: { sheetRow: number; reason: string }[] = []

    parsedRows.forEach((row, i) => {
      const sheetRow = i + 2   // header is row 1
      const nameCell = String(row[nameIdx] ?? "").trim()
      const nebCell  = nebIdx != null ? String(row[nebIdx] ?? "").trim() : ""
      const rawDob   = dobIdx != null ? (rawCellsRef.current?.[i]?.[dobIdx] ?? row[dobIdx] ?? "") : ""

      if (!nameCell) {
        excluded.push({ sheetRow, reason: "blank Name" })
        return
      }
      if (!nameCell && !nebCell && (!rawDob || String(rawDob).trim() === "")) {
        excluded.push({ sheetRow, reason: "all columns blank" })
        return
      }

      let resolvedDob: ExcelRow["resolvedDob"] = null
      let parseError: string | null = null
      if (rawDob && String(rawDob).trim() !== "") {
        try {
          const d = parseFlexibleDate(rawDob as string | Date, calendar)
          resolvedDob = { dobAD: d.dobAD, dobBS: d.dobBS }
        } catch (e) {
          parseError = e instanceof Error ? e.message : "Couldn't parse DOB"
        }
      }

      built.push({
        sheetRow,
        name:        nameCell,
        nebRegRaw:   nebCell,
        dobRaw:      rawDob as string | Date | null,
        resolvedDob,
        parseError,
      })
    })

    // Sort by normalized name (same comparator as students); tie-break by original sheet row
    built.sort((a, b) => {
      const c = nameCompare(a.name, b.name)
      if (c !== 0) return c
      return a.sheetRow - b.sheetRow
    })

    setExcelRows(built)
    setExcludedRows(excluded)
    setSkipped(new Set())
    setStep(3)
  }

  // ─── Swap Excel-side row with neighbour ──────────────────────────────────
  function swapExcel(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= excelRows.length) return
    setExcelRows(prev => {
      const next = [...prev]
      const tmp = next[index]; next[index] = next[j]; next[j] = tmp
      return next
    })
  }

  function resetOrder() {
    setExcelRows(prev => [...prev].sort((a, b) => {
      const c = nameCompare(a.name, b.name)
      if (c !== 0) return c
      return a.sheetRow - b.sheetRow
    }))
  }

  // ─── Apply to backend ────────────────────────────────────────────────────
  function commit() {
    const fids = (searchParams.get("facultyId") ?? "").split(",").filter(Boolean)
    const cids = (searchParams.get("classId") ?? "").split(",").filter(Boolean)
    if (cids.length === 0) { toast.error("Pick at least one class"); return }
    if (sortedStudents.length === 0 || excelRows.length === 0) {
      toast.error("Nothing to apply")
      return
    }
    if (sortedStudents.length !== excelRows.length) {
      toast.error("Student and Excel counts must match before committing")
      return
    }

    const items: NebApplyItem[] = []
    for (let i = 0; i < sortedStudents.length; i++) {
      const s = sortedStudents[i]
      if (skipped.has(s.id)) continue
      const e = excelRows[i]
      if (e.parseError) continue   // can't apply a bad row
      const it: NebApplyItem = { studentId: s.id }
      if (e.nebRegRaw)    it.nebRegistrationNo = e.nebRegRaw
      if (e.resolvedDob)  { it.dobAD = e.resolvedDob.dobAD; it.dobBS = e.resolvedDob.dobBS }
      // Skip rows that have nothing useful to write
      if (!it.nebRegistrationNo && !it.dobAD && !it.dobBS) continue
      items.push(it)
    }

    if (items.length === 0) {
      toast.error("Every row was skipped — nothing to commit")
      return
    }

    setCommitting(true)
    startT(async () => {
      try {
        const res = await applyNebImport(
          schoolId,
          { classIds: cids, facultyIds: fids.length > 0 ? fids : undefined },
          items,
        )
        setResult({ ok: res.ok.length, failed: res.failed.length })
        setStep(4)
        router.refresh()
        if (res.failed.length > 0) {
          toast.error(`Saved ${res.ok.length}, failed ${res.failed.length} (first: ${res.failed[0].error})`)
        } else {
          toast.success(`Applied to ${res.ok.length} students`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Commit failed")
      } finally {
        setCommitting(false)
      }
    })
  }

  // ─── Derived stats ────────────────────────────────────────────────────────
  const countsMatch = sortedStudents.length > 0 && sortedStudents.length === excelRows.length
  const overwriteCount = useMemo(() => {
    if (!countsMatch) return 0
    let n = 0
    for (let i = 0; i < sortedStudents.length; i++) {
      const s = sortedStudents[i]
      const e = excelRows[i]
      if (skipped.has(s.id)) continue
      if (s.nebRegistrationNo && e.nebRegRaw && s.nebRegistrationNo !== e.nebRegRaw) n++
    }
    return n
  }, [countsMatch, sortedStudents, excelRows, skipped])
  const parseErrorCount = excelRows.filter(e => e.parseError).length
  const skippedCount    = skipped.size

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <StepBar step={step} />

      {step === 1 && (
        <ScopeStep
          faculties={faculties}
          classes={classes}
          currentFacultyIds={(searchParams.get("facultyId") ?? "").split(",").filter(Boolean)}
          currentClassIds={(searchParams.get("classId") ?? "").split(",").filter(Boolean)}
          studentsCount={scopeStudents.length}
          onAdvance={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <UploadMapStep
          fileRef={fileRef}
          fileName={fileName}
          parsedHeaders={parsedHeaders}
          parsedRowCount={parsedRows.length}
          sampleRow={parsedRows[0] ?? []}
          mapping={mapping}
          setMapping={setMapping}
          onFile={handleFile}
          calendar={calendar}
          setCalendar={setAndPersistCalendar}
          onBack={() => {
            const params = new URLSearchParams(searchParams.toString())
            router.replace(`${pathname}?${params.toString()}`)
            setStep(1)
          }}
          onAdvance={buildAndAdvance}
        />
      )}

      {step === 3 && (
        <AlignmentStep
          students={sortedStudents}
          excelRows={excelRows}
          excludedRows={excludedRows}
          showExcluded={showExcluded}
          setShowExcluded={setShowExcluded}
          skipped={skipped}
          toggleSkip={(id) => setSkipped(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
          })}
          swapExcel={swapExcel}
          resetOrder={resetOrder}
          countsMatch={countsMatch}
          overwriteCount={overwriteCount}
          parseErrorCount={parseErrorCount}
          skippedCount={skippedCount}
          onBack={() => setStep(2)}
          onCommit={commit}
          committing={committing}
        />
      )}

      {step === 4 && result && (
        <ResultStep
          ok={result.ok}
          failed={result.failed}
          onReset={() => {
            setStep(1)
            setFileName(""); setParsedHeaders([]); setParsedRows([])
            setExcelRows([]); setExcludedRows([]); setSkipped(new Set())
            setMapping({ name: null, nebRegistrationNo: null, dobBS: null })
            setResult(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps = [
    { id: 1, label: "Scope"     },
    { id: 2, label: "Upload"    },
    { id: 3, label: "Alignment" },
    { id: 4, label: "Done"      },
  ]
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-1">
      {steps.map((s, i) => {
        const active = step === s.id
        const done   = step > s.id
        return (
          <div key={s.id} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
              done   ? "bg-primary text-primary-foreground" :
              active ? "bg-primary/10 text-primary ring-2 ring-primary/30" :
                       "bg-slate-100 text-slate-400",
            )}>
              {done ? <Check className="w-3 h-3" /> : s.id}
            </div>
            <span className={cn(
              "text-[11px] font-semibold whitespace-nowrap",
              active ? "text-primary" : done ? "text-slate-500" : "text-slate-300",
            )}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 min-w-[12px]", done ? "bg-primary/40" : "bg-slate-100")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScopeStep({
  faculties, classes, currentClassIds, studentsCount, onAdvance,
}: {
  faculties:         ScopeFaculty[]
  classes:           ScopeClass[]
  currentFacultyIds: string[]
  currentClassIds:   string[]
  studentsCount:     number
  onAdvance:         () => void
}) {
  const classOK   = currentClassIds.length > 0
  const canAdvance = classOK && studentsCount > 0

  // Cross-faculty pick is fine — surface it as info so users know they aren't
  // accidentally mixing streams.
  const facultiesInScope = new Set(
    classes
      .filter(c => currentClassIds.includes(c.id))
      .map(c => c.facultyName ?? "General")
  )
  const crossFaculty = facultiesInScope.size > 1

  return (
    <div className="space-y-4">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
          Scope (faculty is optional; pick one or more classes — can span multiple faculties)
        </p>
        <GlobalFiltersBar
          show={["facultyId", "classId"]}
          faculties={faculties}
          classes={classes}
        />
      </div>

      <div className={cn(
        "rounded-xl border px-4 py-3 text-xs flex items-center gap-2 flex-wrap",
        canAdvance
          ? "bg-emerald-50/60 border-emerald-100 text-emerald-700"
          : "bg-slate-50/60 border-slate-100 text-slate-600",
      )}>
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {!classOK ? "Pick at least one class." :
           studentsCount === 0 ? "No students in this scope." :
           crossFaculty
             ? `${studentsCount} student${studentsCount === 1 ? "" : "s"} across ${facultiesInScope.size} faculties — ready to continue.`
             : `${studentsCount} student${studentsCount === 1 ? "" : "s"} in scope — ready to continue.`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button onClick={onAdvance} disabled={!canAdvance}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
          <ArrowRight className="w-4 h-4" /> Continue
        </Button>
      </div>
    </div>
  )
}

function UploadMapStep({
  fileRef, fileName, parsedHeaders, parsedRowCount, sampleRow, mapping, setMapping,
  onFile, calendar, setCalendar, onBack, onAdvance,
}: {
  fileRef:        React.RefObject<HTMLInputElement | null>
  fileName:       string
  parsedHeaders:  string[]
  parsedRowCount: number
  sampleRow:      string[]
  mapping:        Record<NebField, number | null>
  setMapping:     (m: Record<NebField, number | null>) => void
  onFile:         (f: File) => void
  calendar:       Calendar
  setCalendar:    (c: Calendar) => void
  onBack:         () => void
  onAdvance:      () => void
}) {
  const [drag, setDrag] = useState(false)

  const allMapped = mapping.name != null
  // dob/neb are optional — but at least one must be mapped to be useful
  const anyDataField = mapping.nebRegistrationNo != null || mapping.dobBS != null

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-dashed shadow-sm p-8 text-center cursor-pointer transition-all",
          drag ? "border-primary bg-primary/5 scale-[1.01]"
               : parsedHeaders.length > 0
                 ? "border-slate-100"
                 : "border-slate-200 hover:border-primary/40 hover:bg-slate-50/60",
        )}
      >
        <input ref={fileRef} type="file" className="hidden"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
        />
        <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6 text-sky-600" />
        </div>
        <p className="font-bold text-sm text-slate-800">
          {parsedHeaders.length > 0
            ? `${parsedRowCount} row${parsedRowCount === 1 ? "" : "s"} loaded — pick a different file to replace`
            : "Drop the NEB-supplied xlsx here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Or click to browse · xlsx / xls / csv</p>
        {fileName && (
          <p className="text-[11px] text-slate-500 mt-3 font-mono inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full">
            <FileSpreadsheet className="w-3 h-3" /> {fileName}
          </p>
        )}
      </div>

      {/* Calendar toggle */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          DOB calendar
        </span>
        <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(["AD", "BS"] as Calendar[]).map(c => (
            <button key={c} onClick={() => setCalendar(c)}
              className={cn(
                "px-3 h-7 rounded-md text-xs font-bold transition-colors cursor-pointer",
                calendar === c ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}>
              {c}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 ml-2">
          NEB usually supplies dates in {calendar === "AD" ? "AD (Gregorian)" : "BS (Bikram Sambat)"}.
        </span>
      </div>

      {/* Mapping */}
      {parsedHeaders.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm">Map columns</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              We auto-detected what we could — verify before continuing.
            </p>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr>
                <Th width="w-32">Field</Th>
                <Th>Source column</Th>
                <Th>Sample value</Th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(FIELD_LABEL) as NebField[]).map(f => {
                const cur = mapping[f]
                const required = f === "name"
                return (
                  <tr key={f} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-bold text-slate-700">
                      {FIELD_LABEL[f]}{required && <span className="text-rose-600 ml-1">*</span>}
                      {!required && <span className="text-[10px] font-normal text-slate-400 ml-1">(opt)</span>}
                    </td>
                    <td className="px-3 py-2 min-w-[200px]">
                      <Select
                        value={cur != null ? String(cur) : "_NONE_"}
                        onValueChange={v => {
                          const idx = v === "_NONE_" ? null : Number(v)
                          // Drop other fields claiming the same column
                          const next: Record<NebField, number | null> = { ...mapping }
                          for (const k of Object.keys(next) as NebField[]) {
                            if (next[k] === idx) next[k] = null
                          }
                          next[f] = idx
                          setMapping(next)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_NONE_" className="text-xs">— Not in this file —</SelectItem>
                          {parsedHeaders.map((h, i) => (
                            <SelectItem key={i} value={String(i)} className="text-xs">
                              {h || `(column ${i + 1})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-slate-500 font-mono truncate max-w-[200px]">
                      {cur != null ? (sampleRow[cur] || <span className="text-slate-300 italic">—</span>) : <span className="text-slate-300 italic">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} className="gap-1.5 cursor-pointer text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Change scope
        </Button>
        <div className="flex-1" />
        <Button onClick={onAdvance}
          disabled={!allMapped || !anyDataField}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
          <ArrowRight className="w-4 h-4" /> Preview alignment
        </Button>
      </div>
    </div>
  )
}

function AlignmentStep({
  students, excelRows, excludedRows, showExcluded, setShowExcluded,
  skipped, toggleSkip, swapExcel, resetOrder,
  countsMatch, overwriteCount, parseErrorCount, skippedCount,
  onBack, onCommit, committing,
}: {
  students:        NebScopeStudent[]
  excelRows:       ExcelRow[]
  excludedRows:    { sheetRow: number; reason: string }[]
  showExcluded:    boolean
  setShowExcluded: (v: boolean) => void
  skipped:         Set<string>
  toggleSkip:      (id: string) => void
  swapExcel:       (index: number, dir: -1 | 1) => void
  resetOrder:      () => void
  countsMatch:     boolean
  overwriteCount:  number
  parseErrorCount: number
  skippedCount:    number
  onBack:          () => void
  onCommit:        () => void
  committing:      boolean
}) {
  const maxLen = Math.max(students.length, excelRows.length)
  const off    = Math.abs(students.length - excelRows.length)

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-slate-700">
          {students.length} student{students.length === 1 ? "" : "s"} · {excelRows.length} row{excelRows.length === 1 ? "" : "s"}
        </span>
        {countsMatch ? (
          <Pill color="emerald"><Check className="w-2.5 h-2.5" /> Aligned</Pill>
        ) : (
          <Pill color="rose"><AlertTriangle className="w-2.5 h-2.5" /> Off by {off}</Pill>
        )}
        {overwriteCount > 0 && (
          <Pill color="amber">
            <AlertTriangle className="w-2.5 h-2.5" />
            {overwriteCount} will replace existing NEB reg
          </Pill>
        )}
        {parseErrorCount > 0 && (
          <Pill color="rose">{parseErrorCount} DOB parse error{parseErrorCount === 1 ? "" : "s"}</Pill>
        )}
        {skippedCount > 0 && <Pill color="slate">{skippedCount} skipped</Pill>}

        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={resetOrder}
          className="gap-1.5 cursor-pointer text-xs h-8 text-slate-500 hover:bg-slate-100">
          <RotateCcw className="w-3 h-3" /> Reset order
        </Button>
        {excludedRows.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowExcluded(!showExcluded)}
            className="gap-1.5 cursor-pointer text-xs h-8">
            {showExcluded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {excludedRows.length} excluded
          </Button>
        )}
      </div>

      {/* Excluded rows disclosure */}
      {showExcluded && excludedRows.length > 0 && (
        <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-3 text-xs">
          <p className="font-bold text-amber-800 mb-1">Excluded rows ({excludedRows.length})</p>
          <p className="text-amber-700 leading-relaxed">
            These rows were stripped from the Excel side before sorting. Original sheet row numbers:
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {excludedRows.map(r => (
              <span key={r.sheetRow}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[10px] font-mono border border-amber-200 text-amber-700">
                row {r.sheetRow}
                <span className="text-amber-400">·</span>
                <span className="text-amber-500">{r.reason}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side alignment table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <table className="min-w-full text-xs border-separate border-spacing-0">
          <thead className="bg-slate-50/80 sticky top-0 z-10">
            <tr>
              <Th width="w-10">#</Th>
              <Th width="min-w-[260px]">Student (scope, sorted)</Th>
              <Th width="w-20">Match</Th>
              <Th width="min-w-[260px]">Excel row (sorted)</Th>
              <Th width="w-20">DOB</Th>
              <Th width="w-16">Skip</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxLen }, (_, i) => {
              const s = students[i] ?? null
              const e = excelRows[i] ?? null
              const tier: MatchTier | "no-row" | "no-student" =
                !s ? "no-student" :
                !e ? "no-row" :
                matchTier(s.fullName, e.name)
              return (
                <tr key={i} className={cn(
                  "border-b border-slate-100",
                  tier === "different" ? "bg-rose-50/40"  :
                  tier === "near"      ? "bg-amber-50/30" :
                  tier === "no-row"    ? "bg-rose-50/60"  :
                  tier === "no-student"? "bg-rose-50/60"  :
                                         "bg-white",
                )}>
                  <td className="px-2 py-1 text-right text-[10px] tabular-nums text-slate-400 align-middle">{i + 1}</td>
                  <td className="px-3 py-1.5 align-middle">
                    {s ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={s.fullName} url={s.avatarUrl} size={24} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                            {s.fullName}
                            {s.nebRegistrationNo && (
                              <span className="text-[9px] font-mono px-1 rounded bg-amber-50 text-amber-700 border border-amber-100"
                                title={`Will replace existing: ${s.nebRegistrationNo}`}>
                                exists
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {s.admissionNo} · {s.className}{s.sectionName ? ` · ${s.sectionName}` : ""}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-rose-600 italic">no student at this position</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <MatchPill tier={tier} />
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    {e ? (
                      <div className="flex items-start gap-1.5 min-w-0">
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button onClick={() => swapExcel(i, -1)} disabled={i === 0}
                            title="Move this Excel row up"
                            className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center">
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => swapExcel(i, +1)} disabled={i === excelRows.length - 1}
                            title="Move this Excel row down"
                            className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center">
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-700 truncate">{e.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            row {e.sheetRow}
                            {e.nebRegRaw && <span className="ml-1 text-emerald-700">· NEB {e.nebRegRaw}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-rose-600 italic">no Excel row at this position</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {e?.parseError ? (
                      <span className="text-[10px] text-rose-700 inline-flex items-center gap-0.5" title={e.parseError}>
                        <AlertTriangle className="w-3 h-3" /> err
                      </span>
                    ) : e?.resolvedDob ? (
                      <span className="text-[10px] font-mono text-slate-600" title={`AD: ${e.resolvedDob.dobAD.toISOString().slice(0, 10)}`}>
                        {e.resolvedDob.dobBS}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-middle text-center">
                    {s && (
                      <input type="checkbox"
                        checked={skipped.has(s.id)}
                        onChange={() => toggleSkip(s.id)}
                        title="Skip this pair on commit"
                        className="w-3.5 h-3.5 cursor-pointer accent-rose-500" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 flex-wrap z-30">
        <Button variant="ghost" onClick={onBack} className="gap-1.5 cursor-pointer text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to mapping
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-slate-500">
          {countsMatch
            ? `${students.length - skippedCount} pair${students.length - skippedCount === 1 ? "" : "s"} ready`
            : "Counts must match to commit"}
        </span>
        <Button onClick={onCommit}
          disabled={committing || !countsMatch || (students.length - skippedCount === 0)}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
          {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Apply NEB to {students.length - skippedCount} student{students.length - skippedCount === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  )
}

function MatchPill({ tier }: { tier: MatchTier | "no-row" | "no-student" }) {
  if (tier === "exact")      return <Pill color="emerald">✓ exact</Pill>
  if (tier === "near")       return <Pill color="amber">~ near</Pill>
  if (tier === "different")  return <Pill color="rose">⚠ different</Pill>
  return <Pill color="rose">⚠ —</Pill>
}

function ResultStep({
  ok, failed, onReset,
}: {
  ok:      number
  failed:  number
  onReset: () => void
}) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
        <Sparkles className="w-7 h-7 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">NEB applied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <strong className="text-emerald-700">{ok}</strong> student{ok === 1 ? "" : "s"} updated
          {failed > 0 && <>, <strong className="text-rose-700">{failed}</strong> failed</>}
        </p>
      </div>
      <div className="flex items-center gap-2 justify-center">
        <Button variant="outline" onClick={onReset} className="gap-1.5 cursor-pointer">
          <Upload className="w-4 h-4" /> Import another file
        </Button>
      </div>
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: "amber" | "rose" | "emerald" | "slate" }) {
  const cls =
    color === "amber"   ? "bg-amber-50 text-amber-700 border-amber-200" :
    color === "rose"    ? "bg-rose-50 text-rose-700 border-rose-200" :
    color === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
  return (
    <span className={cn("text-[10px] font-bold border rounded-full px-2.5 py-0.5 inline-flex items-center gap-1", cls)}>
      {children}
    </span>
  )
}

function Th({ children, width }: { children?: React.ReactNode; width?: string }) {
  return (
    <th className={cn(
      "text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap",
      width,
    )}>{children}</th>
  )
}
