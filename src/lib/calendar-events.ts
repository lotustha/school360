// Shared metadata for Academic Calendar events (P15).
// Plain lib — safe to import from both server actions and client components.

export const CALENDAR_EVENT_TYPES = [
  "HOLIDAY", "EXAM", "EVENT", "BREAK", "PTM", "SPORT", "CULTURAL",
] as const

export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number]

/** Display label + default chip color per event type. `color` on the row overrides. */
export const EVENT_TYPE_META: Record<CalendarEventType, { label: string; color: string }> = {
  HOLIDAY:  { label: "Holiday",        color: "#ef4444" }, // red
  EXAM:     { label: "Exam",           color: "#8b5cf6" }, // violet
  EVENT:    { label: "Event",          color: "#0ea5e9" }, // sky
  BREAK:    { label: "Break",          color: "#f97316" }, // orange
  PTM:      { label: "Parent Meeting", color: "#10b981" }, // emerald
  SPORT:    { label: "Sports",         color: "#f59e0b" }, // amber
  CULTURAL: { label: "Cultural",       color: "#ec4899" }, // pink
}

/** Event types that imply a day off by default. */
export const HOLIDAY_LIKE_TYPES: ReadonlySet<string> = new Set(["HOLIDAY", "BREAK"])

export function eventColor(eventType: string, color?: string | null): string {
  if (color) return color
  return EVENT_TYPE_META[eventType as CalendarEventType]?.color ?? "#64748b"
}
