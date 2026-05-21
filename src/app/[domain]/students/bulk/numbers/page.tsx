import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Hash } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { NumbersForm, type ClassOption, type SectionOption, type StudentOption } from "./numbers-form"

export const metadata: Metadata = { title: "Bulk Roll / Symbol Numbers" }

export default async function BulkNumbersPage({
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
        include: {
          faculty:  { select: { name: true } },
          sections: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  })
  if (!school) notFound()

  // Pre-load every student in the school (id, name, class/section, current values
  // for both fields, DOB for ordering). Page is class-scoped so this list is
  // typically small (a few hundred); we filter client-side on class/section
  // change to avoid a round-trip per pick.
  const students = await prisma.student.findMany({
    where:   { schoolId: school.id, status: { in: ["ACTIVE", "SUSPENDED"] } },
    include: { user: { select: { fullName: true } } },
    orderBy: { admissionNo: "asc" },
  })

  const classes: ClassOption[] = sortClassesByFacultyThenName(
    school.classes.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyName: c.faculty?.name ?? null,
      sections:    c.sections.map((s): SectionOption => ({ id: s.id, name: s.name })),
    })),
  )

  const studentList: StudentOption[] = students.map(s => ({
    id:           s.id,
    name:         s.user.fullName,
    admissionNo:  s.admissionNo,
    classId:      s.classId,
    sectionId:    s.sectionId,
    rollNumber:   s.rollNumber,
    symbolNumber: s.symbolNumber,
    dobBS:        s.dobBS || null,
  }))

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students/bulk">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Bulk operations
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
          <Hash className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Bulk Roll / Symbol Numbers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign sequential numbers to a whole class — alphabetically, by DOB, or in custom order. Preview every change before committing.
          </p>
        </div>
      </div>

      <NumbersForm
        schoolId={school.id}
        classes={classes}
        students={studentList}
      />
    </div>
  )
}
