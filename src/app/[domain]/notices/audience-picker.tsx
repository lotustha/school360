"use client"

import { useMemo, useState } from "react"
import {
  Building2, GraduationCap, Users, BookOpen, Layers, UsersRound,
  UserRound, Search, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { NoticeTargetType, NoticeTargetOptions } from "@/actions/notices"

export interface AudienceValue {
  targetType: NoticeTargetType
  targetIds:  string[]
}

const KINDS: { type: NoticeTargetType; label: string; icon: React.ElementType }[] = [
  { type: "SCHOOL",       label: "Whole school",      icon: Building2 },
  { type: "STUDENTS_ALL", label: "All students",      icon: GraduationCap },
  { type: "STAFF_ALL",    label: "All staff",         icon: Users },
  { type: "CLASS",        label: "A class",           icon: BookOpen },
  { type: "FACULTY",      label: "A faculty",         icon: Layers },
  { type: "GROUP",        label: "A group",           icon: UsersRound },
  { type: "STUDENTS",     label: "Specific students", icon: GraduationCap },
  { type: "STAFF",        label: "Specific staff",    icon: UserRound },
]

// The "A class" tile covers both whole-class (CLASS) and a single section (SECTION).
const kindOf = (t: NoticeTargetType): NoticeTargetType => (t === "SECTION" ? "CLASS" : t)

export function AudiencePicker({
  targets, value, onChange,
}: {
  targets: NoticeTargetOptions
  value:   AudienceValue
  onChange: (v: AudienceValue) => void
}) {
  function selectKind(type: NoticeTargetType) {
    switch (type) {
      case "CLASS":   onChange({ targetType: "CLASS", targetIds: targets.classes[0] ? [targets.classes[0].id] : [] }); break
      case "FACULTY": onChange({ targetType: "FACULTY", targetIds: targets.faculties[0] ? [targets.faculties[0].id] : [] }); break
      case "GROUP":   onChange({ targetType: "GROUP", targetIds: targets.groups[0] ? [targets.groups[0].id] : [] }); break
      case "STUDENTS":onChange({ targetType: "STUDENTS", targetIds: [] }); break
      case "STAFF":   onChange({ targetType: "STAFF", targetIds: [] }); break
      default:        onChange({ targetType: type, targetIds: [] })
    }
  }

  const activeKind = kindOf(value.targetType)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map(k => {
          const active = activeKind === k.type
          return (
            <button
              key={k.type}
              type="button"
              onClick={() => selectKind(k.type)}
              className={cn(
                "h-9 px-3 rounded-xl border text-xs font-bold cursor-pointer transition inline-flex items-center gap-1.5",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white/75 border-slate-200 text-slate-500 hover:border-slate-300",
              )}
            >
              <k.icon className="w-3.5 h-3.5" />{k.label}
            </button>
          )
        })}
      </div>

      {/* Contextual selector for the chosen kind */}
      {activeKind === "CLASS" && <ClassSelect targets={targets} value={value} onChange={onChange} />}
      {activeKind === "FACULTY" && (
        <SimpleSelect
          placeholder="Select a faculty"
          empty="No faculties configured yet."
          options={targets.faculties}
          value={value.targetIds[0] ?? ""}
          onChange={id => onChange({ targetType: "FACULTY", targetIds: id ? [id] : [] })}
        />
      )}
      {activeKind === "GROUP" && (
        <SimpleSelect
          placeholder="Select a group"
          empty="No student groups exist yet — create one under Academics → Routine → Groups."
          options={targets.groups}
          value={value.targetIds[0] ?? ""}
          onChange={id => onChange({ targetType: "GROUP", targetIds: id ? [id] : [] })}
        />
      )}
      {activeKind === "STUDENTS" && (
        <MultiSelect
          kind="STUDENTS"
          items={targets.students.map(s => ({ id: s.id, name: s.name, sub: s.className }))}
          selected={value.targetIds}
          empty="No active students found."
          onToggle={ids => onChange({ targetType: "STUDENTS", targetIds: ids })}
        />
      )}
      {activeKind === "STAFF" && (
        <MultiSelect
          kind="STAFF"
          items={targets.staff.map(s => ({ id: s.id, name: s.name, sub: roleLabel(s.role) }))}
          selected={value.targetIds}
          empty="No staff accounts found."
          onToggle={ids => onChange({ targetType: "STAFF", targetIds: ids })}
        />
      )}
    </div>
  )
}

function roleLabel(role: string): string {
  if (role === "TEACHER") return "Teacher"
  if (role === "SCHOOL_ADMIN") return "Admin"
  return "Staff"
}

// ─── Class + optional section ─────────────────────────────────────────────────

function ClassSelect({
  targets, value, onChange,
}: {
  targets: NoticeTargetOptions
  value: AudienceValue
  onChange: (v: AudienceValue) => void
}) {
  // Resolve the active class from either a CLASS id or a SECTION id.
  const currentClass = useMemo(() => {
    if (value.targetType === "SECTION") {
      const sid = value.targetIds[0]
      return targets.classes.find(c => c.sections.some(s => s.id === sid)) ?? targets.classes[0]
    }
    return targets.classes.find(c => c.id === value.targetIds[0]) ?? targets.classes[0]
  }, [targets.classes, value])

  if (targets.classes.length === 0) {
    return <Hint>No classes configured yet.</Hint>
  }

  const sectionId = value.targetType === "SECTION" ? value.targetIds[0] : ""

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentClass?.id ?? ""}
        onChange={e => onChange({ targetType: "CLASS", targetIds: [e.target.value] })}
        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
      >
        {targets.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {currentClass && currentClass.sections.length > 0 && (
        <select
          value={sectionId}
          onChange={e => onChange(
            e.target.value
              ? { targetType: "SECTION", targetIds: [e.target.value] }
              : { targetType: "CLASS", targetIds: [currentClass.id] },
          )}
          className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
        >
          <option value="">All sections</option>
          {currentClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
        </select>
      )}
    </div>
  )
}

// ─── Single dropdown ───────────────────────────────────────────────────────────

function SimpleSelect({
  options, value, onChange, placeholder, empty,
}: {
  options:  { id: string; name: string }[]
  value:    string
  onChange: (id: string) => void
  placeholder: string
  empty:    string
}) {
  if (options.length === 0) return <Hint>{empty}</Hint>
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer min-w-[220px]"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

// ─── Searchable multi-select ───────────────────────────────────────────────────

function MultiSelect({
  items, selected, onToggle, empty, kind,
}: {
  items:    { id: string; name: string; sub: string }[]
  selected: string[]
  onToggle: (ids: string[]) => void
  empty:    string
  kind:     "STUDENTS" | "STAFF"
}) {
  const [q, setQ] = useState("")
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter(i => i.name.toLowerCase().includes(query) || i.sub.toLowerCase().includes(query))
  }, [items, q])

  if (items.length === 0) return <Hint>{empty}</Hint>

  function toggle(id: string) {
    onToggle(selectedSet.has(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`Search ${kind === "STUDENTS" ? "students" : "staff"}…`}
          className="flex-1 text-xs outline-none bg-transparent"
        />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {selected.length} selected
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={() => onToggle([])} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">
            Clear
          </button>
        )}
      </div>
      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-4 text-center">No matches.</p>
        ) : filtered.map(i => {
          const on = selectedSet.has(i.id)
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => toggle(i.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors",
                on ? "bg-primary/5" : "hover:bg-slate-50",
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                on ? "bg-primary border-primary" : "border-slate-300",
              )}>
                {on && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="text-xs font-bold text-slate-700 truncate">{i.name}</span>
              {i.sub && <span className="text-[10px] text-slate-400 ml-auto truncate">{i.sub}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">{children}</p>
}
