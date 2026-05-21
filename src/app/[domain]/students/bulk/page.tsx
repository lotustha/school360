import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft, Grid3X3, FileSpreadsheet, ImagePlus,
  Hash, Download, ArrowRight, Layers, ClipboardCheck,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Bulk Student Operations" }

interface CardDef {
  href:        string
  title:       string
  description: string
  icon:        React.ElementType
  accent:      string   // tailwind "iconBg / iconColor / borderHover" tuple
  badge?:      string
}

const CARDS: CardDef[] = [
  {
    href:        "/students/bulk/edit",
    title:       "Spreadsheet Edit",
    description: "Edit many students at once in an Excel-style grid. Fill-down, find-and-replace, batch save.",
    icon:        Grid3X3,
    accent:      "bg-primary/10 text-primary border-primary/20 hover:border-primary/40",
  },
  {
    href:        "/students/bulk/import",
    title:       "Import from xlsx",
    description: "Drop an Excel file to create new students or update existing ones. Blank admission # = create; present = update.",
    icon:        FileSpreadsheet,
    accent:      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400",
  },
  {
    href:        "/students/bulk/photos",
    title:       "Bulk Photo Upload",
    description: "Drop a folder of photos. Auto-match by admission #, roll # or name — review and commit.",
    icon:        ImagePlus,
    accent:      "bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400",
  },
  {
    href:        "/students/bulk/numbers",
    title:       "Roll / Symbol Numbers",
    description: "Assign roll numbers or NEB symbol numbers across a class in one shot, with conflict detection.",
    icon:        Hash,
    accent:      "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400",
  },
  {
    href:        "/students/bulk/export",
    title:       "Export to xlsx",
    description: "Download students as an Excel template or backup. Round-trip with the importer to bulk-edit offline.",
    icon:        Download,
    accent:      "bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-400",
  },
  {
    href:        "/students/bulk/neb",
    title:       "NEB Registration Import",
    description: "Apply NEB reg # and DOB from the NEB-supplied xlsx by sorting and pairing alphabetically. SEE / +2 ready.",
    icon:        ClipboardCheck,
    accent:      "bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400",
  },
]

export default async function BulkLandingPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, _count: { select: { students: true } } },
  })
  if (!school) notFound()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Students
          </Button>
        </Link>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono font-bold text-slate-600">{school._count.students}</span> students in this school
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Layers className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Bulk Student Operations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick a workflow below — each one is scoped, reviewable, and reversible until you hit commit.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {CARDS.map(c => {
          const Icon = c.icon
          return (
            <Link key={c.href} href={c.href}
              className={cn(
                "group bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
              )}>
              <div className="flex items-start gap-3">
                <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors", c.accent)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{c.title}</h3>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.description}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer tip */}
      <div className="text-xs text-muted-foreground bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
        <strong className="text-amber-700">Tip:</strong> Every bulk action shows a before/after preview and asks for confirmation before saving. You can step away at any point — nothing changes until you commit.
      </div>
    </div>
  )
}
