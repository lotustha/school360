/**
 * storage.ts — shared file-upload storage utility (local-disk backend).
 *
 * All upload paths in the app go through this module so the backend can be
 * swapped later (S3 / Supabase / R2) behind the same storage-agnostic API:
 *
 *   saveUpload(category, file, opts?)  → public URL string
 *   deleteUpload(publicUrl)            → void (idempotent)
 *
 * Current backend writes to  public/uploads/{category}/{randomId}.{ext}
 * and returns root-relative URLs ("/uploads/{category}/{file}") served by
 * Next.js static file handling.
 *
 * ⚠ Deployment note: writing to public/ works for the current local / VPS
 * single-instance deployment but breaks on Vercel / serverless / multi-
 * instance hosting (read-only or non-shared filesystem). Before any such
 * deploy, re-implement saveUpload/deleteUpload against an S3-compatible
 * store — callers do not need to change.
 */

import { writeFile, mkdir, unlink } from "node:fs/promises"
import { join, resolve, sep, posix } from "node:path"
import { randomBytes } from "node:crypto"

// ───────────────────────────── Validation constants ─────────────────────────

/** Safe raster image types (no SVG — can carry scripts; uploads may be unauthenticated). */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

/** Document-ish types accepted for study materials / attachments. */
export const DOCUMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
] as const

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024 // 20MB

/** MIME → canonical file extension. */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
}

// ───────────────────────────────── Errors ───────────────────────────────────

export type UploadErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "INVALID_CATEGORY"
  | "INVALID_URL"

/**
 * Thrown by saveUpload/deleteUpload on validation failure. `status` maps
 * directly to an HTTP status code for API routes.
 */
export class UploadError extends Error {
  constructor(
    public readonly code: UploadErrorCode,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = "UploadError"
  }
}

// ─────────────────────────────── Internals ──────────────────────────────────

const UPLOADS_ROOT = join(process.cwd(), "public", "uploads")
const PUBLIC_PREFIX = "/uploads"

function sanitizeCategory(category: string): string {
  const clean = category.toLowerCase().trim()
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clean)) {
    throw new UploadError("INVALID_CATEGORY", `Invalid upload category: ${category}`, 400)
  }
  return clean
}

/** Derive a safe extension from MIME type first, then the original file name. */
function deriveExt(mimeType: string | undefined, originalName: string | undefined): string {
  if (mimeType && MIME_EXT[mimeType]) return MIME_EXT[mimeType]
  const fromName = originalName?.includes(".")
    ? originalName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : ""
  return fromName && fromName.length <= 8 ? fromName : "bin"
}

export interface SaveUploadOptions {
  /** Max allowed size in bytes. Default: MAX_DOCUMENT_BYTES (20MB). */
  maxBytes?: number
  /** Allowed MIME types. Default: no MIME restriction (size still enforced). */
  allowedTypes?: readonly string[]
  /** Original file name — used for extension fallback when passing a Buffer. */
  originalName?: string
}

// ─────────────────────────────── Public API ─────────────────────────────────

/**
 * Validate and persist an uploaded file.
 *
 * @param category  logical bucket, e.g. "avatars" | "logos" | "materials" — becomes the subfolder
 * @param file      a web File/Blob (from formData) or a Node Buffer
 * @returns         public URL, e.g. "/uploads/avatars/a1b2c3….jpg"
 * @throws          UploadError on validation failure
 */
export async function saveUpload(
  category: string,
  file: File | Buffer,
  opts: SaveUploadOptions = {},
): Promise<string> {
  const dir = sanitizeCategory(category)
  const maxBytes = opts.maxBytes ?? MAX_DOCUMENT_BYTES

  const isBuffer = Buffer.isBuffer(file)
  const size = isBuffer ? file.length : file.size
  const mimeType = isBuffer ? undefined : file.type || undefined
  const originalName = opts.originalName ?? (isBuffer ? undefined : file.name)

  if (!size) {
    throw new UploadError("EMPTY_FILE", "File is empty", 400)
  }
  if (size > maxBytes) {
    throw new UploadError(
      "FILE_TOO_LARGE",
      `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`,
      413,
    )
  }
  if (opts.allowedTypes && mimeType !== undefined && !opts.allowedTypes.includes(mimeType)) {
    throw new UploadError("UNSUPPORTED_TYPE", `Unsupported file type: ${mimeType || "unknown"}`, 415)
  }
  // A Buffer carries no MIME type; when a type whitelist is requested, fall
  // back to checking the extension implied by originalName.
  if (opts.allowedTypes && mimeType === undefined) {
    const allowedExts = new Set(opts.allowedTypes.map((t) => MIME_EXT[t]).filter(Boolean))
    const ext = deriveExt(undefined, originalName)
    if (!allowedExts.has(ext)) {
      throw new UploadError("UNSUPPORTED_TYPE", `Unsupported file type: .${ext}`, 415)
    }
  }

  const ext = deriveExt(mimeType, originalName)
  const fileName = `${randomBytes(12).toString("hex")}.${ext}`
  const buf = isBuffer ? file : Buffer.from(await file.arrayBuffer())

  const targetDir = join(UPLOADS_ROOT, dir)
  await mkdir(targetDir, { recursive: true })
  await writeFile(join(targetDir, fileName), buf)

  return posix.join(PUBLIC_PREFIX, dir, fileName)
}

/**
 * Delete a previously saved upload by its public URL.
 * Silently ignores missing files; rejects URLs outside /uploads/ (or with
 * path traversal) with UploadError.
 */
export async function deleteUpload(publicUrl: string): Promise<void> {
  if (!publicUrl.startsWith(`${PUBLIC_PREFIX}/`)) {
    throw new UploadError("INVALID_URL", "Not an uploads URL", 400)
  }
  const relative = publicUrl.slice(PUBLIC_PREFIX.length + 1)
  const target = resolve(UPLOADS_ROOT, relative)
  // Guard against path traversal — resolved path must stay inside uploads root.
  if (!target.startsWith(resolve(UPLOADS_ROOT) + sep)) {
    throw new UploadError("INVALID_URL", "Invalid uploads path", 400)
  }
  try {
    await unlink(target)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
  }
}
