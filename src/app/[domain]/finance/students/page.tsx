import Link from "next/link"
import { Metadata } from "next"
import { Search, GraduationCap, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"

export const metadata: Metadata = { title: "Students · Fees" }

interface SP { q?: string; classId?: string }

export default async function StudentsLandingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const sp = await searchParams
  const q = (sp.q ?? "").trim()

  const [classes, students] = await Promise.all([
    prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    q.length >= 1 || sp.classId
      ? prisma.student.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            ...(sp.classId && { classId: sp.classId }),
            ...(q.length >= 1 && {
              OR: [
                { user:        { fullName: { contains: q, mode: "insensitive" } } },
                { admissionNo: { contains: q, mode: "insensitive" } },
              ],
            }),
          },
          include: {
            user:    { select: { fullName: true, avatarUrl: true } },
            class:   { select: { name: true } },
            section: { select: { name: true } },
          },
          orderBy: { user: { fullName: "asc" } },
          take: 80,
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-sm text-muted-foreground mt-1">Open a student to view and edit their fee schedule for the year.</p>
      </div>

      <form className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="Name or admission no…" className="pl-9" />
        </div>
        <select name="classId" defaultValue={sp.classId ?? ""} className="h-10 px-3 bg-white/75 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 min-w-[180px]">
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:opacity-90 transition">
          Search
        </button>
      </form>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {students.length === 0 ? (
          <div className="p-16 text-center">
            <UserRound className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600">
              {q || sp.classId ? "No students matched." : "Search by name, admission no, or pick a class to list students."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {students.map(s => {
              const initials = s.user.fullName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
              const className = s.class ? `${s.class.name}${s.section ? "-" + s.section.name : ""}` : null
              return (
                <li key={s.id}>
                  <Link href={`/finance/students/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer">
                    {s.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.user.avatarUrl} alt={s.user.fullName} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0">
                        <span className="text-[11px] font-bold text-emerald-700">{initials}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{s.user.fullName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{s.admissionNo}</p>
                    </div>
                    {className && (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        {className}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {students.length > 0 && (
          <p className="px-4 py-2 text-[10px] uppercase tracking-widest font-black text-slate-400 border-t border-slate-100 bg-slate-50/50">
            Showing {students.length} student{students.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  )
}
