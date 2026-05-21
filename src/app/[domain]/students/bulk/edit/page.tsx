import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Grid3X3 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { sortClassesByFacultyThenName } from "@/lib/class-sort"
import { EditGrid, type GridClass, type GridStudent } from "./edit-grid"

export const metadata: Metadata = { title: "Bulk Edit Students" }

export default async function BulkEditPage({
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

  const students = await prisma.student.findMany({
    where:   { schoolId: school.id, status: { in: ["ACTIVE", "SUSPENDED"] } },
    include: {
      user:      { select: { fullName: true, email: true } },
      guardians: {
        where: { isPrimary: true },
        take:  1,
        select: { name: true, relation: true, phone: true, email: true, occupation: true },
      },
    },
    orderBy: { admissionNo: "asc" },
  })

  const classes: GridClass[] = sortClassesByFacultyThenName(
    school.classes.map(c => ({
      id:          c.id,
      name:        c.name,
      facultyName: c.faculty?.name ?? null,
      sections:    c.sections.map(s => ({ id: s.id, name: s.name })),
    })),
  )

  const studentList: GridStudent[] = students.map(s => {
    const g = s.guardians[0]
    return {
      id:                  s.id,
      admissionNo:         s.admissionNo,
      classId:             s.classId,
      sectionId:           s.sectionId,
      // Identity
      fullName:            s.user.fullName,
      fullNameNepali:      s.fullNameNepali,
      email:               s.user.email,
      gender:              s.gender,
      dobBS:               s.dobBS || null,
      bloodGroup:          s.bloodGroup,
      // Numbers
      rollNumber:          s.rollNumber,
      symbolNumber:        s.symbolNumber,
      nebRegistrationNo:   s.nebRegistrationNo,
      // Demographics
      religion:            s.religion,
      caste:               s.caste,
      ethnicity:           s.ethnicity,
      motherTongue:        s.motherTongue,
      // Address
      province:            s.province,
      district:            s.district,
      municipality:        s.municipality,
      wardNo:              s.wardNo,
      street:              s.street,
      permanentAddress:    s.permanentAddress,
      temporaryAddress:    s.temporaryAddress,
      // EMIS identity
      nationalIdNo:        s.nationalIdNo,
      birthCertNo:         s.birthCertNo,
      nationality:         s.nationality,
      // Academic history
      previousSchool:      s.previousSchool,
      transferCertNo:      s.transferCertNo,
      // Status
      status:              s.status,
      // Primary guardian (denormalized)
      guardianName:        g?.name       ?? null,
      guardianRelation:    g?.relation   ?? null,
      guardianPhone:       g?.phone      ?? null,
      guardianEmail:       g?.email      ?? null,
      guardianOccupation:  g?.occupation ?? null,
    }
  })

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students/bulk">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Bulk operations
          </Button>
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Grid3X3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Spreadsheet Edit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick a class, then edit many students at once. Toggle column groups
            for full Identity / Address / EMIS / Guardian editing. Nothing saves
            until you commit.
          </p>
        </div>
      </div>

      <EditGrid
        schoolId={school.id}
        classes={classes}
        students={studentList}
      />
    </div>
  )
}
