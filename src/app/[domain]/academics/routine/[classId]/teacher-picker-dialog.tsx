"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookOpen, Users, Save, X, Star, UsersRound, UserPlus, ArrowLeft, ExternalLink } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AvatarUploader } from "@/components/ui/avatar-uploader"
import { createTeacherQuick } from "@/actions/academics"

type SubjectTeacherOpt = { id: string; fullName: string; isPrimary: boolean }
type SubjectShape = { id: string; name: string; code: string; teachers: SubjectTeacherOpt[] }
type GroupShape   = { id: string; name: string; memberCount: number; subjectId: string | null }

interface Props {
  schoolId:              string
  slotId:                string
  dayOfWeek:             number
  dayLabel:              string
  initialSubjectId:      string
  initialStudentGroupId: string | null
  subjects:              SubjectShape[]
  groups:                GroupShape[]
  onClose:               () => void
  onSave:                (args: {
    periodSlotId:    string
    dayOfWeek:       number
    subjectId:       string
    teacherUserId:   string | null
    studentGroupId?: string | null
  }) => Promise<void> | void
}

export function TeacherPickerDialog({
  schoolId, slotId, dayOfWeek, dayLabel, initialSubjectId, initialStudentGroupId,
  subjects, groups, onClose, onSave,
}: Props) {
  const router = useRouter()
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const subject = subjects.find(s => s.id === subjectId)
  const primary = subject?.teachers.find(t => t.isPrimary)
  // Locally-injected teachers added via the inline form (since `subjects` prop is server-fetched).
  const [extraBySubject, setExtraBySubject] = useState<Record<string, SubjectTeacherOpt[]>>({})
  const extraTeachers = (subjectId && extraBySubject[subjectId]) || []
  const allTeachers: SubjectTeacherOpt[] = subject
    ? [...subject.teachers, ...extraTeachers]
    : []
  const [teacherId, setTeacherId] = useState(primary?.id ?? subject?.teachers[0]?.id ?? "")
  const [groupId,   setGroupId]   = useState<string>(initialStudentGroupId ?? "ALL")
  const [saving,    setSaving]    = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  // Groups relevant to the picked subject: those bound to this subject OR any unbound group
  const candidateGroups = groups.filter(g => g.subjectId == null || g.subjectId === subjectId)

  async function handleSave() {
    if (!subjectId) return
    setSaving(true)
    try {
      await onSave({
        periodSlotId:   slotId,
        dayOfWeek,
        subjectId,
        teacherUserId:  teacherId || null,
        studentGroupId: groupId === "ALL" ? null : groupId,
      })
    } finally {
      setSaving(false)
    }
  }

  if (addingNew && subjectId) {
    return (
      <Dialog open={true} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="bg-white/95 backdrop-blur-xl max-w-md">
          <InlineAddTeacher
            schoolId={schoolId}
            subjectId={subjectId}
            subjectName={subject?.name ?? ""}
            onCancel={() => setAddingNew(false)}
            onCreated={(teacher) => {
              setExtraBySubject(prev => ({
                ...prev,
                [subjectId]: [...(prev[subjectId] ?? []), teacher],
              }))
              setTeacherId(teacher.id)
              setAddingNew(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-white/95 backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Assign to {dayLabel}
          </DialogTitle>
          <DialogDescription>
            Pick a subject, teacher, and optional student group for this cell.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Subject
            </label>
            <Select value={subjectId} onValueChange={(v) => {
              setSubjectId(v)
              const s = subjects.find(x => x.id === v)
              const newPrimary = s?.teachers.find(t => t.isPrimary)
              setTeacherId(newPrimary?.id ?? s?.teachers[0]?.id ?? "")
            }}>
              <SelectTrigger className="mt-1 h-9 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue placeholder="Pick a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} <span className="text-[10px] text-slate-400 ml-1">{s.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> Teacher
              </label>
              {subject && (
                <button onClick={() => setAddingNew(true)} type="button"
                  className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                  <UserPlus className="w-2.5 h-2.5" /> New teacher
                </button>
              )}
            </div>
            {!subject ? (
              <p className="mt-1 text-[11px] text-slate-400">Pick a subject first</p>
            ) : allTeachers.length === 0 ? (
              <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <p>
                  <strong>No teachers assigned to this subject yet.</strong> You can save without a teacher
                  (the cell will show a warning until one is assigned), add one inline above, or visit
                  Subjects → Manage Teachers.
                </p>
              </div>
            ) : (
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="mt-1 h-9 text-sm cursor-pointer bg-white border-slate-200">
                  <SelectValue placeholder="Pick a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {allTeachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                      {t.isPrimary && <Star className="w-2.5 h-2.5 inline-block ml-1.5 text-amber-500" />}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <UsersRound className="w-3 h-3" /> Student group
            </label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="mt-1 h-9 text-sm cursor-pointer bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"><span className="text-muted-foreground">All students in this class</span></SelectItem>
                {candidateGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} <span className="text-[10px] text-slate-400 ml-1">·{g.memberCount}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groupId !== "ALL" && (
              <p className="text-[10px] text-violet-700 mt-1">
                Joint session — same teacher can teach this group across multiple classes simultaneously without conflict.
              </p>
            )}
          </div>

          {primary && teacherId === primary.id && (
            <Badge className="text-[10px] font-bold gap-1 bg-amber-50 text-amber-800 border-amber-200">
              <Star className="w-2.5 h-2.5" /> Using primary teacher
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !subjectId}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : subject && allTeachers.length === 0 ? "Save without teacher" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inline mini add-teacher form ────────────────────────────────────────────

function InlineAddTeacher({
  schoolId, subjectId, subjectName, onCancel, onCreated,
}: {
  schoolId:    string
  subjectId:   string
  subjectName: string
  onCancel:    () => void
  onCreated:   (teacher: SubjectTeacherOpt) => void
}) {
  const [fullName, setFullName] = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [role,     setRole]     = useState<"TEACHER" | "STAFF" | "SCHOOL_ADMIN">("TEACHER")
  const [avatar,   setAvatar]   = useState<string | null>(null)
  const [makePrimary, setMakePrimary] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      toast.error("Name, valid email, and 6+ char password required")
      return
    }
    setSaving(true)
    try {
      const { user } = await createTeacherQuick({
        schoolId,
        fullName,
        email,
        password,
        role,
        avatarUrl: avatar ?? undefined,
        subjectId,
        makePrimary,
      })
      toast.success(`${user.fullName} added as ${role.toLowerCase()}`)
      onCreated({ id: user.id, fullName: user.fullName, isPrimary: makePrimary })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      toast.error(msg.includes("Unique constraint") ? "Email already in use" : msg || "Failed to add teacher")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Quick-add Teacher
        </DialogTitle>
        <DialogDescription>
          Creates a login + assigns to <strong>{subjectName}</strong>. For full HR/payroll details, use the
          <Link href="/hr/staff" className="text-primary hover:underline mx-1 inline-flex items-center gap-0.5">
            Staff page <ExternalLink className="w-2.5 h-2.5" />
          </Link>
          instead.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <AvatarUploader value={avatar} onChange={setAvatar} size={72} />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="e.g. Ram Bahadur Thapa"
            className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="ram@school.edu.np"
              className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</label>
            <Input value={password} onChange={e => setPassword(e.target.value)} type="password"
              placeholder="Min 6 chars"
              className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="mt-1 h-9 text-sm cursor-pointer bg-white border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEACHER">Teacher</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
              <SelectItem value="SCHOOL_ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
          <input type="checkbox" checked={makePrimary} onChange={e => setMakePrimary(e.target.checked)}
            className="cursor-pointer" />
          Make primary teacher for {subjectName}
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}
          className="gap-1.5 cursor-pointer text-xs h-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={saving}
          className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
          <Save className="w-3.5 h-3.5" /> {saving ? "Creating…" : "Create & assign"}
        </Button>
      </DialogFooter>
    </>
  )
}
