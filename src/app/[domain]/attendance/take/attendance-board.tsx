"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Clock, FileCheck, Save, Users, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { saveAttendance, type AttendanceStatus } from "@/actions/attendance"
import { formatBS } from "@/lib/nepali-date"

interface StudentRow {
  id:         string
  name:       string
  rollNumber: string | null
  admissionNo: string
}

interface Props {
  schoolId:   string
  takenById:  string
  classId:    string
  className:  string
  sectionId:  string
  sectionName: string
  dateBS:     string
  students:   StudentRow[]
  existing:   Record<string, AttendanceStatus>  // studentId → status
}

const STATUS_CONFIG = {
  PRESENT: { label: "P",       icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-500",    ring: "ring-emerald-500/40", light: "bg-emerald-50  text-emerald-700 border-emerald-200" },
  ABSENT:  { label: "A",       icon: XCircle,      color: "text-rose-700",    bg: "bg-rose-500",       ring: "ring-rose-500/40",    light: "bg-rose-50     text-rose-700    border-rose-200" },
  LATE:    { label: "L",       icon: Clock,        color: "text-amber-700",   bg: "bg-amber-500",      ring: "ring-amber-500/40",   light: "bg-amber-50    text-amber-700   border-amber-200" },
  EXCUSED: { label: "E",       icon: FileCheck,    color: "text-blue-700",    bg: "bg-blue-500",       ring: "ring-blue-500/40",    light: "bg-blue-50     text-blue-700    border-blue-200" },
} as const

const STATUSES = Object.keys(STATUS_CONFIG) as AttendanceStatus[]

export function AttendanceBoard({
  schoolId, takenById, classId, className, sectionId, sectionName,
  dateBS, students, existing,
}: Props) {
  const router = useRouter()
  const [records, setRecords] = React.useState<Record<string, AttendanceStatus>>(
    () => {
      const init: Record<string, AttendanceStatus> = {}
      students.forEach(s => { init[s.id] = existing[s.id] ?? "PRESENT" })
      return init
    }
  )
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = Object.values(records).filter(v => v === s).length
    return acc
  }, {} as Record<AttendanceStatus, number>)

  const pct = students.length > 0 ? Math.round(counts.PRESENT / students.length * 100) : 0

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords(prev => ({ ...prev, [studentId]: status }))
    setSaved(false)
  }

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {}
    students.forEach(s => { next[s.id] = status })
    setRecords(next)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveAttendance(schoolId, takenById, {
        classId,
        sectionId,
        dateBS,
        records: students.map(s => ({ studentId: s.id, status: records[s.id] })),
      })
      setSaved(true)
      toast.success(`Attendance saved — ${counts.PRESENT} present, ${counts.ABSENT} absent`)
      router.push("/attendance")
    } catch {
      toast.error("Failed to save attendance")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Context bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-semibold">{className} — Section {sectionName}</p>
            <p className="text-sm text-muted-foreground">{formatBS(dateBS)} · {students.length} students</p>
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUSES.map(s => (
              <Badge
                key={s}
                variant="outline"
                className={cn("text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity", STATUS_CONFIG[s].light)}
                onClick={() => markAll(s)}
                title={`Mark all ${s.toLowerCase()}`}
              >
                {counts[s]} {s[0]}
              </Badge>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{pct}% present</span>
            <span className="text-muted-foreground/60">click a badge above to mark all</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>

      {/* Student grid */}
      <motion.div
        className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.025 } } }}
      >
        {students.map(student => {
          const status = records[student.id]
          const cfg    = STATUS_CONFIG[status]

          return (
            <motion.div
              key={student.id}
              variants={{
                hidden:  { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
              }}
              className={cn(
                "bg-white/70 backdrop-blur-xl rounded-xl border p-4 transition-all",
                status === "PRESENT" && "border-emerald-200/60",
                status === "ABSENT"  && "border-rose-200/60",
                status === "LATE"    && "border-amber-200/60",
                status === "EXCUSED" && "border-blue-200/60",
              )}
            >
              {/* Student info */}
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 transition-colors",
                  cfg.bg
                )}>
                  {student.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{student.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{student.rollNumber ?? student.admissionNo}</p>
                </div>
              </div>

              {/* Status toggle buttons */}
              <div className="grid grid-cols-4 gap-1">
                {STATUSES.map(s => {
                  const c = STATUS_CONFIG[s]
                  const active = status === s
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(student.id, s)}
                      className={cn(
                        "h-8 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        active
                          ? `${c.bg} text-white shadow-md ring-2 ${c.ring} scale-105`
                          : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      )}
                      title={s.charAt(0) + s.slice(1).toLowerCase()}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Save footer */}
      <div className="sticky bottom-4 flex justify-end">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl shadow-slate-900/10 p-3 flex items-center gap-3"
        >
          <div className="text-sm text-muted-foreground pl-2">
            <span className="font-bold text-foreground">{students.length}</span> students
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "gap-2 cursor-pointer shadow-lg shadow-primary/25 font-bold",
              saved && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {saving ? (
              <motion.div
                className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Attendance"}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
