import type { Session } from "next-auth"
import { getSchoolSession, hasPermission, requirePermission } from "@/lib/permissions"

// Thin permission-gate helpers layered on top of src/lib/permissions.ts (the
// canonical RBAC implementation: requirePermission(code) / hasPermission).
//
// NOTE: this file previously held a DUPLICATE permission checker with a
// (schoolId, userId, code) signature. That implementation was removed in
// Phase 0.6 — always use requirePermission(code) from "@/lib/permissions"
// or the helpers below.

/**
 * requirePermission + explicit tenant check. Use in legacy-style server
 * actions that accept a client-supplied `schoolId` argument: verifies the
 * caller's session school matches the supplied id before any query runs.
 * Returns the session so callers can use session.user.schoolId / .id.
 */
export async function requireSchoolPermission(
  code: string,
  schoolId?: string,
): Promise<Session> {
  const session = await requirePermission(code)
  if (schoolId !== undefined && schoolId !== session.user.schoolId) {
    throw new Error("FORBIDDEN")
  }
  return session
}

/**
 * Passes if the session holds ANY of the given permission codes (e.g. a
 * read gate that accepts either `exam:view` or the stronger `exam:manage`).
 * Optionally verifies a client-supplied schoolId against the session.
 */
export async function requireAnyPermission(
  codes: string[],
  schoolId?: string,
): Promise<Session> {
  const session = await getSchoolSession()
  if (schoolId !== undefined && schoolId !== session.user.schoolId) {
    throw new Error("FORBIDDEN")
  }
  for (const code of codes) {
    if (await hasPermission(session, code)) return session
  }
  throw new Error("FORBIDDEN")
}
