import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileSpreadsheet } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { ImportWizard } from "./import-wizard"

export const metadata: Metadata = { title: "Import Students" }

export default async function BulkImportPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:   { slug: domain },
    include: {
      classes: {
        orderBy: { name: "asc" },
        include: { sections: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
    },
  })
  if (!school) notFound()

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students/bulk">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Bulk operations
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Import from xlsx</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drop an Excel file. Rows with <strong>Admission #</strong> will <em>update</em> existing students;
            rows without will <em>create</em> new ones.
          </p>
        </div>
      </div>

      <ImportWizard
        schoolId={school.id}
        slug={school.slug}
        classes={sortClassesByFacultyThenName(school.classes.map(c => ({
          id: c.id, name: c.name,
          sections: c.sections.map(s => ({ id: s.id, name: s.name })),
        })))}
      />
    </div>
  )
}
