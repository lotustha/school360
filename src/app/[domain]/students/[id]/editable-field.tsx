"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Check, X as XIcon, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import { updateStudentField } from "@/actions/students"
import { useEditMode } from "./edit-mode-context"

type FieldType = "text" | "textarea" | "number" | "select" | "nepali-date"
export type SelectOption = { value: string; label: string }

interface Props {
  schoolId:     string
  studentId:    string
  field:        string
  label:        string
  value:        string | null
  type?:        FieldType
  options?:     SelectOption[]
  mono?:        boolean
  placeholder?: string
  formatDisplay?: (v: string) => string
}

export function EditableField({
  schoolId, studentId, field, label,
  value: initial, type = "text", options, mono, placeholder, formatDisplay,
}: Props) {
  const { editing: globalEdit } = useEditMode()
  const [singleEdit, setSingleEdit] = useState(false)
  const [draft,      setDraft]      = useState(initial ?? "")
  const [server,     setServer]     = useState(initial)
  const [pending,    startT]        = useTransition()
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const inEdit = globalEdit || singleEdit

  // Keep draft in sync if server value changes externally (e.g. after refresh)
  useEffect(() => {
    if (!singleEdit) {
      setDraft(initial ?? "")
      setServer(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  useEffect(() => {
    if (singleEdit && type !== "select" && type !== "nepali-date") {
      inputRef.current?.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [singleEdit, type])

  function startEdit() {
    setDraft(server ?? "")
    setSingleEdit(true)
  }

  function persist(silent = false): Promise<void> {
    return new Promise(resolve => {
      const next = draft || null
      if ((server ?? null) === next) { resolve(); return }
      startT(async () => {
        try {
          await updateStudentField(schoolId, studentId, field, next)
          setServer(next)
          if (!silent) toast.success(`${label} updated`)
        } catch (err) {
          if (!silent) toast.error(err instanceof Error ? err.message : `Failed to update ${label}`)
          setDraft(server ?? "")
        } finally {
          resolve()
        }
      })
    })
  }

  function save() {
    persist().then(() => setSingleEdit(false))
  }
  function cancel() {
    setDraft(server ?? "")
    setSingleEdit(false)
  }
  function blurSave() {
    // Used only in global edit mode — silent, no UI dismiss
    if (draft !== (server ?? "")) persist(false)
  }

  // ─── Display state (single-edit closed AND global edit off) ────────────
  if (!inEdit) {
    const display = server
      ? (type === "select"
          ? options?.find(o => o.value === server)?.label ?? server
          : formatDisplay ? formatDisplay(server) : server)
      : null

    return (
      <div onDoubleClick={startEdit}
        title="Double-click to edit (or use Edit button above)"
        className="group flex items-start gap-2 py-2.5 border-b border-slate-50 last:border-0 cursor-text hover:bg-slate-50/40 -mx-2 px-2 rounded transition-colors">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 w-36 flex-shrink-0 pt-0.5">
          {label}
        </span>
        <span className="text-sm flex-1 flex items-center gap-1.5 min-w-0">
          {display ? (
            <span className={cn("text-slate-700 break-words", mono && "font-mono")}>{display}</span>
          ) : (
            <span className="text-slate-300 italic text-xs">— not set —</span>
          )}
          <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </span>
      </div>
    )
  }

  // ─── Edit state ────────────────────────────────────────────────────────
  // Global edit mode: no buttons, save on blur, tab navigates between fields
  // Single edit mode: explicit Save / Cancel buttons
  const blurHandlers = globalEdit
    ? { onBlur: blurSave }
    : {}

  return (
    <div className={cn(
      "flex items-start gap-2 py-2 border-b border-slate-50 last:border-0 -mx-2 px-2 rounded",
      globalEdit ? "bg-amber-50/30 hover:bg-amber-50/50" : "bg-primary/5",
    )}>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 w-36 flex-shrink-0 pt-2">
        {label}
        {pending && <Loader2 className="w-2.5 h-2.5 animate-spin inline ml-1 text-primary" />}
      </span>
      <div className="flex-1 flex items-start gap-1.5">
        {type === "select" && options ? (
          <Select value={draft} onValueChange={(v) => {
            setDraft(v)
            if (globalEdit) {
              // Save immediately on select change in global mode
              startT(async () => {
                try {
                  await updateStudentField(schoolId, studentId, field, v || null)
                  setServer(v || null)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : `Failed to update ${label}`)
                  setDraft(server ?? "")
                }
              })
            }
          }} disabled={pending}>
            <SelectTrigger className="h-8 text-sm flex-1 bg-white">
              <SelectValue placeholder={placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent className="bg-white/95 backdrop-blur-xl">
              {options.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "nepali-date" ? (
          <div className="flex-1" {...blurHandlers}>
            <NepaliDateInput value={draft} onChange={setDraft} />
          </div>
        ) : type === "textarea" ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") cancel()
              else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
            }}
            {...blurHandlers}
            disabled={pending}
            placeholder={placeholder}
            className={cn("text-sm flex-1 min-h-[60px] bg-white", mono && "font-mono")}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") cancel()
              else if (e.key === "Enter") { e.preventDefault(); save() }
            }}
            {...blurHandlers}
            disabled={pending}
            type={type === "number" ? "number" : "text"}
            placeholder={placeholder}
            className={cn("h-8 text-sm flex-1 bg-white", mono && "font-mono")}
          />
        )}
        {!globalEdit && (
          <>
            <Button onClick={save} disabled={pending} size="icon" variant="default"
              title="Save (Enter)" className="h-8 w-8 cursor-pointer shrink-0">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button onClick={cancel} disabled={pending} size="icon" variant="ghost"
              title="Cancel (Esc)" className="h-8 w-8 cursor-pointer shrink-0">
              <XIcon className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Read-only row for fields that can't be inline-edited yet (FKs etc.) ────

export function StaticRow({
  label, value, mono = false,
}: {
  label: string; value: string | null | undefined; mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-sm text-slate-700 flex-1", mono && "font-mono")}>{value}</span>
    </div>
  )
}
