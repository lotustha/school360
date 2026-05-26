import { getServerSession, type Session } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"

export const SYSTEM_PERMISSIONS = [
  {
    module: "Academics",
    permissions: [
      { code: "academic:view", label: "View Academics", description: "View subjects, classes, and sections." },
      { code: "academic:manage", label: "Manage Academics", description: "Create and edit subjects and syllabus." },
      { code: "gradebook:view", label: "View Gradebook", description: "View student marks and report cards." },
      { code: "gradebook:edit", label: "Edit Gradebook", description: "Enter and edit student marks." },
    ]
  },
  {
    module: "Finance & Accounts",
    permissions: [
      { code: "finance:view",          label: "View Finances",     description: "View fee structures, vouchers, ledger, and reports." },
      { code: "finance:manage",        label: "Manage Finances",   description: "Create/post vouchers, manage chart of accounts, close fiscal year." },
      { code: "finance:billing",       label: "Manage Billing",    description: "Create plans, assign to students/groups, generate bills, edit overrides." },
      { code: "finance:billing:view",  label: "View Billing",      description: "View student ledgers, bills, aging, and billing audit log." },
      { code: "payroll:view",          label: "View Payroll",      description: "View employee payroll and salary sheets." },
      { code: "payroll:manage",        label: "Manage Payroll",    description: "Process payroll, TDS, and SSF calculations." },
    ]
  },
  {
    module: "Users & HR",
    permissions: [
      { code: "student:view", label: "View Students", description: "View the student directory." },
      { code: "student:manage", label: "Manage Students", description: "Admit new students and edit profiles." },
      { code: "employee:view", label: "View Employees", description: "View staff and teacher directory." },
      { code: "employee:manage", label: "Manage Employees", description: "Add and edit employee profiles." },
      { code: "attendance:view", label: "View Attendance", description: "View student and staff attendance." },
      { code: "attendance:manage", label: "Take Attendance", description: "Manually input or override attendance." },
    ]
  },
  {
    module: "System Settings",
    permissions: [
      { code: "settings:view", label: "View Settings", description: "View school configuration." },
      { code: "settings:manage", label: "Manage Settings", description: "Edit school configuration and integrations." },
      { code: "rbac:manage", label: "Manage Access Control", description: "Create roles and manage user permissions." },
    ]
  }
];

export const getAllPermissionCodes = () => {
  return SYSTEM_PERMISSIONS.flatMap(module => module.permissions.map(p => p.code));
};

// ─── ENFORCEMENT HELPERS ────────────────────────────────────────────────────
// Legacy roles bypass granular permission checks:
//   SUPER_ADMIN, SCHOOL_ADMIN → always allowed
// Everyone else: explicit UserPermission overrides win, otherwise their custom
// Role's RolePermission rows decide. No row = no permission.

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN"])

export async function getSchoolSession(): Promise<Session> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) {
    throw new Error("UNAUTHORIZED")
  }
  return session
}

export async function hasPermission(session: Session, code: string): Promise<boolean> {
  if (ADMIN_ROLES.has(session.user.role)) return true

  const userId = session.user.id
  if (!userId) return false

  // Explicit user-level override (grant or revoke) wins
  const userPerm = await prisma.userPermission.findFirst({
    where: { userId, permission: { code } },
    select: { isGranted: true },
  })
  if (userPerm) return userPerm.isGranted

  // Role-based grant
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleId: true },
  })
  if (!user?.roleId) return false

  const rolePerm = await prisma.rolePermission.findFirst({
    where: { roleId: user.roleId, permission: { code } },
    select: { id: true },
  })
  return !!rolePerm
}

/**
 * Server-action gate. Resolves session, verifies it has a school, and checks
 * permission `code`. Throws on failure. Returns the session so callers can
 * use session.user.schoolId / session.user.id without a second lookup.
 */
export async function requirePermission(code: string): Promise<Session> {
  const session = await getSchoolSession()
  if (await hasPermission(session, code)) return session
  throw new Error("FORBIDDEN")
}
