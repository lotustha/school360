import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listStudentGroups } from "@/actions/student-groups"
import { Button } from "@/components/ui/button"
import { GroupsClient } from "./groups-client"

export const metadata: Metadata = { title: "Student Groups" }

export default async function StudentGroupsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const [groups, classes, subjects, students] = await Promise.all([
    listStudentGroups(school.id),
    prisma.class.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where:   { schoolId: school.id },
      select:  { id: true, name: true, code: true, class: { select: { id: true, name: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.student.findMany({
      where:   { schoolId: school.id, status: "ACTIVE" },
      include: { user: { select: { fullName: true } } },
      orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
    }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/academics/routine">
          <Button size="icon" variant="ghost" className="h-8 w-8 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Student Groups</h2>
          <p className="text-sm text-muted-foreground">Cross-class cohorts for electives, combined sessions, special programs</p>
        </div>
      </div>

      <GroupsClient
        schoolId={school.id}
        groups={groups}
        classes={classes}
        subjects={subjects}
        students={students.map(s => ({
          id:          s.id,
          fullName:    s.user.fullName,
          admissionNo: s.admissionNo,
          rollNumber:  s.rollNumber,
          classId:     s.classId,
          sectionId:   s.sectionId,
        }))}
      />
    </div>
  )
}
