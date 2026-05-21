"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  UserPlus, Star, Trash2, Loader2, Check, X as XIcon, Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar-img"
import { cn } from "@/lib/utils"
import { useEditMode } from "./edit-mode-context"
import { updateGuardianField, addGuardian, deleteGuardian } from "@/actions/students"

export type Guardian = {
  id:             string
  name:           string
  relation:       string
  phone:          string
  email:          string | null
  occupation:     string | null
  educationLevel: string | null
  isPrimary:      boolean
}

const RELATION_OPTIONS = ["Father", "Mother", "Guardian", "Uncle", "Aunt", "Grandparent", "Sibling", "Other"]
const EDUCATION_OPTIONS = ["SLC", "+2", "Bachelor", "Master", "PhD", "Other", "Unknown"]

interface Props {
  schoolId:  string
  studentId: string
  guardians: Guardian[]
  studentEmail: string | null
}

export function GuardiansSection({ schoolId, studentId, guardians: initial, studentEmail }: Props) {
  const router = useRouter()
  const { editing } = useEditMode()
  const [guardians, setGuardians] = useState<Guardian[]>(initial)
  const [addingOpen, setAddingOpen] = useState(false)
  const [, startT] = useTransition()

  function refreshLocal(updater: (cur: Guardian[]) => Guardian[]) {
    setGuardians(prev => updater(prev))
  }

  function persistField(
    g: Guardian, field: keyof Guardian, value: string | null | boolean,
  ): Promise<void> {
    return new Promise(resolve => {
      const strVal = typeof value === "boolean" ? (value ? "true" : "false") : value
      startT(async () => {
        try {
          await updateGuardianField(schoolId, g.id, field as string, strVal)
          // Mirror locally so the UI updates without a refetch
          refreshLocal(cur => {
            // Only one primary across the list
            if (field === "isPrimary" && value === true) {
              return cur.map(x => ({ ...x, isPrimary: x.id === g.id }))
            }
            return cur.map(x => x.id === g.id ? { ...x, [field]: value as never } : x)
          })
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update")
        } finally {
          resolve()
        }
      })
    })
  }

  function remove(g: Guardian) {
    if (!confirm(`Remove "${g.name}" from this student's guardians?`)) return
    startT(async () => {
      try {
        await deleteGuardian(schoolId, g.id)
        refreshLocal(cur => {
          const next = cur.filter(x => x.id !== g.id)
          // Ensure remaining has a primary
          if (next.length > 0 && !next.some(x => x.isPrimary)) {
            next[0] = { ...next[0], isPrimary: true }
          }
          return next
        })
        toast.success("Guardian removed")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't remove")
      }
    })
  }

  return (
    <div className="space-y-1">
      {guardians.length === 0 && !addingOpen && (
        <div className="py-3 text-center">
          <p className="text-xs text-slate-400 italic">No guardians on file.</p>
        </div>
      )}

      {guardians.map((g, i) => (
        <GuardianRow
          key={g.id}
          g={g}
          editing={editing}
          isLast={i === guardians.length - 1}
          onField={(f, v) => persistField(g, f, v)}
          onRemove={() => remove(g)}
        />
      ))}

      {editing && (
        addingOpen ? (
          <AddGuardianRow
            schoolId={schoolId}
            studentId={studentId}
            onAdded={(g) => {
              refreshLocal(cur => {
                const next = [...cur, g]
                if (!next.some(x => x.isPrimary)) next[0] = { ...next[0], isPrimary: true }
                return next
              })
              setAddingOpen(false)
              router.refresh()
            }}
            onCancel={() => setAddingOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingOpen(true)}
            className="w-full mt-2 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 hover:bg-primary/5 hover:border-primary/30 text-xs text-slate-600 hover:text-primary font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add guardian
          </button>
        )
      )}

      {studentEmail && (
        <div className="pt-3 mt-2 border-t border-slate-50 flex items-center gap-2 text-xs text-slate-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student email</span>
          <code className="font-mono text-slate-600">{studentEmail}</code>
        </div>
      )}
    </div>
  )
}

// ─── Single guardian row ─────────────────────────────────────────────────────

function GuardianRow({
  g, editing, isLast, onField, onRemove,
}: {
  g:        Guardian
  editing:  boolean
  isLast:   boolean
  onField:  (field: keyof Guardian, value: string | null | boolean) => Promise<void>
  onRemove: () => void
}) {
  return (
    <div className={cn(
      "py-3",
      !isLast && "border-b border-slate-50",
    )}>
      <div className="flex items-start gap-3">
        <Avatar name={g.name} size={36} rounded="full" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <EditableInline value={g.name} placeholder="Name" className="text-sm font-semibold text-slate-800"
              editing={editing} onCommit={v => onField("name", v)} />
            <span className="text-slate-300">·</span>
            <EditableSelect value={g.relation} options={RELATION_OPTIONS} className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
              editing={editing} onCommit={v => onField("relation", v)} />
            {g.isPrimary ? (
              <Badge variant="outline" className="text-[9px] font-bold bg-primary/8 text-primary border-primary/20 gap-0.5">
                <Star className="w-2.5 h-2.5" /> Primary
              </Badge>
            ) : editing ? (
              <button onClick={() => onField("isPrimary", true)}
                title="Make primary"
                className="text-[10px] text-slate-400 hover:text-primary cursor-pointer font-semibold">
                Make primary
              </button>
            ) : null}
            <div className="flex-1" />
            {editing && (
              <button onClick={onRemove}
                title="Remove guardian"
                className="w-6 h-6 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <FieldLabel label="Phone">
              <EditableInline value={g.phone} placeholder="+977-98…" className="text-slate-600 font-mono"
                editing={editing} onCommit={v => onField("phone", v)} />
            </FieldLabel>
            <FieldLabel label="Email">
              <EditableInline value={g.email ?? ""} placeholder="—" className="text-slate-600"
                editing={editing} onCommit={v => onField("email", v || null)} />
            </FieldLabel>
            <FieldLabel label="Occupation">
              <EditableInline value={g.occupation ?? ""} placeholder="—" className="text-slate-500"
                editing={editing} onCommit={v => onField("occupation", v || null)} />
            </FieldLabel>
            <FieldLabel label="Education">
              <EditableSelect value={g.educationLevel ?? ""} options={EDUCATION_OPTIONS}
                allowEmpty placeholder="—" className="text-slate-500"
                editing={editing} onCommit={v => onField("educationLevel", v || null)} />
            </FieldLabel>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ─── Add-guardian inline form ────────────────────────────────────────────────

function AddGuardianRow({
  schoolId, studentId, onAdded, onCancel,
}: {
  schoolId:  string
  studentId: string
  onAdded:   (g: Guardian) => void
  onCancel:  () => void
}) {
  const [name, setName] = useState("")
  const [relation, setRelation] = useState("Guardian")
  const [phone, setPhone] = useState("")
  const [pending, startT] = useTransition()

  function submit() {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name is required (2+ characters)")
      return
    }
    startT(async () => {
      try {
        const id = await addGuardian(schoolId, studentId, { name, relation, phone })
        onAdded({
          id,
          name:           name.trim(),
          relation,
          phone:          phone.trim(),
          email:          null,
          occupation:     null,
          educationLevel: null,
          isPrimary:      false,
        })
        toast.success("Guardian added")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add")
      }
    })
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name *"
          className="h-8 text-sm bg-white" autoFocus />
        <Select value={relation} onValueChange={setRelation}>
          <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RELATION_OPTIONS.map(r => <SelectItem key={r} value={r} className="text-sm">{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)"
          className="h-8 text-sm bg-white font-mono" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}
          className="gap-1.5 cursor-pointer text-xs h-7">
          <XIcon className="w-3 h-3" /> Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}
          className="gap-1.5 cursor-pointer text-xs h-7 shadow-sm shadow-primary/20">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Inline editable text (click to edit, blur to save in edit mode) ────────

function EditableInline({
  value, placeholder, editing, onCommit, className,
}: {
  value: string
  placeholder?: string
  editing: boolean
  onCommit: (next: string) => Promise<void> | void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  if (!editing) {
    return value ? (
      <span className={className}>{value}</span>
    ) : (
      <span className="text-slate-300 italic text-[11px]">{placeholder ?? "—"}</span>
    )
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setOpen(true) }}
        className={cn("group inline-flex items-center gap-1 hover:bg-amber-50/60 -mx-1 px-1 rounded transition-colors cursor-text text-left max-w-full truncate", className)}
      >
        <span className="truncate">
          {value || <span className="text-slate-300 italic">{placeholder ?? "—"}</span>}
        </span>
        <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </button>
    )
  }
  async function commit() {
    if (draft === value) { setOpen(false); return }
    setPending(true)
    try { await onCommit(draft) } finally { setPending(false); setOpen(false) }
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter")  { e.preventDefault(); commit() }
        if (e.key === "Escape") { setDraft(value); setOpen(false) }
      }}
      disabled={pending}
      placeholder={placeholder}
      className={cn("h-7 text-xs bg-white border-amber-300", className)}
    />
  )
}

function EditableSelect({
  value, options, allowEmpty = false, placeholder, editing, onCommit, className,
}: {
  value: string
  options: string[]
  allowEmpty?: boolean
  placeholder?: string
  editing: boolean
  onCommit: (next: string) => Promise<void> | void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)

  if (!editing) {
    return value ? (
      <span className={className}>{value}</span>
    ) : (
      <span className="text-slate-300 italic text-[11px]">{placeholder ?? "—"}</span>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => { setDraft(value); setOpen(true) }}
        className={cn("group inline-flex items-center gap-1 hover:bg-amber-50/60 -mx-1 px-1 rounded transition-colors cursor-pointer text-left max-w-full truncate", className)}>
        <span className="truncate">
          {value || <span className="text-slate-300 italic">{placeholder ?? "—"}</span>}
        </span>
        <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </button>
    )
  }
  return (
    <Select value={draft || (allowEmpty ? "__NONE__" : draft)}
      onValueChange={v => {
        const next = v === "__NONE__" ? "" : v
        setDraft(next)
        Promise.resolve(onCommit(next)).then(() => setOpen(false))
      }}
      open
      onOpenChange={(o) => { if (!o) setOpen(false) }}
    >
      <SelectTrigger className="h-7 text-xs bg-white border-amber-300 min-w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__NONE__" className="text-xs text-slate-400 italic">— None —</SelectItem>}
        {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
