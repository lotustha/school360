import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ImagePlus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { PhotosMatcher, type PhotoStudent } from "./photos-matcher"

export const metadata: Metadata = { title: "Bulk Photo Upload" }

export default async function BulkPhotosPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params
  const school = await prisma.school.findUnique({
    where:   { slug: domain },
    select:  { id: true },
  })
  if (!school) notFound()

  const students = await prisma.student.findMany({
    where:   { schoolId: school.id, status: { in: ["ACTIVE", "SUSPENDED"] } },
    include: {
      user:    { select: { fullName: true, avatarUrl: true } },
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: { admissionNo: "asc" },
  })

  const list: PhotoStudent[] = students.map(s => ({
    id:          s.id,
    name:        s.user.fullName,
    admissionNo: s.admissionNo,
    rollNumber:  s.rollNumber ?? null,
    className:   s.class.name,
    sectionName: s.section?.name ?? null,
    avatarUrl:   s.user.avatarUrl ?? null,
  }))

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
        <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
          <ImagePlus className="w-6 h-6 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Bulk Photo Upload</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drop a folder of photos. Files are auto-matched by admission #, roll #, or name —
            review ambiguous matches and commit when ready.
          </p>
        </div>
      </div>

      <PhotosMatcher schoolId={school.id} students={list} />
    </div>
  )
}
