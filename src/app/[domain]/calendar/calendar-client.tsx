"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, List as ListIcon,
  Download, RotateCcw, Trash2, Loader2, Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { cn } from "@/lib/utils"
import {
  todayBS, toAD, toBSSafe, toADSafe, daysInBsMonth,
  bsMonthName, adMonthName, formatBS, formatAD,
} from "@/lib/nepali-date"
import {
  CALENDAR_EVENT_TYPES, EVENT_TYPE_META, HOLIDAY_LIKE_TYPES, eventColor,
  type CalendarEventType,
} from "@/lib/calendar-events"
import {
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, seedNepalHolidays,
  type CalendarEventRow,
} from "@/actions/calendar"

// ─── Types & helpers ─────────────────────────────────────────────────────────

type CalSystem = "BS" | "AD"
const SYSTEM_KEY = "calendar:system"

interface YearOption {
  id:          string
  name:        string
  isCurrent:   boolean
  startDateBS: string
  endDateBS:   string
}

interface Props {
  years:          YearOption[]
  selectedYearId: string
  events:         CalendarEventRow[]
  initialMonth:   string // "YYYY-MM" BS
  canManage:      boolean
}

const COLOR_PRESETS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#64748b"]

const pad = (n: number) => String(n).padStart(2, "0")

/** One rendered day in the month grid, with both calendars resolved. */
interface DayCell {
  day:       number      // primary day-of-month (matches the active system)
  bsStr:     string      // "YYYY-MM-DD" BS — the storage / event key
  adDate:    Date | null
  secondary: string      // small cross-calendar label
  weekend:   boolean      // Saturday = weekly off in Nepal
}

interface MonthGrid {
  label:   string
  leading: number        // blank cells before day 1
  cells:   DayCell[]
}

/** Build a BS-driven month: big BS day, small AD day. */
function buildBsMonth(y: number, m: number): MonthGrid {
  const days = daysInBsMonth(y, m)
  const cells: DayCell[] = []
  let leading = 0
  for (let d = 1; d <= days; d++) {
    const bsStr = `${y}-${pad(m)}-${pad(d)}`
    const adDate = toADSafe(bsStr)
    if (d === 1 && adDate) leading = adDate.getDay()
    const ad = adDate?.getDate() ?? 0
    const secondary = adDate
      ? (ad === 1 ? `${adMonthName(adDate.getMonth() + 1).slice(0, 3)} 1` : String(ad))
      : ""
    cells.push({
      day: d, bsStr, adDate, secondary,
      weekend: adDate ? adDate.getDay() === 6 : (leading + d - 1) % 7 === 6,
    })
  }
  return { label: `${bsMonthName(m)} ${y}`, leading, cells }
}

/** Build an AD-driven month: big AD day, small BS day. */
function buildAdMonth(y: number, m: number): MonthGrid {
  const days = new Date(y, m, 0).getDate()
  const leading = new Date(y, m - 1, 1).getDay()
  const cells: DayCell[] = []
  for (let d = 1; d <= days; d++) {
    const adDate = new Date(y, m - 1, d)
    const bsStr = toBSSafe(adDate) ?? ""
    let secondary = ""
    if (bsStr) {
      const bsDay = Number(bsStr.slice(8, 10))
      const bsMon = Number(bsStr.slice(5, 7))
      secondary = bsDay === 1 ? `${bsMonthName(bsMon).slice(0, 3)} 1` : String(bsDay)
    }
    cells.push({ day: d, bsStr, adDate, secondary, weekend: adDate.getDay() === 6 })
  }
  return { label: `${adMonthName(m)} ${y}`, leading, cells }
}

interface FormState {
  title:       string
  eventType:   CalendarEventType
  dateBS:      string
  endDateBS:   string
  multiDay:    boolean
  isHoliday:   boolean
  description: string
  color:       string // "" = automatic per type
}

function emptyForm(dateBS: string): FormState {
  return {
    title: "", eventType: "EVENT", dateBS, endDateBS: "",
    multiDay: false, isHoliday: false, description: "", color: "",
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CalendarClient({ years, selectedYearId, events, initialMonth, canManage }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const today = todayBS()

  const [view, setView] = useState<"month" | "list">("month")
  const [system, setSystem] = useState<CalSystem>("BS")
  // cursor (y, m) is always interpreted in the active `system`.
  const [cursor, setCursor] = useState(() => {
    const [y, m] = initialMonth.split("-").map(Number)
    return { y: y || Number(today.slice(0, 4)), m: m && m >= 1 && m <= 12 ? m : Number(today.slice(5, 7)) }
  })

  // Dialog state
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEventRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<FormState>(() => emptyForm(today))

  // ── System switch (keeps the viewed month in place across calendars) ────────

  function switchSystem(next: CalSystem) {
    if (next === system) return
    setCursor(c => {
      try {
        if (next === "AD") {
          const d = toAD(`${c.y}-${pad(c.m)}-01`)
          return { y: d.getFullYear(), m: d.getMonth() + 1 }
        }
        const bs = toBSSafe(new Date(c.y, c.m - 1, 1))
        return bs ? { y: Number(bs.slice(0, 4)), m: Number(bs.slice(5, 7)) } : c
      } catch { return c }
    })
    setSystem(next)
    try { localStorage.setItem(SYSTEM_KEY, next) } catch { /* ignore */ }
  }

  // Restore the saved preference once on mount (server renders BS).
  useEffect(() => {
    try {
      if (localStorage.getItem(SYSTEM_KEY) === "AD") switchSystem("AD")
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Month grid data ─────────────────────────────────────────────────────────

  const month = useMemo<MonthGrid>(
    () => (system === "BS" ? buildBsMonth(cursor.y, cursor.m) : buildAdMonth(cursor.y, cursor.m)),
    [system, cursor.y, cursor.m],
  )

  // Range-match events against a BS day key (handles multi-day spans).
  function eventsForDay(bsStr: string): CalendarEventRow[] {
    if (!bsStr) return []
    return events.filter(ev => {
      const s = ev.dateBS
      const e = ev.endDateBS ?? ev.dateBS
      return bsStr >= s && bsStr <= e
    })
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function prevMonth() {
    setCursor(c => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }))
  }
  function nextMonth() {
    setCursor(c => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }))
  }
  function goToday() {
    if (system === "BS") {
      setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })
    } else {
      const d = new Date()
      setCursor({ y: d.getFullYear(), m: d.getMonth() + 1 })
    }
  }
  function changeYear(id: string) {
    router.push(`/calendar?year=${id}`)
  }

  // ── Dialog flows ─────────────────────────────────────────────────────────────

  function openCreate(dateBS?: string) {
    if (!canManage) return
    setEditing(null)
    setConfirmDelete(false)
    setForm(emptyForm(dateBS || today))
    setOpen(true)
  }

  function openEdit(ev: CalendarEventRow) {
    if (!canManage) return
    setEditing(ev)
    setConfirmDelete(false)
    setForm({
      title:       ev.title,
      eventType:   (CALENDAR_EVENT_TYPES as readonly string[]).includes(ev.eventType)
                     ? ev.eventType as CalendarEventType : "EVENT",
      dateBS:      ev.dateBS,
      endDateBS:   ev.endDateBS ?? "",
      multiDay:    !!ev.endDateBS,
      isHoliday:   ev.isHoliday,
      description: ev.description ?? "",
      color:       ev.color ?? "",
    })
    setOpen(true)
  }

  function setType(t: CalendarEventType) {
    setForm(f => ({ ...f, eventType: t, isHoliday: HOLIDAY_LIKE_TYPES.has(t) }))
  }

  function submit() {
    if (!form.title.trim()) { toast.error("Title is required"); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateBS)) { toast.error("Pick a valid BS date"); return }
    if (form.multiDay && !/^\d{4}-\d{2}-\d{2}$/.test(form.endDateBS)) {
      toast.error("Pick a valid BS end date"); return
    }
    const payload = {
      title:       form.title,
      eventType:   form.eventType,
      dateBS:      form.dateBS,
      endDateBS:   form.multiDay ? form.endDateBS : null,
      isHoliday:   form.isHoliday,
      isAllDay:    true,
      description: form.description || null,
      color:       form.color || null,
    }
    start(async () => {
      try {
        if (editing) {
          await updateCalendarEvent({ id: editing.id, ...payload })
          toast.success("Event updated")
        } else {
          await createCalendarEvent({ academicYearId: selectedYearId, ...payload })
          toast.success("Event created")
        }
        setOpen(false)
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  function handleDelete() {
    if (!editing) return
    start(async () => {
      try {
        await deleteCalendarEvent(editing.id)
        toast.success("Event deleted")
        setOpen(false)
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  function importHolidays() {
    start(async () => {
      try {
        const res = await seedNepalHolidays(selectedYearId)
        toast.success(
          res.inserted > 0
            ? `${res.inserted} Nepal holiday${res.inserted === 1 ? "" : "s"} imported${res.skipped ? ` · ${res.skipped} already present` : ""}`
            : "All seed holidays are already on the calendar",
        )
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-1">
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="px-2 min-w-[140px] text-center text-sm font-bold text-slate-800 tabular-nums">{month.label}</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors" aria-label="Next month">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={goToday} className="ml-1 h-8 px-2.5 rounded-lg text-[11px] font-bold text-primary hover:bg-primary/8 inline-flex items-center gap-1 cursor-pointer transition-colors">
            <RotateCcw className="w-3 h-3" />Today
          </button>
        </div>

        {/* BS / AD switch */}
        <div className="flex items-center bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-1">
          {([["BS", "नेपाली"], ["AD", "English"]] as const).map(([s, label]) => (
            <button key={s} onClick={() => switchSystem(s)}
              className={cn(
                "h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors",
                system === s ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-1">
          {(["month", "list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn(
                "h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-colors",
                view === v ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}>
              {v === "month" ? <CalendarDays className="w-3.5 h-3.5" /> : <ListIcon className="w-3.5 h-3.5" />}
              {v === "month" ? "Month" : "List"}
            </button>
          ))}
        </div>

        <select
          value={selectedYearId}
          onChange={e => changeYear(e.target.value)}
          className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 cursor-pointer"
        >
          {years.map(y => (
            <option key={y.id} value={y.id}>
              {y.name}{y.isCurrent ? " · current" : ""}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {canManage && (
          <>
            <Button variant="outline" onClick={importHolidays} disabled={pending} className="gap-1.5 cursor-pointer bg-white/75">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Import Nepal holidays
            </Button>
            <Button onClick={() => openCreate()} className="gap-1.5 cursor-pointer shadow-sm">
              <Plus className="w-3.5 h-3.5" />New Event
            </Button>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {CALENDAR_EVENT_TYPES.map(t => (
          <span key={t} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EVENT_TYPE_META[t].color }} />
            {EVENT_TYPE_META[t].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-slate-400 ml-auto">
          <Sun className="w-3 h-3 text-rose-400" />Saturday = weekly off
        </span>
      </div>

      {view === "month" ? (
        /* ── Month grid ─────────────────────────────────────────────────── */
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w, i) => (
              <div key={w} className={cn(
                "px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest",
                i === 6 ? "text-rose-500" : "text-slate-500",
              )}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {Array.from({ length: month.leading }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 bg-slate-50/40" />
            ))}
            {month.cells.map(cell => {
              const dayEvents    = eventsForDay(cell.bsStr)
              const isHolidayDay = dayEvents.some(e => e.isHoliday)
              const isToday      = cell.bsStr === today
              const shown        = dayEvents.slice(0, 3)
              return (
                <div
                  key={cell.day}
                  onClick={() => openCreate(cell.bsStr)}
                  className={cn(
                    "min-h-24 p-1.5 align-top transition-colors",
                    (cell.weekend || isHolidayDay) && "bg-rose-50/50",
                    canManage && "cursor-pointer hover:bg-primary/4",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums",
                      isToday
                        ? "bg-primary text-white shadow-sm"
                        : cell.weekend || isHolidayDay ? "text-rose-600" : "text-slate-700",
                    )}>{cell.day}</span>
                    {cell.secondary && (
                      <span className="text-[9px] font-bold text-slate-400 tabular-nums pr-0.5">{cell.secondary}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {shown.map(ev => {
                      const c = eventColor(ev.eventType, ev.color)
                      return (
                        <button
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); openEdit(ev) }}
                          title={`${ev.title} · ${EVENT_TYPE_META[ev.eventType as CalendarEventType]?.label ?? ev.eventType}`}
                          className={cn(
                            "w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-bold truncate transition-opacity",
                            canManage ? "cursor-pointer hover:opacity-75" : "cursor-default",
                          )}
                          style={{ backgroundColor: `${c}1f`, color: c }}
                        >
                          {ev.title}
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] font-black text-slate-400 px-1.5">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
            {/* trailing blanks to square off the last row */}
            {Array.from({ length: (7 - ((month.leading + month.cells.length) % 7)) % 7 }).map((_, i) => (
              <div key={`tail-${i}`} className="min-h-24 bg-slate-50/40" />
            ))}
          </div>
        </div>
      ) : (
        /* ── List view ──────────────────────────────────────────────────── */
        <ListView events={events} system={system} canManage={canManage} onEdit={openEdit} />
      )}

      {/* ── Create / Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white/90 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Annual Sports Day"
                maxLength={160}
                autoFocus
              />
            </Field>

            <Field label="Type">
              <div className="flex flex-wrap gap-1.5">
                {CALENDAR_EVENT_TYPES.map(t => {
                  const active = form.eventType === t
                  const c = EVENT_TYPE_META[t].color
                  return (
                    <button key={t} type="button" onClick={() => setType(t)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                        active ? "text-white border-transparent shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                      )}
                      style={active ? { backgroundColor: c } : undefined}
                    >
                      {EVENT_TYPE_META[t].label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={form.multiDay ? "Start date (BS)" : "Date (BS)"}>
                <NepaliDateInput value={form.dateBS} onChange={v => setForm(f => ({ ...f, dateBS: v }))} />
              </Field>
              {form.multiDay && (
                <Field label="End date (BS)">
                  <NepaliDateInput value={form.endDateBS} onChange={v => setForm(f => ({ ...f, endDateBS: v }))} />
                </Field>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.multiDay}
                  onChange={e => setForm(f => ({ ...f, multiDay: e.target.checked, endDateBS: e.target.checked ? (f.endDateBS || f.dateBS) : "" }))}
                  className="accent-primary w-3.5 h-3.5"
                />
                Multi-day
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isHoliday}
                  onChange={e => setForm(f => ({ ...f, isHoliday: e.target.checked }))}
                  className="accent-primary w-3.5 h-3.5"
                />
                School closed (holiday)
              </label>
            </div>

            <Field label="Color">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setForm(f => ({ ...f, color: "" }))}
                  className={cn(
                    "h-6 px-2 rounded-md text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all",
                    form.color === "" ? "border-primary text-primary bg-primary/8" : "border-slate-200 text-slate-400 hover:border-slate-300",
                  )}>
                  Auto
                </button>
                {COLOR_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn(
                      "w-6 h-6 rounded-md cursor-pointer transition-transform hover:scale-110",
                      form.color === c && "ring-2 ring-offset-1 ring-slate-400",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </Field>

            <Field label="Description (optional)">
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Details visible on the event…"
                rows={2}
                maxLength={1000}
              />
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-600">Delete this event?</span>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending} className="cursor-pointer">
                    Yes, delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="cursor-pointer">
                    No
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </Button>
              )
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Cancel</Button>
              <Button onClick={submit} disabled={pending} className="cursor-pointer gap-1.5">
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? "Save changes" : "Create event"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── List view ───────────────────────────────────────────────────────────────

function ListView({
  events, system, canManage, onEdit,
}: {
  events: CalendarEventRow[]
  system: CalSystem
  canManage: boolean
  onEdit: (ev: CalendarEventRow) => void
}) {
  const groups = useMemo(() => {
    const byKey = new Map<string, { label: string; list: CalendarEventRow[] }>()
    for (const ev of [...events].sort((a, b) => a.dateBS.localeCompare(b.dateBS))) {
      let key: string
      let label: string
      if (system === "AD") {
        const ad = toADSafe(ev.dateBS)
        if (ad) {
          key   = `${ad.getFullYear()}-${pad(ad.getMonth() + 1)}`
          label = `${adMonthName(ad.getMonth() + 1)} ${ad.getFullYear()}`
        } else {
          key = ev.dateBS.slice(0, 7); label = key
        }
      } else {
        key   = ev.dateBS.slice(0, 7)
        label = `${bsMonthName(Number(key.slice(5, 7)))} ${key.slice(0, 4)}`
      }
      const g = byKey.get(key) ?? { label, list: [] }
      g.list.push(ev)
      byKey.set(key, g)
    }
    return [...byKey.values()]
  }, [events, system])

  if (events.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
        <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-600">No events on this academic year yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          {canManage
            ? <>Click <strong>Import Nepal holidays</strong> to pre-load public holidays, or add events manually.</>
            : "Events and holidays will appear here once added."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(({ label, list }) => (
        <div key={label} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">
              {label} · {list.length} entr{list.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {list.map(ev => {
                const c = eventColor(ev.eventType, ev.color)
                const primary   = system === "AD" ? adDateLabel(ev.dateBS) : formatBS(ev.dateBS)
                const secondary = system === "AD" ? formatBS(ev.dateBS)    : adDateLabel(ev.dateBS)
                const primaryEnd   = ev.endDateBS ? (system === "AD" ? adDateLabel(ev.endDateBS) : formatBS(ev.endDateBS)) : null
                return (
                  <tr
                    key={ev.id}
                    onClick={() => canManage && onEdit(ev)}
                    className={cn("hover:bg-slate-50/60 transition-colors", canManage && "cursor-pointer")}
                  >
                    <td className="px-4 py-2.5 w-52 align-top whitespace-nowrap">
                      <div className="font-mono tabular-nums text-slate-600">
                        {primary}
                        {primaryEnd && <span className="text-slate-400"> → {primaryEnd}</span>}
                      </div>
                      {secondary && <div className="text-[10px] text-slate-400 tabular-nums">{secondary}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-slate-800">{ev.title}</span>
                      {ev.description && (
                        <span className="block text-[10px] text-slate-400 truncate max-w-[420px]">{ev.description}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 w-32">
                      <span
                        className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${c}1f`, color: c }}
                      >
                        {EVENT_TYPE_META[ev.eventType as CalendarEventType]?.label ?? ev.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-24 text-right">
                      {ev.isHoliday && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-500">
                          <Sun className="w-3 h-3" />Off
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/** Format a stored BS date as its AD equivalent ("Jun 16, 2026"), or "" if unconvertible. */
function adDateLabel(bsStr: string): string {
  const d = toADSafe(bsStr)
  return d ? formatAD(d) : ""
}

// ─── Small bits ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      {children}
    </div>
  )
}
