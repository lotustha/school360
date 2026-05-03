import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("UNAUTHORIZED")
  return session.user
}

export async function requireSchoolSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) throw new Error("UNAUTHORIZED")
  return session.user as {
    id: string
    name?: string | null
    email?: string | null
    role: string
    schoolId: string
    schoolSlug: string | null
  }
}

export async function getSchoolId(domain: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()
  return school.id
}

export async function getSchoolByDomain(domain: string) {
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()
  return school
}
