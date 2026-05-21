"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Upload, Image as ImgIcon, Check, X, Loader2, Search,
  AlertTriangle, ArrowRight, Trash2, FolderUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { bulkUpdateStudents, type BulkStudentUpdate } from "@/actions/students-bulk"

export type PhotoStudent = {
  id:          string
  name:        string
  admissionNo: string
  rollNumber:  string | null
  className:   string
  sectionName: string | null
  avatarUrl:   string | null
}

type ParsedFile = {
  id:       string              // local uuid
  file:     File
  previewUrl: string             // object URL
  rawName:  string              // filename with extension
  baseName: string              // without extension
}

type MatchKind = "confident" | "likely" | "unmatched"
type Match = {
  fileId:        string
  kind:          MatchKind
  candidates:    string[]        // student ids, ordered best-first
  chosenStudentId: string | null
  reason:        string          // human-readable
}

// ─── Matching helpers ────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length, n = b.length
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

function matchFile(
  baseName: string,
  students: PhotoStudent[],
  admMap:    Map<string, PhotoStudent[]>,
  rollMap:   Map<string, PhotoStudent[]>,
  nameToId:  { id: string; normName: string; firstName: string }[],
): Omit<Match, "fileId"> {
  const k = norm(baseName)
  if (!k) return { kind: "unmatched", candidates: [], chosenStudentId: null, reason: "Empty filename" }

  // 1) exact admission # (case-insensitive on alphanumeric)
  if (admMap.has(k)) {
    const hits = admMap.get(k)!
    if (hits.length === 1) {
      return { kind: "confident", candidates: hits.map(s => s.id), chosenStudentId: hits[0].id, reason: "Admission # match" }
    }
    return { kind: "likely", candidates: hits.map(s => s.id), chosenStudentId: null, reason: "Admission # match — multiple candidates" }
  }

  // 2) exact roll # (whole school — ambiguous, surface candidates)
  if (rollMap.has(k)) {
    const hits = rollMap.get(k)!
    if (hits.length === 1) {
      return { kind: "likely", candidates: hits.map(s => s.id), chosenStudentId: hits[0].id, reason: "Roll # match (review class)" }
    }
    return { kind: "likely", candidates: hits.map(s => s.id), chosenStudentId: null, reason: `Roll # has ${hits.length} candidates` }
  }

  // 3) fuzzy full-name match (Levenshtein ≤ 3 on normalized form)
  const targetN = k
  const scored = nameToId
    .map(s => ({ id: s.id, dist: levenshtein(targetN, s.normName) }))
    .filter(s => s.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
  if (scored.length > 0) {
    const best = scored[0]
    const tight = scored.filter(s => s.dist === best.dist)
    if (tight.length === 1 && best.dist <= 1) {
      return { kind: "likely", candidates: tight.map(s => s.id), chosenStudentId: best.id, reason: best.dist === 0 ? "Exact name match" : "Near-match name" }
    }
    return { kind: "likely", candidates: scored.slice(0, 4).map(s => s.id), chosenStudentId: null, reason: `Name fuzzy match — ${scored.length} candidate${scored.length === 1 ? "" : "s"}` }
  }

  // 4) substring of the first token of name → useful for "aarav.jpg"
  const tokenMatches = nameToId.filter(s => s.firstName === targetN)
  if (tokenMatches.length > 0) {
    return tokenMatches.length === 1
      ? { kind: "likely", candidates: [tokenMatches[0].id], chosenStudentId: tokenMatches[0].id, reason: "First-name match" }
      : { kind: "likely", candidates: tokenMatches.map(s => s.id), chosenStudentId: null, reason: `First-name match — ${tokenMatches.length} candidates` }
  }

  return { kind: "unmatched", candidates: [], chosenStudentId: null, reason: "No match" }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  schoolId: string
  students: PhotoStudent[]
}

export function PhotosMatcher({ schoolId, students }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<ParsedFile[]>([])
  const [matches, setMatches] = useState<Record<string, Match>>({})
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => { for (const f of files) URL.revokeObjectURL(f.previewUrl) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Indexes for matching ────────────────────────────────────────────────
  const indexes = useMemo(() => {
    const admMap  = new Map<string, PhotoStudent[]>()
    const rollMap = new Map<string, PhotoStudent[]>()
    const nameToId: { id: string; normName: string; firstName: string }[] = []
    for (const s of students) {
      const a = norm(s.admissionNo)
      if (a) (admMap.get(a) ?? admMap.set(a, []).get(a)!).push(s)
      if (s.rollNumber) {
        const r = norm(s.rollNumber)
        if (r) (rollMap.get(r) ?? rollMap.set(r, []).get(r)!).push(s)
      }
      const n = norm(s.name)
      const first = norm(s.name.split(/\s+/)[0] ?? "")
      if (n) nameToId.push({ id: s.id, normName: n, firstName: first })
    }
    return { admMap, rollMap, nameToId }
  }, [students])

  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students])

  // ─── Accept files ─────────────────────────────────────────────────────────
  function acceptFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter(f =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type),
    )
    if (arr.length === 0) {
      toast.error("No images found in the selection.")
      return
    }
    const next: ParsedFile[] = arr.map((f, i) => {
      const id = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`
      const raw = f.name
      const base = raw.includes(".") ? raw.slice(0, raw.lastIndexOf(".")) : raw
      // Folder uploads send "Foo/bar.jpg" as webkitRelativePath; use just the filename
      const cleanBase = base.split(/[\\/]/).pop() ?? base
      return { id, file: f, previewUrl: URL.createObjectURL(f), rawName: raw, baseName: cleanBase }
    })

    const newMatches: Record<string, Match> = {}
    for (const pf of next) {
      const m = matchFile(pf.baseName, students, indexes.admMap, indexes.rollMap, indexes.nameToId)
      newMatches[pf.id] = { fileId: pf.id, ...m }
    }
    setFiles(prev => [...prev, ...next])
    setMatches(prev => ({ ...prev, ...newMatches }))
    toast.success(`Added ${next.length} photo${next.length === 1 ? "" : "s"}`)
  }

  function removeFile(fileId: string) {
    const f = files.find(x => x.id === fileId)
    if (f) URL.revokeObjectURL(f.previewUrl)
    setFiles(prev => prev.filter(x => x.id !== fileId))
    setMatches(prev => {
      const out = { ...prev }
      delete out[fileId]
      return out
    })
  }

  function reset() {
    for (const f of files) URL.revokeObjectURL(f.previewUrl)
    setFiles([])
    setMatches({})
  }

  function pickCandidate(fileId: string, studentId: string | null) {
    setMatches(prev => {
      const cur = prev[fileId]
      if (!cur) return prev
      const ck: MatchKind =
        studentId == null         ? "unmatched" :
        cur.kind === "confident"  ? "confident" :
                                    "likely"
      return { ...prev, [fileId]: { ...cur, chosenStudentId: studentId, kind: ck } }
    })
  }

  // Assign an unmatched file to a student selected via the picker
  function manualAssign(fileId: string, studentId: string) {
    setMatches(prev => ({
      ...prev,
      [fileId]: {
        fileId,
        kind:            "likely",
        candidates:      [studentId],
        chosenStudentId: studentId,
        reason:          "Manually assigned",
      },
    }))
  }

  // ─── Group for display ───────────────────────────────────────────────────
  const buckets = useMemo(() => {
    const confident: ParsedFile[] = []
    const likely:    ParsedFile[] = []
    const unmatched: ParsedFile[] = []
    for (const f of files) {
      const m = matches[f.id]
      if (!m) continue
      if (m.kind === "confident")    confident.push(f)
      else if (m.kind === "likely")  likely.push(f)
      else                            unmatched.push(f)
    }
    return { confident, likely, unmatched }
  }, [files, matches])

  // ─── Commit ────────────────────────────────────────────────────────────────
  const readyAssignments = useMemo(() => {
    return Object.values(matches).filter(m => m.chosenStudentId)
  }, [matches])

  async function uploadOne(file: File): Promise<string> {
    const form = new FormData()
    form.append("file", file, file.name)
    const res = await fetch("/api/upload/avatar", { method: "POST", body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Upload failed (${res.status})`)
    }
    const { url } = await res.json() as { url: string }
    return url
  }

  // Parallel upload with concurrency cap
  async function uploadWithCap(items: { match: Match; file: File }[], cap: number): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    let cursor = 0
    let done = 0
    setProgress({ done: 0, total: items.length })
    async function worker() {
      while (cursor < items.length) {
        const idx = cursor++
        const it = items[idx]
        try {
          const url = await uploadOne(it.file)
          out.set(it.match.fileId, url)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Upload failed for ${it.file.name}`)
        }
        done++
        setProgress({ done, total: items.length })
      }
    }
    await Promise.all(new Array(Math.min(cap, items.length)).fill(0).map(worker))
    return out
  }

  function commit() {
    if (readyAssignments.length === 0) {
      toast.error("Nothing to upload — pick at least one match.")
      return
    }
    setCommitting(true)
    startT(async () => {
      try {
        // 1) Upload all files (parallel, capped)
        const work = readyAssignments
          .map(m => {
            const f = files.find(ff => ff.id === m.fileId)
            return f ? { match: m, file: f.file } : null
          })
          .filter((x): x is { match: Match; file: File } => x !== null)
        const urls = await uploadWithCap(work, 4)

        // 2) Build student updates from successful uploads
        const updates: BulkStudentUpdate[] = []
        for (const m of readyAssignments) {
          const url = urls.get(m.fileId)
          if (!url || !m.chosenStudentId) continue
          updates.push({
            studentId: m.chosenStudentId,
            fields:    { avatarUrl: url },
          })
        }
        if (updates.length === 0) {
          toast.error("No photos were uploaded successfully.")
          return
        }
        const res = await bulkUpdateStudents(schoolId, updates)
        if (res.failed.length > 0) {
          toast.error(`Saved ${res.ok.length}, failed ${res.failed.length}. First error: ${res.failed[0].error}`)
        } else {
          toast.success(`Updated photos for ${res.ok.length} student${res.ok.length === 1 ? "" : "s"}`)
          reset()
          router.refresh()
          router.push("/students")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Commit failed")
      } finally {
        setCommitting(false)
        setProgress(null)
      }
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <DropZone
        fileRef={fileRef}
        onFiles={acceptFiles}
        empty={files.length === 0}
        countAdded={files.length}
      />

      {files.length > 0 && (
        <>
          {/* Summary header */}
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-4 flex items-center gap-3 flex-wrap">
            <Pill color="emerald">{buckets.confident.length} confident</Pill>
            <Pill color="amber">{buckets.likely.length} review</Pill>
            <Pill color="rose">{buckets.unmatched.length} unmatched</Pill>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              <strong className="text-slate-700">{readyAssignments.length}</strong> ready to upload
            </span>
            <Button variant="ghost" size="sm" onClick={reset}
              className="gap-1.5 cursor-pointer text-xs text-rose-600 hover:bg-rose-50">
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </Button>
          </div>

          {/* Confident */}
          {buckets.confident.length > 0 && (
            <SectionCard
              title="Confident matches"
              subtitle="Auto-matched by admission #. Accept all or remove the ones you don't want."
              accent="emerald"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {buckets.confident.map(f => {
                  const m = matches[f.id]
                  const s = m.chosenStudentId ? studentById.get(m.chosenStudentId) : null
                  return (
                    <PhotoCard key={f.id} file={f} student={s ?? null} reason={m.reason}
                      onReject={() => removeFile(f.id)} />
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Likely — needs review */}
          {buckets.likely.length > 0 && (
            <SectionCard
              title="Review matches"
              subtitle="Confirm one of the candidates, or skip this photo."
              accent="amber"
            >
              <div className="space-y-3">
                {buckets.likely.map(f => {
                  const m = matches[f.id]
                  return (
                    <ReviewCard key={f.id}
                      file={f}
                      match={m}
                      studentById={studentById}
                      onPick={(id) => pickCandidate(f.id, id)}
                      onRemove={() => removeFile(f.id)}
                    />
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Unmatched */}
          {buckets.unmatched.length > 0 && (
            <SectionCard
              title="Unmatched"
              subtitle="No automatic match found. Search for the student or remove the photo."
              accent="rose"
            >
              <div className="space-y-3">
                {buckets.unmatched.map(f => (
                  <UnmatchedCard key={f.id}
                    file={f}
                    students={students}
                    onAssign={(id) => manualAssign(f.id, id)}
                    onRemove={() => removeFile(f.id)}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Sticky bottom bar */}
      {readyAssignments.length > 0 && (
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg px-5 py-3 flex items-center gap-3 flex-wrap z-30">
          <div className="text-xs text-slate-600">
            {progress ? (
              <span>Uploading <strong className="text-slate-900">{progress.done}</strong> / {progress.total}…</span>
            ) : (
              <span><strong className="text-slate-900">{readyAssignments.length}</strong> photo{readyAssignments.length === 1 ? "" : "s"} ready</span>
            )}
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={commit} disabled={committing}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold">
            {committing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />}
            Upload &amp; assign
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DropZone({
  fileRef, onFiles, empty, countAdded,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>
  onFiles: (l: FileList | File[]) => void
  empty:   boolean
  countAdded: number
}) {
  const [drag, setDrag] = useState(false)
  const folderRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
      }}
      className={cn(
        "bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-dashed shadow-sm p-8 text-center transition-all",
        drag
          ? "border-primary bg-primary/5 scale-[1.01]"
          : empty
            ? "border-slate-200"
            : "border-slate-100",
      )}
    >
      <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = "" }}
      />
      <input ref={folderRef} type="file" multiple
        // @ts-expect-error — non-standard but widely supported
        webkitdirectory="" directory=""
        className="hidden"
        onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = "" }}
      />
      <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
        <Upload className="w-6 h-6 text-violet-600" />
      </div>
      <p className="font-bold text-sm text-slate-800">
        {empty ? "Drop photos or a folder here" : `Add more — ${countAdded} photo${countAdded === 1 ? "" : "s"} loaded`}
      </p>
      <p className="text-xs text-muted-foreground mt-1">JPEG, PNG or WebP up to 5MB each</p>
      <div className="flex items-center gap-2 justify-center mt-4">
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}
          className="gap-1.5 cursor-pointer bg-white">
          <ImgIcon className="w-3.5 h-3.5" /> Pick files
        </Button>
        <Button size="sm" variant="outline" onClick={() => folderRef.current?.click()}
          className="gap-1.5 cursor-pointer bg-white">
          <FolderUp className="w-3.5 h-3.5" /> Pick folder
        </Button>
      </div>
      <p className="text-[10px] text-slate-400 mt-3">
        Best results: name files after admission #s (e.g. <code className="bg-slate-100 px-1 rounded">padma-2082-0001.jpg</code>)
      </p>
    </div>
  )
}

function SectionCard({
  title, subtitle, accent, children,
}: {
  title:    string
  subtitle: string
  accent:   "emerald" | "amber" | "rose"
  children: React.ReactNode
}) {
  const bar =
    accent === "emerald" ? "bg-emerald-500" :
    accent === "amber"   ? "bg-amber-500" :
                           "bg-rose-500"
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        <div className={cn("w-1", bar)} />
        <div className="flex-1 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900">{title}</h3>
            <span className="text-[10px] text-slate-400">{subtitle}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function PhotoCard({
  file, student, reason, onReject,
}: {
  file:     ParsedFile
  student:  PhotoStudent | null
  reason:   string
  onReject: () => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-slate-100 relative">
        <Image src={file.previewUrl} alt="" fill unoptimized className="object-cover" />
      </div>
      <div className="p-2.5">
        {student ? (
          <>
            <div className="text-xs font-semibold text-slate-800 truncate">{student.name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{student.admissionNo}</div>
            <div className="text-[10px] text-slate-400 truncate">{student.className}{student.sectionName && ` · ${student.sectionName}`}</div>
          </>
        ) : (
          <div className="text-xs text-slate-400 italic">No student</div>
        )}
        <div className="text-[9px] text-emerald-700 mt-1 flex items-center gap-0.5">
          <Check className="w-2.5 h-2.5" /> {reason}
        </div>
        <button onClick={onReject}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/95 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 cursor-pointer shadow-sm">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function ReviewCard({
  file, match, studentById, onPick, onRemove,
}: {
  file:        ParsedFile
  match:       Match
  studentById: Map<string, PhotoStudent>
  onPick:      (id: string | null) => void
  onRemove:    () => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
      <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden relative flex-shrink-0">
        <Image src={file.previewUrl} alt="" fill unoptimized className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono text-slate-500 truncate">{file.rawName}</span>
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
            {match.reason}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {match.candidates.map(id => {
            const s = studentById.get(id)
            if (!s) return null
            const picked = match.chosenStudentId === id
            return (
              <button key={id} onClick={() => onPick(picked ? null : id)}
                className={cn(
                  "text-left rounded-lg border px-2.5 py-1.5 transition-all cursor-pointer",
                  picked
                    ? "bg-primary/10 border-primary/30 ring-2 ring-primary/15"
                    : "bg-white border-slate-200 hover:border-primary/30",
                )}>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold truncate max-w-[140px]", picked ? "text-primary" : "text-slate-800")}>
                    {s.name}
                  </span>
                  {picked && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{s.admissionNo}</div>
                <div className="text-[10px] text-slate-400 truncate">{s.className}{s.sectionName && ` · ${s.sectionName}`}</div>
              </button>
            )
          })}
          <Button variant="ghost" size="sm" onClick={() => { onPick(null); onRemove() }}
            className="gap-1 cursor-pointer text-xs h-auto py-1 text-rose-600 hover:bg-rose-50">
            <X className="w-3 h-3" /> Skip
          </Button>
        </div>
      </div>
    </div>
  )
}

function UnmatchedCard({
  file, students, onAssign, onRemove,
}: {
  file:     ParsedFile
  students: PhotoStudent[]
  onAssign: (id: string) => void
  onRemove: () => void
}) {
  const [q, setQ] = useState("")
  const results = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return [] as PhotoStudent[]
    return students.filter(s =>
      s.name.toLowerCase().includes(k) ||
      s.admissionNo.toLowerCase().includes(k) ||
      (s.rollNumber ?? "").toLowerCase().includes(k),
    ).slice(0, 6)
  }, [q, students])

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
      <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden relative flex-shrink-0">
        <Image src={file.previewUrl} alt="" fill unoptimized className="object-cover" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 truncate">{file.rawName}</span>
          <AlertTriangle className="w-3 h-3 text-rose-500" />
          <span className="text-[10px] text-rose-700">No match</span>
          <div className="flex-1" />
          <button onClick={onRemove}
            title="Remove this photo"
            className="text-slate-400 hover:text-rose-600 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by name, admission # or roll…"
            className="h-8 pl-8 text-xs bg-white" />
        </div>
        {results.length > 0 && (
          <div className="space-y-1">
            {results.map(s => (
              <button key={s.id} onClick={() => onAssign(s.id)}
                className="w-full text-left bg-slate-50 hover:bg-primary/10 hover:border-primary/30 border border-slate-100 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 truncate">{s.name}</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">{s.admissionNo}</span>
                <span className="text-[10px] text-slate-400 truncate ml-auto">{s.className}{s.sectionName && ` · ${s.sectionName}`}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {q && results.length === 0 && (
          <p className="text-[10px] text-slate-400 italic">No students match &quot;{q}&quot;</p>
        )}
      </div>
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: "emerald" | "amber" | "rose" }) {
  const cls =
    color === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    color === "amber"   ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
  return (
    <span className={cn("text-[10px] font-bold border rounded-full px-2.5 py-0.5 inline-flex items-center gap-1", cls)}>
      {children}
    </span>
  )
}

