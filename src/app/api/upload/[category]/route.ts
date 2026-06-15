import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import {
  saveUpload,
  UploadError,
  IMAGE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/storage"

/**
 * Generic authenticated upload endpoint: POST /api/upload/{category}
 * with multipart form-data field "file". Returns { url }.
 *
 * Replaces the old /api/upload/avatar route — "avatar" is now just one
 * configured category. Add new categories to UPLOAD_CATEGORIES below
 * instead of creating new routes.
 */

interface CategoryConfig {
  /** Subfolder under public/uploads/ */
  dir: string
  maxBytes: number
  allowedTypes: readonly string[]
}

const UPLOAD_CATEGORIES: Record<string, CategoryConfig> = {
  // Student/employee profile photos (cropped client-side by AvatarUploader)
  avatar: { dir: "avatars", maxBytes: MAX_IMAGE_BYTES, allowedTypes: IMAGE_MIME_TYPES },
  // General document attachments (notices, admission docs, etc.)
  document: { dir: "documents", maxBytes: MAX_DOCUMENT_BYTES, allowedTypes: DOCUMENT_MIME_TYPES },
  // Issued certificates / report-card scans
  certificate: { dir: "certificates", maxBytes: MAX_DOCUMENT_BYTES, allowedTypes: DOCUMENT_MIME_TYPES },
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  // All categories on this endpoint require an authenticated user.
  // (The unauthenticated onboarding logo upload goes through its own
  // server action, not this route.)
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { category } = await params
  const config = UPLOAD_CATEGORIES[category]
  if (!config) {
    return NextResponse.json({ error: `Unknown upload category: ${category}` }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  try {
    const url = await saveUpload(config.dir, file as File, {
      maxBytes: config.maxBytes,
      allowedTypes: config.allowedTypes,
    })
    return NextResponse.json({ url })
  } catch (e) {
    if (e instanceof UploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("UPLOAD_ERROR", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
