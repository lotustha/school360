"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight,
  ArrowLeft, Loader2, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { validateStudentImport, commitStudentImport } from "@/actions/students-bulk"
import {
  IMPORT_FIELDS, type ImportField, type ImportRow, type ImportRowResult,
} from "@/lib/student-import-schema"

type ClassOpt = { id: string; name: string; sections: { id: string; name: string }[] }

interface Props {
  schoolId: string
  slug:     string
  classes:  ClassOpt[]
}

type Step = 1 | 2 | 3 | 4

// User-friendly labels for each canonical field
const FIELD_LABEL: Record<ImportField, string> = {
  admissionNo:       "Admission # (upsert key)",
  fullName:          "Full Name",
  fullNameNepali:    "Full Name (Nepali)",
  email:             "Email",
  className:         "Class",
  sectionName:       "Section",
  rollNumber:        "Roll Number",
  symbolNumber:      "Symbol Number",
  nebRegistrationNo: "NEB Registration #",
  dobBS:             "Date of Birth (BS)",
  gender:            "Gender",
  bloodGroup:        "Blood Group",
  status:            "Status",
  religion:          "Religion",
  ethnicity:         "Ethnicity",
  motherTongue:      "Mother Tongue",
  province:          "Province",
  district:          "District",
  municipality:      "Municipality",
  wardNo:            "Ward No",
  street:            "Street/Tole",
}

// Loose keyword match for auto-detection
const AUTO_MATCH: Record<ImportField, string[]> = {
  admissionNo:       ["admission", "admno", "admissionnumber"],
  fullName:          ["fullname", "name", "studentname"],
  fullNameNepali:    ["nepali", "nepaliname", "namenp", "नाम"],
  email:             ["email", "mail"],
  className:         ["class", "grade", "classname"],
  sectionName:       ["section", "sec"],
  rollNumber:        ["roll", "rollno", "rollnumber"],
  symbolNumber:      ["symbol", "symbolno"],
  nebRegistrationNo: ["neb", "nebreg", "registrationno"],
  dobBS:             ["dob", "dateofbirth", "birthdate", "dobbs"],
  gender:            ["gender", "sex"],
  bloodGroup:        ["blood", "bloodgroup"],
  status:            ["status"],
  religion:          ["religion"],
  ethnicity:         ["ethnicity", "caste"],
  motherTongue:      ["mothertongue", "language"],
  province:          ["province"],
  district:          ["district"],
  municipality:      ["municipality", "vdc"],
  wardNo:            ["ward", "wardno", "wardnumber"],
  street:            ["street", "tole", "address"],
}

function loose(s: string): string {
  return s.toLowerCase().replace(/[\s_\-./()]+/g, "")
}

function autoDetect(header: string): ImportField | null {
  const k = loose(header)
  if (!k) return null
  for (const f of IMPORT_FIELDS) {
    if (loose(f) === k) return f
    for (const alias of AUTO_MATCH[f]) {
      if (k === alias || k.includes(alias)) return f
    }
  }
  return null
}

interface SheetData {
  sheetNames: string[]
  sheets:     Record<string, { headers: string[]; rows: string[][] }>
}

export function ImportWizard({ schoolId, slug, classes }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState<string>("")
  const [parsed,   setParsed]   = useState<SheetData | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>("")
  const [mapping, setMapping] = useState<Record<number, ImportField | "IGNORE">>({})
  const [results, setResults] = useState<ImportRowResult[]>([])
  const [committing, setCommitting] = useState(false)
  const [commitDone, setCommitDone] = useState<{ created: number; updated: number; failed: number } | null>(null)

  // ─── Step 1: parse file ────────────────────────────────────────────────────
  async function handleFile(f: File) {
    setFileName(f.name)
    try {
      const buf = await f.arrayBuffer()
      const XLSX = await import("xlsx")
      const wb = XLSX.read(buf, { type: "array" })
      const sheets: SheetData["sheets"] = {}
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name]
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" })
        if (data.length === 0) {
          sheets[name] = { headers: [], rows: [] }
          continue
        }
        const headers = (data[0] as string[]).map(h => String(h ?? "").trim())
        const rows    = data.slice(1).map(r => (r as string[]).map(c => String(c ?? "").trim()))
        // Drop trailing empty rows
        while (rows.length && rows[rows.length - 1].every(c => !c)) rows.pop()
        sheets[name] = { headers, rows }
      }
      const sheetData: SheetData = { sheetNames: wb.SheetNames, sheets }
      setParsed(sheetData)
      const first = wb.SheetNames[0]
      setActiveSheet(first)
      seedMapping(sheetData.sheets[first].headers)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read this file")
    }
  }

  function seedMapping(headers: string[]) {
    const next: Record<number, ImportField | "IGNORE"> = {}
    const taken = new Set<ImportField>()
    headers.forEach((h, i) => {
      const guess = autoDetect(h)
      if (guess && !taken.has(guess)) {
        next[i] = guess
        taken.add(guess)
      } else {
        next[i] = "IGNORE"
      }
    })
    setMapping(next)
  }

  function pickSheet(name: string) {
    if (!parsed) return
    setActiveSheet(name)
    seedMapping(parsed.sheets[name].headers)
  }

  // ─── Step 3: validate ──────────────────────────────────────────────────────
  function buildRowObjects(): ImportRow[] {
    if (!parsed) return []
    const s = parsed.sheets[activeSheet]
    if (!s) return []
    return s.rows.map(r => {
      const obj: ImportRow = {}
      r.forEach((cell, i) => {
        const target = mapping[i]
        if (!target || target === "IGNORE") return
        obj[target] = cell
      })
      return obj
    })
  }

  async function runValidate() {
    const rows = buildRowObjects()
    if (rows.length === 0) {
      toast.error("No rows to import.")
      return
    }
    startT(async () => {
      try {
        const out = await validateStudentImport(schoolId, slug, rows)
        setResults(out)
        setStep(3)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Validation failed")
      }
    })
  }

  // ─── Step 4: commit ────────────────────────────────────────────────────────
  function runCommit() {
    const rows = buildRowObjects()
    setCommitting(true)
    startT(async () => {
      try {
        const out = await commitStudentImport(schoolId, slug, rows)
        setCommitDone({ created: out.created, updated: out.updated, failed: out.failed.length })
        setStep(4)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed")
      } finally {
        setCommitting(false)
      }
    })
  }

  // ─── Counters for the preview ──────────────────────────────────────────────
  const counters = useMemo(() => {
    let create = 0, update = 0, skip = 0, withWarn = 0
    for (const r of results) {
      if (r.action === "create") create++
      else if (r.action === "update") update++
      else skip++
      if (r.warnings.length) withWarn++
    }
    return { create, update, skip, withWarn }
  }, [results])

  const usedFields = useMemo(() => {
    const used = new Set<ImportField>()
    for (const v of Object.values(mapping)) if (v && v !== "IGNORE") used.add(v)
    return used
  }, [mapping])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <StepBar step={step} />

      {step === 1 && (
        <DropZone
          fileRef={fileRef}
          onFile={handleFile}
          fileName={fileName}
        />
      )}

      {step === 2 && parsed && (
        <div className="space-y-4">
          {parsed.sheetNames.length > 1 && (
            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sheet</span>
              {parsed.sheetNames.map(n => (
                <button key={n} onClick={() => pickSheet(n)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
                    activeSheet === n
                      ? "bg-primary/10 text-primary border-primary/30 font-bold"
                      : "bg-white border-slate-200 text-slate-600 hover:border-primary/30",
                  )}>
                  {n}
                  <span className="ml-1 text-[10px] text-slate-400">
                    ({parsed.sheets[n].rows.length})
                  </span>
                </button>
              ))}
            </div>
          )}

          <MappingTable
            headers={parsed.sheets[activeSheet]?.headers ?? []}
            sampleRow={parsed.sheets[activeSheet]?.rows[0] ?? []}
            mapping={mapping}
            onChange={(idx, val) => setMapping(prev => ({ ...prev, [idx]: val }))}
            usedFields={usedFields}
          />

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { setStep(1); setParsed(null); setFileName("") }}
              className="gap-1.5 cursor-pointer text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Pick different file
            </Button>
            <div className="flex-1" />
            <Button onClick={runValidate} className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
              <ArrowRight className="w-4 h-4" /> Continue to preview
            </Button>
          </div>
        </div>
      )}

      {step === 3 && parsed && (
        <div className="space-y-4">
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 flex items-center gap-3 flex-wrap">
            <Pill color="emerald">{counters.create} create</Pill>
            <Pill color="blue">{counters.update} update</Pill>
            <Pill color="rose">{counters.skip} skip</Pill>
            {counters.withWarn > 0 && <Pill color="amber">{counters.withWarn} warning</Pill>}
            <div className="flex-1" />
            <span className="text-[10px] text-slate-400">{results.length} total rows</span>
          </div>

          <PreviewTable
            results={results}
            rows={parsed.sheets[activeSheet]?.rows ?? []}
            mapping={mapping}
            classes={classes}
          />

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="gap-1.5 cursor-pointer text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to mapping
            </Button>
            <div className="flex-1" />
            <Button onClick={runCommit} disabled={committing || counters.create + counters.update === 0}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
              {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Commit {counters.create + counters.update} change{counters.create + counters.update === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && commitDone && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Import complete</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <strong className="text-emerald-700">{commitDone.created}</strong> created,
              {" "}<strong className="text-blue-700">{commitDone.updated}</strong> updated
              {commitDone.failed > 0 && <>, <strong className="text-rose-700">{commitDone.failed}</strong> failed</>}
            </p>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Button variant="outline" onClick={() => {
              setStep(1); setParsed(null); setFileName("")
              setMapping({}); setResults([]); setCommitDone(null)
            }} className="gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" /> Import another file
            </Button>
            <Button onClick={() => router.push("/students")} className="gap-1.5 cursor-pointer font-bold">
              View students <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps = [
    { id: 1, label: "Upload" },
    { id: 2, label: "Map columns" },
    { id: 3, label: "Preview" },
    { id: 4, label: "Done" },
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

// ─── Drop zone ───────────────────────────────────────────────────────────────

function DropZone({
  fileRef, onFile, fileName,
}: {
  fileRef:  React.RefObject<HTMLInputElement | null>
  onFile:   (f: File) => void
  fileName: string
}) {
  const [drag, setDrag] = useState(false)
  return (
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
        "bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-dashed shadow-sm p-12 text-center cursor-pointer transition-all",
        drag
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-slate-200 hover:border-primary/40 hover:bg-slate-50/60",
      )}
    >
      <input ref={fileRef} type="file" className="hidden"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
      />
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Upload className="w-7 h-7 text-primary" />
      </div>
      <p className="font-bold text-sm text-slate-800">Drop xlsx, xls or csv file here</p>
      <p className="text-xs text-muted-foreground mt-1">…or click to browse</p>
      {fileName && (
        <p className="text-[11px] text-slate-500 mt-3 font-mono inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full">
          <FileSpreadsheet className="w-3 h-3" /> {fileName}
        </p>
      )}
      <div className="text-[11px] text-slate-400 mt-6 max-w-md mx-auto leading-relaxed">
        First row should contain column headers. Common header names like
        <code className="bg-slate-100 mx-1 px-1 rounded">Full Name</code>,
        <code className="bg-slate-100 mx-1 px-1 rounded">Admission #</code>,
        <code className="bg-slate-100 mx-1 px-1 rounded">Class</code> are auto-detected.
      </div>
    </div>
  )
}

// ─── Mapping table ───────────────────────────────────────────────────────────

function MappingTable({
  headers, sampleRow, mapping, onChange, usedFields,
}: {
  headers:   string[]
  sampleRow: string[]
  mapping:   Record<number, ImportField | "IGNORE">
  onChange:  (idx: number, val: ImportField | "IGNORE") => void
  usedFields: Set<ImportField>
}) {
  if (headers.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-8 text-center text-sm text-muted-foreground">
        No headers found in this sheet.
      </div>
    )
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-sm">Map columns</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick what each column means. Unmapped columns are ignored. <strong>Admission #</strong> is the
          upsert key — blank rows create new students.
        </p>
      </div>
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">Source column</th>
            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">Sample value</th>
            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">Maps to field</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => {
            const cur = mapping[i] ?? "IGNORE"
            return (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium text-slate-800">{h || <span className="text-slate-400 italic">(empty)</span>}</td>
                <td className="px-3 py-2 text-slate-500 font-mono truncate max-w-[200px]">{sampleRow[i] || <span className="text-slate-300 italic">—</span>}</td>
                <td className="px-3 py-2 min-w-[220px]">
                  <Select value={cur} onValueChange={v => onChange(i, v as ImportField | "IGNORE")}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IGNORE" className="text-xs">— Ignore this column —</SelectItem>
                      {IMPORT_FIELDS.map(f => {
                        const taken = usedFields.has(f) && cur !== f
                        return (
                          <SelectItem key={f} value={f} className="text-xs" disabled={taken}>
                            {FIELD_LABEL[f]}{taken && <span className="text-slate-300 ml-1">(used)</span>}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Preview table ───────────────────────────────────────────────────────────

function PreviewTable({
  results, rows, mapping, classes,
}: {
  results: ImportRowResult[]
  rows:    string[][]
  mapping: Record<number, ImportField | "IGNORE">
  classes: ClassOpt[]
}) {
  // Build per-row column display from the mapping
  function pick(rowIdx: number, field: ImportField): string {
    const i = Object.entries(mapping).find(([, v]) => v === field)?.[0]
    if (i === undefined) return ""
    return rows[rowIdx]?.[Number(i)] ?? ""
  }
  const classNames = new Set(classes.map(c => c.name.toLowerCase()))

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50/80 sticky top-0 z-10">
            <tr>
              <Th className="w-12">#</Th>
              <Th className="w-24">Action</Th>
              <Th>Name</Th>
              <Th>Class · Section</Th>
              <Th>Roll · Symbol</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const cls = pick(r.rowIndex, "className")
              const sec = pick(r.rowIndex, "sectionName")
              const cn1 = classNames.has(cls.toLowerCase())
              return (
                <tr key={r.rowIndex} className={cn(
                  "border-b border-slate-100 last:border-0",
                  r.action === "skip"   ? "bg-rose-50/30" :
                  r.action === "create" ? "bg-emerald-50/30" :
                                          "bg-blue-50/20",
                )}>
                  <td className="px-3 py-2 text-right text-[10px] tabular-nums text-slate-400 align-top">{r.rowIndex + 2}</td>
                  <td className="px-3 py-2 align-top">
                    <ActionBadge action={r.action} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-800">{pick(r.rowIndex, "fullName") || <span className="text-slate-300 italic">—</span>}</div>
                    {pick(r.rowIndex, "admissionNo") && (
                      <div className="text-[10px] text-slate-400 font-mono">{pick(r.rowIndex, "admissionNo")}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={cn("text-[11px]", !cn1 && cls && "text-rose-700 font-semibold")}>
                      {cls || <span className="text-slate-300 italic">—</span>}
                      {sec && <span className="text-slate-400"> · {sec}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-600">
                    {pick(r.rowIndex, "rollNumber") || "—"}
                    {pick(r.rowIndex, "symbolNumber") && <span className="text-slate-400"> · {pick(r.rowIndex, "symbolNumber")}</span>}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] space-y-0.5">
                    {r.errors.map((e, k) => (
                      <div key={`e${k}`} className="text-rose-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {e}
                      </div>
                    ))}
                    {r.warnings.map((w, k) => (
                      <div key={`w${k}`} className="text-amber-700">⚠ {w}</div>
                    ))}
                    {r.errors.length === 0 && r.warnings.length === 0 && (
                      <span className="text-slate-300 italic">Looks good</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: ImportRowResult["action"] }) {
  if (action === "create") return <Pill color="emerald">Create</Pill>
  if (action === "update") return <Pill color="blue">Update</Pill>
  return <Pill color="rose">Skip</Pill>
}

function Pill({ children, color }: { children: React.ReactNode; color: "amber" | "rose" | "emerald" | "blue" | "slate" }) {
  const cls =
    color === "amber"   ? "bg-amber-50 text-amber-700 border-amber-200" :
    color === "rose"    ? "bg-rose-50 text-rose-700 border-rose-200" :
    color === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    color === "blue"    ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
  return (
    <span className={cn("text-[10px] font-bold border rounded-full px-2.5 py-0.5 inline-flex items-center gap-1", cls)}>
      {children}
    </span>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500", className)}>
      {children}
    </th>
  )
}

