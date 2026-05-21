"use client"

import { useMemo, useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  GraduationCap, Users, Search, ArrowDownToLine, Sparkles,
  Check, Loader2, RotateCcw, X, Replace, AlertTriangle,
  Columns3, Eye, EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { bulkUpdateStudents, type BulkStudentUpdate } from "@/actions/students-bulk"
import {
  NEPAL_DISTRICTS, EMIS_ETHNICITY_GROUPS, NEPAL_RELIGIONS,
  MOTHER_TONGUE_OPTIONS, BLOOD_GROUPS, GUARDIAN_RELATIONS, GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
} from "@/lib/nepal-data"

export type SectionOption = { id: string; name: string }
export type GridClass = { id: string; name: string; facultyName?: string | null; sections: SectionOption[] }

export type GridStudent = {
  id:                  string
  admissionNo:         string
  // Routing
  classId:             string
  sectionId:           string | null
  // Identity
  fullName:            string
  fullNameNepali:      string | null
  email:               string
  gender:              string
  dobBS:               string | null
  bloodGroup:          string | null
  // Numbers
  rollNumber:          string | null
  symbolNumber:        string | null
  nebRegistrationNo:   string | null
  // Demographics
  religion:            string | null
  caste:               string | null
  ethnicity:           string | null
  motherTongue:        string | null
  // Address
  province:            string | null
  district:            string | null
  municipality:        string | null
  wardNo:              string | null
  street:              string | null
  permanentAddress:    string | null
  temporaryAddress:    string | null
  // EMIS identity
  nationalIdNo:        string | null
  birthCertNo:         string | null
  nationality:         string | null
  // Academic history
  previousSchool:      string | null
  transferCertNo:      string | null
  // Status
  status:              string
  // Primary guardian (denormalized into row)
  guardianName:        string | null
  guardianRelation:    string | null
  guardianPhone:       string | null
  guardianEmail:       string | null
  guardianOccupation:  string | null
}

type FieldKey = Exclude<keyof GridStudent, "id" | "admissionNo">

type ColType  = "text" | "select" | "classSelect" | "sectionSelect"
type GroupId  = "identity" | "academic" | "numbers" | "demographics" | "address" | "emis" | "guardian" | "status"

interface ColumnDef {
  key:             FieldKey
  label:           string
  type:            ColType
  width:           string
  group:           GroupId
  options?:        { value: string; label: string }[]
  mono?:           boolean
  defaultVisible?: boolean
}

const GROUPS: { id: GroupId; label: string; dot: string; chip: string }[] = [
  { id: "identity",     label: "Identity",        dot: "bg-blue-500",    chip: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "academic",     label: "Class · Section", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "numbers",      label: "Numbers",         dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "demographics", label: "Demographics",    dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "address",      label: "Address",         dot: "bg-cyan-500",    chip: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { id: "emis",         label: "EMIS / ID",       dot: "bg-fuchsia-500", chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  { id: "guardian",     label: "Guardian",        dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "status",       label: "Status",          dot: "bg-slate-500",   chip: "bg-slate-100 text-slate-700 border-slate-200" },
]

const opt = (vs: readonly string[]) => vs.map(v => ({ value: v, label: v }))

const COLUMNS: ColumnDef[] = [
  // Identity
  { key: "fullName",       label: "Full Name", type: "text",   width: "min-w-[180px]", group: "identity", defaultVisible: true },
  { key: "fullNameNepali", label: "Name (NP)", type: "text",   width: "min-w-[160px]", group: "identity", defaultVisible: true },
  { key: "email",          label: "Email",     type: "text",   width: "min-w-[200px]", group: "identity" },
  { key: "gender",         label: "Gender",    type: "select", width: "min-w-[110px]", group: "identity", defaultVisible: true,
    options: opt(GENDER_OPTIONS) },
  { key: "dobBS",          label: "DOB (BS)",  type: "text",   width: "min-w-[110px]", group: "identity", defaultVisible: true, mono: true },
  { key: "bloodGroup",     label: "Blood",     type: "select", width: "min-w-[90px]",  group: "identity", defaultVisible: true,
    options: opt(BLOOD_GROUPS) },

  // Academic (class/section transfer)
  { key: "classId",   label: "Class",   type: "classSelect",   width: "min-w-[160px]", group: "academic" },
  { key: "sectionId", label: "Section", type: "sectionSelect", width: "min-w-[120px]", group: "academic" },

  // Numbers
  { key: "rollNumber",        label: "Roll",    type: "text", width: "min-w-[80px]",  group: "numbers", defaultVisible: true, mono: true },
  { key: "symbolNumber",      label: "Symbol",  type: "text", width: "min-w-[120px]", group: "numbers", defaultVisible: true, mono: true },
  { key: "nebRegistrationNo", label: "NEB Reg", type: "text", width: "min-w-[120px]", group: "numbers", defaultVisible: true, mono: true },

  // Demographics
  { key: "religion",     label: "Religion",      type: "select", width: "min-w-[130px]", group: "demographics",
    options: opt(NEPAL_RELIGIONS) },
  { key: "caste",        label: "Caste",         type: "select", width: "min-w-[150px]", group: "demographics",
    options: opt(EMIS_ETHNICITY_GROUPS) },
  { key: "ethnicity",    label: "Ethnicity",     type: "select", width: "min-w-[150px]", group: "demographics",
    options: opt(EMIS_ETHNICITY_GROUPS) },
  { key: "motherTongue", label: "Mother Tongue", type: "select", width: "min-w-[140px]", group: "demographics",
    options: opt(MOTHER_TONGUE_OPTIONS) },

  // Address
  { key: "province",         label: "Province",      type: "text",   width: "min-w-[130px]", group: "address" },
  { key: "district",         label: "District",      type: "select", width: "min-w-[150px]", group: "address",
    options: opt(NEPAL_DISTRICTS) },
  { key: "municipality",     label: "Municipality",  type: "text",   width: "min-w-[160px]", group: "address" },
  { key: "wardNo",           label: "Ward",          type: "text",   width: "min-w-[70px]",  group: "address", mono: true },
  { key: "street",           label: "Street",        type: "text",   width: "min-w-[160px]", group: "address" },
  { key: "permanentAddress", label: "Perm. Address", type: "text",   width: "min-w-[200px]", group: "address" },
  { key: "temporaryAddress", label: "Temp. Address", type: "text",   width: "min-w-[200px]", group: "address" },

  // EMIS / ID
  { key: "nationalIdNo",   label: "National ID",   type: "text",   width: "min-w-[140px]", group: "emis", mono: true },
  { key: "birthCertNo",    label: "Birth Cert",    type: "text",   width: "min-w-[140px]", group: "emis", mono: true },
  { key: "nationality",    label: "Nationality",   type: "select", width: "min-w-[120px]", group: "emis",
    options: opt(NATIONALITY_OPTIONS) },
  { key: "previousSchool", label: "Prev. School",  type: "text",   width: "min-w-[180px]", group: "emis" },
  { key: "transferCertNo", label: "Transfer Cert", type: "text",   width: "min-w-[140px]", group: "emis", mono: true },

  // Guardian (primary)
  { key: "guardianName",       label: "Guardian Name",  type: "text",   width: "min-w-[160px]", group: "guardian" },
  { key: "guardianRelation",   label: "Relation",       type: "select", width: "min-w-[110px]", group: "guardian",
    options: opt(GUARDIAN_RELATIONS) },
  { key: "guardianPhone",      label: "Guardian Phone", type: "text",   width: "min-w-[130px]", group: "guardian", mono: true },
  { key: "guardianEmail",      label: "Guardian Email", type: "text",   width: "min-w-[180px]", group: "guardian" },
  { key: "guardianOccupation", label: "Occupation",     type: "text",   width: "min-w-[140px]", group: "guardian" },

  // Status (always default-visible)
  { key: "status", label: "Status", type: "select", width: "min-w-[120px]", group: "status", defaultVisible: true,
    options: [
      { value: "ACTIVE",    label: "Active"    },
      { value: "LEFT",      label: "Left"      },
      { value: "GRADUATED", label: "Graduated" },
      { value: "SUSPENDED", label: "Suspended" },
    ],
  },
]

const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map(c => [c.key, c])) as Record<FieldKey, ColumnDef>

// Map grid keys → server-side payload keys. Guardian fields are nested via dot prefix.
const SERVER_KEY: Partial<Record<FieldKey, string>> = {
  guardianName:       "guardian.name",
  guardianRelation:   "guardian.relation",
  guardianPhone:      "guardian.phone",
  guardianEmail:      "guardian.email",
  guardianOccupation: "guardian.occupation",
}
function toServerKey(k: FieldKey): string { return SERVER_KEY[k] ?? k }

const STORAGE_VIS_KEY = "school360.students.bulk-edit.visible"

function defaultVisible(): FieldKey[] {
  return COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
}

function useVisibility(): [Set<FieldKey>, (keys: FieldKey[]) => void] {
  const [vis, setVis] = useState<Set<FieldKey>>(() => new Set(defaultVisible()))
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_VIS_KEY)
      if (!raw) return
      const arr = JSON.parse(raw) as FieldKey[]
      if (!Array.isArray(arr)) return
      const known = new Set(COLUMNS.map(c => c.key as string))
      const filtered = arr.filter(k => known.has(k as string)) as FieldKey[]
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (filtered.length > 0) setVis(new Set(filtered))
    } catch { /* ignore */ }
  }, [])
  function update(keys: FieldKey[]) {
    setVis(new Set(keys))
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_VIS_KEY, JSON.stringify(keys)) } catch {}
    }
  }
  return [vis, update]
}

const SECTION_NONE = "__NONE__"
const SELECT_NONE  = "__NONE__"

interface Props {
  schoolId: string
  classes:  GridClass[]
  students: GridStudent[]
}

export function EditGrid({ schoolId, classes, students }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [saving, setSaving] = useState(false)

  // Scope (which class/section to load into the grid)
  const [classId, setClassId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const cls = classes.find(c => c.id === classId)
  const sections = cls?.sections ?? []

  // Class lookups for transfer dropdowns
  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes])

  // Edits — Map<studentId, Partial<Record<FieldKey, string>>>
  const [edits, setEdits] = useState<Record<string, Partial<Record<FieldKey, string>>>>({})

  // Focused cell
  const [focus, setFocus] = useState<{ id: string; field: FieldKey } | null>(null)

  // Visible columns
  const [visible, setVisible] = useVisibility()

  // Find/replace
  const [findOpen, setFindOpen]       = useState(false)
  const [findTxt, setFindTxt]         = useState("")
  const [replaceTxt, setReplaceTxt]   = useState("")
  const [findCol, setFindCol]         = useState<FieldKey | "ALL">("ALL")

  // Visible columns array (in COLUMNS order, filtered by visibility)
  const visibleCols = useMemo(() => COLUMNS.filter(c => visible.has(c.key)), [visible])

  // ─── Scoped students ───────────────────────────────────────────────────────
  const rows = useMemo<GridStudent[]>(() => {
    if (!classId) return []
    return students.filter(s =>
      s.classId === classId &&
      (sectionId ? s.sectionId === sectionId : true),
    )
  }, [students, classId, sectionId])

  // ─── Cell helpers ──────────────────────────────────────────────────────────
  function originalValue(s: GridStudent, k: FieldKey): string {
    const v = s[k]
    return typeof v === "string" ? v : (v ?? "")
  }
  function displayedValue(s: GridStudent, k: FieldKey): string {
    const e = edits[s.id]?.[k]
    return e !== undefined ? e : originalValue(s, k)
  }
  function isCellDirty(s: GridStudent, k: FieldKey): boolean {
    const e = edits[s.id]?.[k]
    if (e === undefined) return false
    return e !== originalValue(s, k)
  }
  function setCell(s: GridStudent, k: FieldKey, next: string) {
    setEdits(prev => {
      const row = { ...(prev[s.id] ?? {}) }
      if (next === originalValue(s, k)) {
        delete row[k]
      } else {
        row[k] = next
      }
      // When class changes, also clear the section if it doesn't belong to the new class.
      if (k === "classId") {
        const newCls = classById.get(next)
        const currentSec = row.sectionId !== undefined ? row.sectionId : originalValue(s, "sectionId")
        if (currentSec && (!newCls || !newCls.sections.some(sx => sx.id === currentSec))) {
          if (originalValue(s, "sectionId") === "") {
            delete row.sectionId
          } else {
            row.sectionId = ""
          }
        }
      }
      const out = { ...prev }
      if (Object.keys(row).length === 0) delete out[s.id]
      else out[s.id] = row
      return out
    })
  }

  // ─── Fill operations ──────────────────────────────────────────────────────
  function fillDown(col: ColumnDef) {
    if (!focus || focus.field !== col.key) {
      toast.error("Click a cell in this column first, then fill down.")
      return
    }
    const anchorRow = rows.find(r => r.id === focus.id)
    if (!anchorRow) return
    const value = displayedValue(anchorRow, col.key)
    const startIdx = rows.findIndex(r => r.id === focus.id)
    if (startIdx < 0) return
    let changed = 0
    for (let i = startIdx + 1; i < rows.length; i++) {
      if (displayedValue(rows[i], col.key) !== value) {
        setCell(rows[i], col.key, value)
        changed++
      }
    }
    toast.success(`Filled ${changed} row${changed === 1 ? "" : "s"} with "${value || "(empty)"}"`)
  }

  function fillSequential(col: ColumnDef) {
    if (col.type !== "text") { toast.error("Sequential fill only works on text columns."); return }
    if (!focus || focus.field !== col.key) {
      toast.error("Click the starting cell in this column first.")
      return
    }
    const anchorRow = rows.find(r => r.id === focus.id)
    if (!anchorRow) return
    const anchor = displayedValue(anchorRow, col.key)
    const m = anchor.match(/^(.*?)(\d+)$/)
    if (!m) {
      toast.error(`Anchor cell "${anchor || "(empty)"}" must end with a number to fill sequentially.`)
      return
    }
    const prefix = m[1]
    const numStr = m[2]
    const padLen = numStr.length
    const startNum = parseInt(numStr, 10)
    const startIdx = rows.findIndex(r => r.id === focus.id)
    let changed = 0
    for (let i = startIdx + 1; i < rows.length; i++) {
      const next = `${prefix}${String(startNum + (i - startIdx)).padStart(padLen, "0")}`
      if (displayedValue(rows[i], col.key) !== next) {
        setCell(rows[i], col.key, next)
        changed++
      }
    }
    toast.success(`Filled ${changed} sequential row${changed === 1 ? "" : "s"}`)
  }

  function runReplace() {
    if (!findTxt) { toast.error("Enter the text to find."); return }
    const cols = findCol === "ALL"
      ? visibleCols.filter(c => c.type === "text").map(c => c.key)
      : [findCol]
    let count = 0
    for (const r of rows) {
      for (const k of cols) {
        const current = displayedValue(r, k)
        if (!current) continue
        if (current.includes(findTxt)) {
          const next = current.split(findTxt).join(replaceTxt)
          setCell(r, k, next)
          count++
        }
      }
    }
    toast.success(`Replaced ${count} cell${count === 1 ? "" : "s"}`)
  }

  // ─── Visibility helpers ───────────────────────────────────────────────────
  function toggleColumn(k: FieldKey) {
    const next = new Set(visible)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setVisible([...next])
  }
  function toggleGroup(g: GroupId) {
    const groupKeys = COLUMNS.filter(c => c.group === g).map(c => c.key)
    const allOn = groupKeys.every(k => visible.has(k))
    const next = new Set(visible)
    if (allOn) groupKeys.forEach(k => next.delete(k))
    else       groupKeys.forEach(k => next.add(k))
    setVisible([...next])
  }
  function resetVisible() { setVisible(defaultVisible()) }

  // ─── Diff stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let cells = 0
    const ids = new Set<string>()
    for (const r of rows) {
      const e = edits[r.id]
      if (!e) continue
      for (const k of Object.keys(e) as FieldKey[]) {
        if (isCellDirty(r, k)) { cells++; ids.add(r.id) }
      }
    }
    return { cells, rows: ids.size }
  }, [edits, rows])  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Commit / discard ────────────────────────────────────────────────────
  function discard() {
    if (stats.cells === 0) return
    setEdits({})
    toast.info("Discarded all changes")
  }

  function commit() {
    if (stats.cells === 0) { toast.info("Nothing to save."); return }
    const updates: BulkStudentUpdate[] = []
    for (const r of rows) {
      const e = edits[r.id]
      if (!e) continue
      const fields: Record<string, string | null> = {}
      let any = false
      for (const k of Object.keys(e) as FieldKey[]) {
        if (!isCellDirty(r, k)) continue
        const v = e[k]!
        fields[toServerKey(k)] = v === "" ? null : v
        any = true
      }
      if (any) updates.push({ studentId: r.id, fields })
    }
    setSaving(true)
    startT(async () => {
      try {
        const res = await bulkUpdateStudents(schoolId, updates)
        if (res.failed.length > 0) {
          toast.error(
            `Saved ${res.ok.length}, failed ${res.failed.length}. ` +
            `First error: ${res.failed[0].error}`,
          )
        } else {
          toast.success(`Saved ${res.ok.length} student${res.ok.length === 1 ? "" : "s"}`)
          setEdits({})
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Scope picker */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Scope</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledControl icon={GraduationCap} label="Class">
            <Select value={classId} onValueChange={v => { setClassId(v); setSectionId(""); setFocus(null) }}>
              <SelectTrigger className="h-10 bg-white text-sm"><SelectValue placeholder="Select class…" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.facultyName && <span className="ml-2 text-[10px] text-slate-400">{c.facultyName}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabeledControl>
          <LabeledControl icon={Users} label="Section (optional)">
            <Select
              value={sectionId || "ALL"}
              onValueChange={v => { setSectionId(v === "ALL" ? "" : v); setFocus(null) }}
              disabled={!classId || sections.length === 0}
            >
              <SelectTrigger className="h-10 bg-white text-sm">
                <SelectValue placeholder={sections.length ? "All sections" : "—"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sections</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </LabeledControl>
        </div>
      </div>

      {!classId ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">Pick a class to start editing</p>
          <p className="text-xs text-muted-foreground">Scoped edits prevent accidental school-wide changes.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">No active students in this scope.</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-3 flex items-center gap-2 flex-wrap">
            <ColumnsMenu
              visible={visible}
              onToggleColumn={toggleColumn}
              onToggleGroup={toggleGroup}
              onReset={resetVisible}
            />
            <Button size="sm" variant="outline" onClick={() => setFindOpen(o => !o)}
              className={cn("gap-1.5 cursor-pointer text-xs h-8 bg-white", findOpen && "bg-primary/5 border-primary/30 text-primary")}>
              <Search className="w-3.5 h-3.5" /> Find &amp; replace
            </Button>
            {focus && visible.has(focus.field) && (() => {
              const col = COLUMN_BY_KEY[focus.field]
              const focusedRow = rows.find(r => r.id === focus.id)
              return (
                <>
                  <div className="h-5 w-px bg-slate-200" />
                  <span className="text-[10px] text-slate-500">
                    Anchor: <code className="font-mono font-bold text-slate-700">{col.label}</code> on
                    <span className="text-slate-700 font-semibold ml-1">
                      {focusedRow?.fullName ?? "—"}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => fillDown(col)}
                    className="gap-1.5 cursor-pointer text-xs h-8">
                    <ArrowDownToLine className="w-3.5 h-3.5" /> Fill down
                  </Button>
                  {col.type === "text" && (
                    <Button size="sm" variant="ghost" onClick={() => fillSequential(col)}
                      className="gap-1.5 cursor-pointer text-xs h-8">
                      <Sparkles className="w-3.5 h-3.5" /> Fill 01, 02…
                    </Button>
                  )}
                </>
              )
            })()}
            <div className="flex-1" />
            <span className="text-[10px] text-slate-400">
              {rows.length} student{rows.length === 1 ? "" : "s"} · {visibleCols.length} column{visibleCols.length === 1 ? "" : "s"}
            </span>
          </div>

          {findOpen && (
            <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-3 flex items-end gap-2 flex-wrap">
              <LabeledControl label="Find">
                <Input value={findTxt} onChange={e => setFindTxt(e.target.value)}
                  placeholder="text to find" className="h-9 bg-white text-sm" />
              </LabeledControl>
              <LabeledControl label="Replace with">
                <Input value={replaceTxt} onChange={e => setReplaceTxt(e.target.value)}
                  placeholder="replacement" className="h-9 bg-white text-sm" />
              </LabeledControl>
              <LabeledControl label="In column">
                <Select value={findCol} onValueChange={v => setFindCol(v as FieldKey | "ALL")}>
                  <SelectTrigger className="h-9 bg-white text-sm min-w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All visible text columns</SelectItem>
                    {visibleCols.filter(c => c.type === "text").map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledControl>
              <Button size="sm" onClick={runReplace} className="gap-1.5 cursor-pointer text-xs h-9">
                <Replace className="w-3.5 h-3.5" /> Replace all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFindOpen(false)}
                className="gap-1.5 cursor-pointer text-xs h-9">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Grid */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-x-auto">
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 backdrop-blur-xl">
                  <th className="text-left px-3 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 sticky left-0 bg-slate-50/95 z-20 min-w-[180px]">
                    Student
                  </th>
                  {visibleCols.map(col => {
                    const meta = GROUPS.find(g => g.id === col.group)
                    return (
                      <th key={col.key}
                        className={cn(
                          "text-left px-2 py-2 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500",
                          col.width,
                        )}>
                        <div className="flex items-center gap-1.5">
                          {meta && <span className={cn("inline-block w-1.5 h-1.5 rounded-full", meta.dot)} title={meta.label} />}
                          <span>{col.label}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="group hover:bg-primary/[0.02] transition-colors">
                    <td className="px-3 py-1 border-b border-slate-100 sticky left-0 bg-white/95 group-hover:bg-primary/[0.03] backdrop-blur-xl z-10 align-middle">
                      <div className="text-sm font-semibold text-slate-800 truncate">{r.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{r.admissionNo}</div>
                    </td>
                    {visibleCols.map(col => {
                      const dirty = isCellDirty(r, col.key)
                      // sectionSelect needs to know the row's *current* (possibly edited) classId
                      const sectionsForRow = col.type === "sectionSelect"
                        ? (classById.get(displayedValue(r, "classId"))?.sections ?? [])
                        : []
                      return (
                        <td key={col.key}
                          className={cn(
                            "px-1 py-1 border-b border-slate-100 align-middle",
                            dirty && "bg-amber-50/70",
                            focus?.id === r.id && focus?.field === col.key && "ring-2 ring-primary/40 ring-inset",
                          )}
                          onClick={() => setFocus({ id: r.id, field: col.key })}
                        >
                          <Cell
                            value={displayedValue(r, col.key)}
                            col={col}
                            dirty={dirty}
                            classes={classes}
                            sectionsForRow={sectionsForRow}
                            onChange={(v) => setCell(r, col.key, v)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Bottom action bar */}
      {stats.cells > 0 && (
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 flex-wrap z-30">
          <div className="text-xs text-slate-600">
            <strong className="text-amber-700">{stats.cells}</strong> cell{stats.cells === 1 ? "" : "s"} changed across
            {" "}<strong className="text-amber-700">{stats.rows}</strong> student{stats.rows === 1 ? "" : "s"}
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={discard} disabled={saving}
            className="gap-1.5 cursor-pointer text-xs text-rose-600 hover:bg-rose-50">
            <RotateCcw className="w-3.5 h-3.5" /> Discard
          </Button>
          <Button size="sm" onClick={commit} disabled={saving}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save {stats.cells} change{stats.cells === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      <UnsavedGuard hasChanges={stats.cells > 0} />
    </div>
  )
}

// ─── Columns menu ────────────────────────────────────────────────────────────

function ColumnsMenu({
  visible, onToggleColumn, onToggleGroup, onReset,
}: {
  visible:        Set<FieldKey>
  onToggleColumn: (k: FieldKey) => void
  onToggleGroup:  (g: GroupId) => void
  onReset:        () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
          <Columns3 className="w-3.5 h-3.5" /> Columns
          <span className="text-slate-400">({visible.size})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl max-h-[70vh] overflow-y-auto w-72"
      >
        <div className="px-2 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Show columns</span>
          <button onClick={onReset} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">
            Reset
          </button>
        </div>
        {GROUPS.map(g => {
          const groupCols = COLUMNS.filter(c => c.group === g.id)
          if (groupCols.length === 0) return null
          const allOn = groupCols.every(c => visible.has(c.key))
          return (
            <div key={g.id}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold", g.chip)}>
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full", g.dot)} />
                  {g.label}
                </span>
                <button
                  onClick={() => onToggleGroup(g.id)}
                  className="text-[10px] text-slate-500 hover:text-primary font-semibold cursor-pointer flex items-center gap-1"
                >
                  {allOn ? <><EyeOff className="w-3 h-3" /> Hide all</> : <><Eye className="w-3 h-3" /> Show all</>}
                </button>
              </DropdownMenuLabel>
              {groupCols.map(c => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visible.has(c.key)}
                  onCheckedChange={() => onToggleColumn(c.key)}
                  className="cursor-pointer text-xs"
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Cell editor ─────────────────────────────────────────────────────────────

function Cell({
  value, col, dirty, classes, sectionsForRow, onChange,
}: {
  value:          string
  col:            ColumnDef
  dirty:          boolean
  classes:        GridClass[]
  sectionsForRow: SectionOption[]
  onChange:       (v: string) => void
}) {
  if (col.type === "classSelect") {
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className={cn(
          "h-8 text-xs bg-white border-slate-200",
          dirty && "border-amber-400 bg-amber-50/40",
        )}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {classes.map(c => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.name}
              {c.facultyName && <span className="ml-1 text-[10px] text-slate-400">{c.facultyName}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (col.type === "sectionSelect") {
    return (
      <Select
        value={value || SECTION_NONE}
        onValueChange={v => onChange(v === SECTION_NONE ? "" : v)}
        disabled={sectionsForRow.length === 0}
      >
        <SelectTrigger className={cn(
          "h-8 text-xs bg-white border-slate-200",
          dirty && "border-amber-400 bg-amber-50/40",
        )}>
          <SelectValue placeholder={sectionsForRow.length ? "—" : "no sections"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SECTION_NONE} className="text-xs text-slate-400">(none)</SelectItem>
          {sectionsForRow.map(s => (
            <SelectItem key={s.id} value={s.id} className="text-xs">Section {s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (col.type === "select") {
    return (
      <Select value={value || SELECT_NONE} onValueChange={v => onChange(v === SELECT_NONE ? "" : v)}>
        <SelectTrigger className={cn(
          "h-8 text-xs bg-white border-slate-200",
          dirty && "border-amber-400 bg-amber-50/40",
          col.mono && "font-mono",
        )}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_NONE} className="text-xs text-slate-400">(none)</SelectItem>
          {col.options!.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      className={cn(
        "h-8 text-xs bg-white border-slate-200 focus:ring-2 focus:ring-primary/20",
        dirty && "border-amber-400 bg-amber-50/40",
        col.mono && "font-mono",
      )}
    />
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function LabeledControl({
  icon: Icon, label, children,
}: {
  icon?: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5 flex-1 min-w-[140px]">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      {children}
    </div>
  )
}

function UnsavedGuard({ hasChanges }: { hasChanges: boolean }) {
  const ref = useRef(hasChanges)
  useEffect(() => { ref.current = hasChanges }, [hasChanges])
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!ref.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])
  if (!hasChanges) return null
  return (
    <div className="fixed top-2 right-2 z-50 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-1 shadow-sm flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Unsaved changes
    </div>
  )
}
