import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

const MAX_BYTES   = 5 * 1024 * 1024  // 5MB
const ALLOWED     = new Set(["image/jpeg", "image/png", "image/webp"])
const PUBLIC_DIR  = join(process.cwd(), "public", "uploads", "avatars")
const PUBLIC_PATH = "/uploads/avatars"

export async function POST(req: NextRequest) {
  // Require an authenticated user
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const id  = randomBytes(12).toString("hex")
  const fileName = `${id}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  await mkdir(PUBLIC_DIR, { recursive: true })
  await writeFile(join(PUBLIC_DIR, fileName), buf)

  return NextResponse.json({ url: `${PUBLIC_PATH}/${fileName}` })
}
