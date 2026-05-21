"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  Printer, ArrowLeft, Settings2, ListChecks, ArrowDownAZ, ArrowUpAZ,
  Plus, X, Check, Pencil, GripVertical,
} from "lucide-react"
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuRadioItem, DropdownMenuRadioGroup,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type PrintMode = "ptm" | "tour" | "roster" | "current"

export type PrintRow = {
  id:                string
  admissionNo:       string
  rollNumber:        string | null
  name:              string
  fullNameNepali:    string | null
  className:         string
  sectionName:       string | null
  gender:            string
  status:            string
  nebRegistrationNo: string | null
  symbolNumber:      string | null
  dobBS:             string | null
  guardian:          string | null
  guardianPhone:     string | null
  guardianRelation:  string | null
}

type ColKey =
  | "admNo" | "roll" | "symbolNo" | "nebReg"
  | "name" | "nameNepali"
  | "classSection" | "gender" | "dob"
  | "guardian" | "phone"

type SortField = "none" | "name" | "roll" | "symbolNo" | "admNo"
type SortDir   = "asc" | "desc"

const COL_DEFS: Record<ColKey, {
  label: string
  w?: string
  align?: "center"
  mono?: boolean
  render: (r: PrintRow) => React.ReactNode
}> = {
  admNo:        { label: "Adm No",        w: "w-20", mono: true,    render: r => r.admissionNo },
  roll:         { label: "Roll",          w: "w-14", align: "center", render: r => r.rollNumber ?? "—" },
  symbolNo:     { label: "Symbol",        w: "w-20", align: "center", mono: true, render: r => r.symbolNumber ?? "" },
  nebReg:       { label: "NEB Reg",       w: "w-28", mono: true,    render: r => r.nebRegistrationNo ?? "" },
  name:         { label: "Name",          render: r => r.name },
  nameNepali:   { label: "Name (Nepali)", render: r => r.fullNameNepali ?? "" },
  classSection: { label: "Class · Sec",   w: "w-24", align: "center", render: r => `${r.className}${r.sectionName ? ` · ${r.sectionName}` : ""}` },
  gender:       { label: "Gender",        w: "w-16", align: "center", render: r => r.gender },
  dob:          { label: "DOB (BS)",      w: "w-24", align: "center", render: r => r.dobBS ?? "" },
  guardian:     { label: "Guardian",      render: r => r.guardian ? `${r.guardian}${r.guardianRelation ? ` (${r.guardianRelation})` : ""}` : "" },
  phone:        { label: "Phone",         w: "w-28", render: r => r.guardianPhone ?? "" },
}

const ALL_COL_KEYS: ColKey[] = [
  "roll", "name", "nameNepali", "gender", "dob",
  "admNo", "symbolNo", "nebReg", "classSection",
  "guardian", "phone",
]

const MODE_PRESETS: Record<PrintMode, {
  defaultTitle:       string
  defaultOrientation: "portrait" | "landscape"
  defaultCols:        ColKey[]
  defaultSort:        SortField
  extras:             ("present" | "timeOutIn" | "signature")[]
}> = {
  ptm:     { defaultTitle: "Teacher–Parent Meeting Sign-In", defaultOrientation: "portrait",  defaultCols: ["roll", "name", "classSection", "guardian"], defaultSort: "roll", extras: ["signature"] },
  tour:    { defaultTitle: "Tour Attendance Register",       defaultOrientation: "landscape", defaultCols: ["roll", "name", "classSection", "phone"],    defaultSort: "roll", extras: ["present", "timeOutIn", "signature"] },
  roster:  { defaultTitle: "Class Roster",                   defaultOrientation: "portrait",  defaultCols: ["roll", "name", "gender", "guardian", "phone"], defaultSort: "roll", extras: [] },
  current: { defaultTitle: "Student List",                   defaultOrientation: "landscape", defaultCols: ["roll", "name", "gender", "guardian", "phone"], defaultSort: "name", extras: [] },
}

// Map from main-page column keys (`cols=` URL param) to print column keys
const MAIN_TO_PRINT_COL: Record<string, ColKey | null> = {
  admissionNo:  "admNo",
  name:         "name",
  rollNumber:   "roll",
  classSection: "classSection",
  gender:       "gender",
  dob:          "dob",
  guardian:     "guardian",
  phone:        "phone",
  nebReg:       "nebReg",
  symbolNo:     "symbolNo",
  email:        null,
  status:       null,
  index:        null,
  actions:      null,
  indicators:   null,
}

type ActiveItem =
  | { kind: "pre";    key:   ColKey }
  | { kind: "custom"; label: string }

function getItemId(a: ActiveItem): string {
  return a.kind === "pre" ? `pre:${a.key}` : `cu:${a.label}`
}

interface Props {
  mode:              PrintMode
  cols:              string[]
  title:             string
  date:              string
  scopeLabel:        string
  narrowedToClass:   boolean
  className:         string | null
  sectionName:       string | null
  academicYearLabel: string | null
  school:            { name: string; address: string | null; logoUrl: string | null }
  rows:              PrintRow[]
}

export function PrintView({
  mode, cols: initialColsRaw, title, date, scopeLabel,
  narrowedToClass, className, sectionName, academicYearLabel,
  school, rows,
}: Props) {
  const preset       = MODE_PRESETS[mode]
  const searchParams = useSearchParams()

  // Resolve initial columns
  const initialCols: ColKey[] = useMemo(() => {
    let resolved: ColKey[]
    if (mode === "current" && initialColsRaw.length > 0) {
      resolved = initialColsRaw
        .map(k => MAIN_TO_PRINT_COL[k])
        .filter((k): k is ColKey => !!k)
    } else if (initialColsRaw.length > 0) {
      resolved = initialColsRaw.filter((k): k is ColKey => k in COL_DEFS)
    } else {
      resolved = [...preset.defaultCols]
    }
    // Auto-drop classSection when scope is already a single class — class moves to header
    if (narrowedToClass) {
      resolved = resolved.filter(k => k !== "classSection")
    }
    if (resolved.length === 0) resolved = ["roll", "name"]
    return resolved
  }, [mode, initialColsRaw, narrowedToClass, preset.defaultCols])

  // Unified active list — predefined + custom columns in render order.
  // Drag-reorder operates on this list directly.
  const [active, setActive] = useState<ActiveItem[]>(
    () => initialCols.map(k => ({ kind: "pre" as const, key: k }))
  )
  const cols = useMemo(
    () => active.filter((a): a is { kind: "pre"; key: ColKey } => a.kind === "pre").map(a => a.key),
    [active]
  )
  const customCols = useMemo(
    () => active.filter((a): a is { kind: "custom"; label: string } => a.kind === "custom").map(a => a.label),
    [active]
  )
  const [customInput, setCustomInput] = useState("")

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [sortField,    setSortField]    = useState<SortField>(
    (searchParams.get("printSort") as SortField) || preset.defaultSort
  )
  const [sortDir,      setSortDir]      = useState<SortDir>(
    (searchParams.get("printDir") as SortDir) || "asc"
  )
  const [titleVal,     setTitleVal]     = useState(title || preset.defaultTitle)
  const [dateVal,      setDateVal]      = useState(date  || todayStr())
  const [showSettings, setShowSettings] = useState(false)
  const [orientation,  setOrientation]  = useState<"portrait" | "landscape">(preset.defaultOrientation)

  const sortedRows = useMemo(() => {
    if (sortField === "none") return rows
    const dirMul = sortDir === "desc" ? -1 : 1
    const get = (r: PrintRow): string => {
      switch (sortField) {
        case "name":     return r.name.toLowerCase()
        case "roll":     return r.rollNumber    ? padNum(r.rollNumber)    : "~~~"
        case "symbolNo": return r.symbolNumber  ? padNum(r.symbolNumber)  : "~~~"
        case "admNo":    return r.admissionNo.toLowerCase()
        default:         return ""
      }
    }
    return [...rows].sort((a, b) => {
      const av = get(a), bv = get(b)
      if (av < bv) return -1 * dirMul
      if (av > bv) return  1 * dirMul
      return 0
    })
  }, [rows, sortField, sortDir])

  function togglePre(key: ColKey) {
    setActive(prev => {
      const idx = prev.findIndex(a => a.kind === "pre" && a.key === key)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, { kind: "pre" as const, key }]
    })
  }
  function addCustomCol() {
    const val = customInput.trim()
    if (!val) return
    const dupCustom = active.some(a => a.kind === "custom" && a.label === val)
    const dupPre    = active.some(a => a.kind === "pre" && COL_DEFS[a.key].label.toLowerCase() === val.toLowerCase())
    if (dupCustom || dupPre) { setCustomInput(""); return }
    setActive(prev => [...prev, { kind: "custom" as const, label: val }])
    setCustomInput("")
  }
  function removeCustomCol(name: string) {
    setActive(prev => prev.filter(a => !(a.kind === "custom" && a.label === name)))
  }
  function handleColDragEnd(e: DragEndEvent) {
    const { active: dragged, over } = e
    if (!over || dragged.id === over.id) return
    const ids = active.map(getItemId)
    const oldIdx = ids.indexOf(dragged.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    setActive(arrayMove(active, oldIdx, newIdx))
  }

  function doPrint() { window.print() }

  const SORT_OPTS: { field: SortField; label: string }[] = [
    { field: "name",     label: "Name" },
    { field: "roll",     label: "Roll No" },
    { field: "symbolNo", label: "Symbol No" },
    { field: "admNo",    label: "Adm No" },
    { field: "none",     label: "Original order" },
  ]
  const activeSortLabel = SORT_OPTS.find(o => o.field === sortField)?.label ?? "None"

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 ${orientation};
          margin: 12mm 10mm 14mm 10mm;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-table { font-size: 10.5pt; }
          .print-table th, .print-table td { border: 0.6pt solid #475569 !important; }
          .signature-cell { height: 28pt; }
          .checkbox-cell  { text-align: center; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      {/* Top toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1.5 text-xs cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {sortedRows.length} student{sortedRows.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer bg-white/80">
                  {sortDir === "asc"
                    ? <ArrowUpAZ   className="w-3.5 h-3.5" />
                    : <ArrowDownAZ className="w-3.5 h-3.5" />}
                  Sort: <span className="font-bold">{activeSortLabel}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Sort by
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortField} onValueChange={v => setSortField(v as SortField)}>
                  {SORT_OPTS.map(o => (
                    <DropdownMenuRadioItem key={o.field} value={o.field} className="text-xs cursor-pointer">
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Direction
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortDir} onValueChange={v => setSortDir(v as SortDir)}>
                  <DropdownMenuRadioItem value="asc"  className="text-xs cursor-pointer">Ascending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc" className="text-xs cursor-pointer">Descending</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns + custom typed columns */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer bg-white/80">
                  <ListChecks className="w-3.5 h-3.5" /> Columns
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                    ({cols.length + customCols.length})
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    Active columns — drag to reorder
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">{active.length}</span>
                </div>
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {active.length === 0 ? (
                      <p className="text-xs text-slate-400 italic px-3 py-3 text-center">
                        No columns selected.
                      </p>
                    ) : (
                      <SortableContext items={active.map(getItemId)} strategy={verticalListSortingStrategy}>
                        {active.map(item => (
                          <SortableActiveRow key={getItemId(item)} item={item} onRemoveCustom={removeCustomCol}
                            onRemovePre={(k) => togglePre(k)} />
                        ))}
                      </SortableContext>
                    )}
                  </div>
                </DndContext>

                {/* Available predefined columns (not yet active) */}
                {ALL_COL_KEYS.some(k => !cols.includes(k)) && (
                  <>
                    <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        Add predefined
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto pb-1">
                      {ALL_COL_KEYS.filter(k => !cols.includes(k)).map(k => (
                        <button key={k} type="button" onClick={() => togglePre(k)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-left">
                          <span className="w-4 h-4 rounded border-2 border-slate-300 bg-white flex items-center justify-center flex-shrink-0">
                            <Plus className="w-2.5 h-2.5 text-slate-400" />
                          </span>
                          <span className="flex-1 truncate text-slate-600">{COL_DEFS[k].label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="border-t border-slate-100 p-2 bg-slate-50/40">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 px-1 flex items-center gap-1.5">
                    <Pencil className="w-3 h-3 text-violet-500" /> Add custom column
                  </label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); addCustomCol() }
                      }}
                      placeholder="e.g. Remarks, Marks, Address"
                      className="h-7 text-xs flex-1"
                    />
                    <Button type="button" size="icon" variant="default"
                      onClick={addCustomCol}
                      disabled={!customInput.trim()}
                      title="Add (Enter)"
                      className="h-7 w-7 cursor-pointer shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 px-1">
                    Empty fillable cell appears in printout
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}
              className="gap-1.5 text-xs cursor-pointer bg-white/80">
              <Settings2 className="w-3.5 h-3.5" /> Page
            </Button>
            <Button size="sm" onClick={doPrint}
              className="gap-1.5 text-xs cursor-pointer bg-primary hover:bg-primary/90">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>
        {showSettings && (
          <div className="max-w-[1200px] mx-auto px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</label>
              <Input value={titleVal} onChange={e => setTitleVal(e.target.value)} className="h-8 text-sm w-72" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date</label>
              <Input value={dateVal} onChange={e => setDateVal(e.target.value)} placeholder="2082 Jestha 02" className="h-8 text-sm w-52" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Orientation</label>
              <div className="flex h-8 rounded-md border border-slate-200 overflow-hidden bg-white text-xs">
                {(["portrait", "landscape"] as const).map(o => (
                  <button key={o} onClick={() => setOrientation(o)}
                    className={cn(
                      "px-3 cursor-pointer transition-colors capitalize",
                      orientation === o ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >{o}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print sheet */}
      <div className="bg-slate-100 min-h-screen py-6 print:py-0 print:bg-white">
        <div className="print-page max-w-[1100px] mx-auto bg-white shadow-sm border border-slate-200 p-8 print:p-0">
          {/* Letterhead */}
          <header className="flex items-start gap-4 pb-3 border-b-2 border-slate-800">
            {school.logoUrl ? (
              <Image src={school.logoUrl} alt="" width={56} height={56}
                className="w-14 h-14 object-contain" unoptimized />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black text-lg">
                {school.name.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-black tracking-tight text-slate-900">{school.name}</h1>
              {school.address && <p className="text-[11px] text-slate-600 mt-0.5">{school.address}</p>}
              <h2 className="text-base font-bold text-slate-800 mt-1">{titleVal}</h2>
            </div>
          </header>

          {/* Context strip — class/section/date/total in header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mt-3 mb-3 text-[10.5pt]">
            {academicYearLabel && <Field label="Academic Year" value={academicYearLabel} />}
            {className         && <Field label="Class"         value={className} />}
            {sectionName       && <Field label="Section"       value={sectionName} />}
            {!className && !sectionName && <Field label="Scope" value={scopeLabel} />}
            <Field label="Date"  value={dateVal} />
            <Field label="Total" value={String(sortedRows.length)} />
            {sortField !== "none" && (
              <Field label="Sorted by" value={`${activeSortLabel} ${sortDir === "asc" ? "↑" : "↓"}`} />
            )}
          </div>

          {/* Body */}
          {sortedRows.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">No students to print.</p>
          ) : (
            <DataTable rows={sortedRows} active={active} extras={preset.extras} />
          )}

          {/* Footer */}
          <footer className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span>Total students: <strong className="text-slate-700 tabular-nums">{sortedRows.length}</strong></span>
            <span>Generated {new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
          </footer>
        </div>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-dotted border-slate-300 pb-0.5">
      <span className="text-[9pt] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">{label}:</span>
      <span className="font-semibold text-slate-800 truncate">{value}</span>
    </div>
  )
}

function DataTable({
  rows, active, extras,
}: {
  rows:   PrintRow[]
  active: ActiveItem[]
  extras: ("present" | "timeOutIn" | "signature")[]
}) {
  return (
    <table className="print-table w-full border-collapse text-[11pt] mt-2">
      <thead>
        <tr className="bg-slate-100">
          <Th w="w-8">#</Th>
          {active.map(item => item.kind === "pre"
            ? <Th key={`pre-${item.key}`}   w={COL_DEFS[item.key].w}>{COL_DEFS[item.key].label}</Th>
            : <Th key={`cu-${item.label}`}>{item.label}</Th>
          )}
          {extras.includes("present")   && <Th w="w-14">Present</Th>}
          {extras.includes("timeOutIn") && <><Th w="w-20">Time Out</Th><Th w="w-20">Time In</Th></>}
          {extras.includes("signature") && <Th w="w-32">Signature</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <Td center>{i + 1}</Td>
            {active.map(item => {
              if (item.kind === "pre") {
                const def = COL_DEFS[item.key]
                return <Td key={`pre-${item.key}`} center={def.align === "center"} mono={def.mono}>{def.render(r)}</Td>
              }
              return <Td key={`cu-${item.label}`} className="signature-cell" />
            })}
            {extras.includes("present")   && <Td className="checkbox-cell text-lg leading-none">☐</Td>}
            {extras.includes("timeOutIn") && <><Td className="signature-cell" /><Td className="signature-cell" /></>}
            {extras.includes("signature") && <Td className="signature-cell" />}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Sortable row inside the Columns popover ─────────────────────────────────

function SortableActiveRow({
  item, onRemovePre, onRemoveCustom,
}: {
  item:           ActiveItem
  onRemovePre:    (key: ColKey) => void
  onRemoveCustom: (label: string) => void
}) {
  const id = getItemId(item)
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 30 : undefined,
  }

  const isCustom = item.kind === "custom"
  const label    = isCustom ? item.label : COL_DEFS[item.key].label

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 text-xs cursor-default",
        isCustom ? "hover:bg-violet-50/40" : "hover:bg-slate-50",
      )}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners}
        title="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary transition-colors flex-shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {isCustom ? (
        <span className="w-4 h-4 rounded border-2 border-violet-300 bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Pencil className="w-2 h-2 text-violet-600" />
        </span>
      ) : (
        <span className="w-4 h-4 rounded border-2 bg-primary border-transparent flex items-center justify-center flex-shrink-0">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </span>
      )}
      <span className={cn(
        "flex-1 truncate",
        isCustom ? "font-semibold text-violet-800" : "text-slate-700",
      )}>{label}</span>
      <button type="button"
        onClick={() => isCustom ? onRemoveCustom(item.label) : onRemovePre(item.key)}
        title="Remove"
        className="text-slate-400 hover:text-rose-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th className={cn(
      "border border-slate-700 px-2 py-1.5 text-left text-[10pt] font-black uppercase tracking-wider",
      w,
    )}>{children}</th>
  )
}
function Td({
  children, center, mono, className,
}: { children?: React.ReactNode; center?: boolean; mono?: boolean; className?: string }) {
  return (
    <td className={cn(
      "border border-slate-700 px-2 py-1 align-middle",
      center && "text-center",
      mono   && "font-mono text-[10pt]",
      className,
    )}>{children}</td>
  )
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// Pad numeric portions so "9" sorts before "10" in alpha comparison
function padNum(s: string): string {
  return s.replace(/\d+/g, m => m.padStart(10, "0"))
}
