import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import puppeteer, { type Browser } from "puppeteer"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/auth"

// Puppeteer spawns a headless Chromium — needs the Node runtime, not Edge.
export const runtime  = "nodejs"
export const dynamic  = "force-dynamic"
export const maxDuration = 300

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "student"
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const classId      = url.searchParams.get("classId")
  const evaluationId = url.searchParams.get("evaluationId")
  if (!classId || !evaluationId) {
    return NextResponse.json({ error: "Missing classId or evaluationId" }, { status: 400 })
  }

  // Resolve tenant from the request host so the rendered URLs match the user's subdomain.
  const host   = req.headers.get("host") ?? ""
  const domain = host.split(".")[0]
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school || school.id !== session.user.schoolId) {
    return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 })
  }

  const klass = await prisma.class.findFirst({
    where: { id: classId, schoolId: school.id },
    select: { id: true, name: true },
  })
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, schoolId: school.id },
    select: { id: true, name: true },
  })
  if (!klass || !evaluation) {
    return NextResponse.json({ error: "Class or evaluation not found" }, { status: 404 })
  }

  const students = await prisma.student.findMany({
    where:   { schoolId: school.id, classId, status: "ACTIVE" },
    orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }, { admissionNo: "asc" }],
    select: {
      id: true, admissionNo: true, rollNumber: true,
      user: { select: { fullName: true } },
    },
  })
  if (students.length === 0) {
    return NextResponse.json({ error: "No active students in this class" }, { status: 404 })
  }

  // Forward the user's NextAuth session cookies so Puppeteer renders the
  // transcript page as the same logged-in user. We hand every cookie the
  // request brought to Chromium and let it pick the right ones.
  const reqCookies = req.cookies.getAll()
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")
  const origin = `${proto}://${host}`

  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const zip = new JSZip()
    const page = await browser.newPage()
    await page.setCookie(
      ...reqCookies.map(c => ({
        name:   c.name,
        value:  c.value,
        domain: host.split(":")[0],
        path:   "/",
      })),
    )

    for (const stu of students) {
      const target = `${origin}/academics/evaluations/transcript/${stu.id}?evaluationId=${evaluationId}`
      await page.goto(target, { waitUntil: "networkidle0", timeout: 60_000 })
      await page.emulateMediaType("print")
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
        preferCSSPageSize: false,
      })
      const idPart   = stu.rollNumber || stu.admissionNo
      const namePart = sanitize(stu.user.fullName)
      zip.file(`${idPart}_${namePart}.pdf`, pdf)
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })
    const filename  = `Gradesheets_${sanitize(klass.name)}_${sanitize(evaluation.name)}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      String(zipBuffer.length),
      },
    })
  } catch (err) {
    console.error("[transcript-pdf] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 },
    )
  } finally {
    if (browser) await browser.close()
  }
}
