import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getStudentsForNebScope } from "@/actions/students-bulk"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { NebImporter, type ScopeFaculty, type ScopeClass } from "./neb-importer"

export const metadata: Metadata = { title: "NEB Import" }

interface PageProps {
  params:       Promise<{ domain: string }>
  searchParams: Promise<{ facultyId?: string; classId?: string }>
}

function parseList(s: string | undefined): string[] {
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : []
}

export default async function NebImportPage({ params, searchParams }: PageProps) {
  const { domain } = await params
  const sp = await searchParams

  const school = await prisma.school.findUnique({
    where:  { slug: domain },
    select: { id: true, slug: true },
  })
  if (!school) notFound()

  const facultyIds = parseList(sp.facultyId)
  const classIds   = parseList(sp.classId)

  const [faculties, classes] = await Promise.all([
    prisma.faculty.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  const classOpts: ScopeClass[] = sortClassesByFacultyThenName(
    classes.map(c => ({
      id:           c.id,
      name:         c.name,
      facultyId:    c.facultyId,
      facultyName:  c.faculty?.name ?? null,
    })),
  )

  // Pre-load students only when the user has already picked at least one
  // class. Faculty is optional — it just narrows the class picker.
  const hasValidScope = classIds.length > 0
  const initialStudents = hasValidScope
    ? await getStudentsForNebScope({
        schoolId:  school.id,
        classIds,
        facultyIds: facultyIds.length > 0 ? facultyIds : undefined,
      })
    : []

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students/bulk">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Bulk operations
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="w-6 h-6 text-sky-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">NEB Excel → Student matcher</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Apply NEB registration numbers and dates of birth to students by
            sorting both sides alphabetically and pairing row-by-row. Counts
            must match before you can commit.
          </p>
        </div>
      </div>

      <NebImporter
        schoolId={school.id}
        schoolSlug={school.slug}
        faculties={faculties as ScopeFaculty[]}
        classes={classOpts}
        initialFacultyIds={facultyIds}
        initialClassIds={classIds}
        initialStudents={initialStudents}
      />
    </div>
  )
}
