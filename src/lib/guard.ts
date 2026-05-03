import { prisma } from "@/lib/prisma"

export class PermissionError extends Error {
  constructor(code: string) {
    super(`Missing permission: ${code}`)
    this.name = "PermissionError"
  }
}

export async function requirePermission(
  schoolId: string,
  userId: string,
  code: string
): Promise<true> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      userPermissions: { include: { permission: true } },
      customRole: { include: { permissions: { include: { permission: true } } } },
    },
  })

  if (!user) throw new PermissionError(code)
  if (user.role === "SUPER_ADMIN" || user.role === "SCHOOL_ADMIN") return true

  const override = user.userPermissions.find(up => up.permission.code === code)
  if (override) {
    if (!override.isGranted) throw new PermissionError(code)
    return true
  }

  const hasViaRole = user.customRole?.permissions.some(
    rp => rp.permission.code === code
  )
  if (hasViaRole) return true

  throw new PermissionError(code)
}

export async function hasPermission(
  schoolId: string,
  userId: string,
  code: string
): Promise<boolean> {
  try {
    await requirePermission(schoolId, userId, code)
    return true
  } catch {
    return false
  }
}
