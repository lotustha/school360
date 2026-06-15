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
      { code: "timetable:view", label: "View Timetable", description: "View class routines and teacher schedules." },
      { code: "timetable:manage", label: "Manage Timetable", description: "Build and edit class routines and teacher assignments." },
      { code: "exam:view", label: "View Exams", description: "View exams, papers, schedules, and seating plans." },
      { code: "exam:manage", label: "Manage Exams", description: "Create exams, schedule papers, assign rooms and invigilators." },
      { code: "calendar:view", label: "View Academic Calendar", description: "View school events and holidays." },
      { code: "calendar:manage", label: "Manage Academic Calendar", description: "Create and edit calendar events and holidays." },
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
      { code: "leave:view", label: "View Leave Requests", description: "View staff leave requests and balances." },
      { code: "leave:manage", label: "Manage Leaves", description: "Approve/reject leave requests and configure leave types." },
      { code: "admission:view", label: "View Admissions", description: "View online admission forms and inquiries." },
      { code: "admission:manage", label: "Manage Admissions", description: "Open/close admission forms, shortlist and enroll inquiries." },
    ]
  },
  {
    module: "Communications",
    permissions: [
      { code: "notice:view", label: "View Notices", description: "View the school notice board." },
      { code: "notice:manage", label: "Manage Notices", description: "Publish, edit, and expire notices and attachments." },
      { code: "notification:manage", label: "Manage Notification Settings", description: "Configure SMS gateway and email provider credentials." },
      { code: "notification:send", label: "Send Notifications", description: "Send SMS/email/push notifications to students, parents, and staff." },
    ]
  },
  {
    module: "Operations",
    permissions: [
      { code: "library:view", label: "View Library", description: "View the book catalog, memberships, and issue history." },
      { code: "library:manage", label: "Manage Library", description: "Add books, issue/return books, and manage fines." },
      { code: "transport:view", label: "View Transport", description: "View vehicles, routes, and student transport assignments." },
      { code: "transport:manage", label: "Manage Transport", description: "Manage vehicles, routes, and student route assignments." },
      { code: "documents:view", label: "View Issued Documents", description: "View issued certificates and ID cards." },
      { code: "documents:manage", label: "Issue Documents", description: "Issue certificates, ID cards, and verification QR codes." },
      { code: "hostel:view", label: "View Hostel", description: "View hostels, rooms, occupancy, and allocations." },
      { code: "hostel:manage", label: "Manage Hostel", description: "Create hostels and rooms, allocate and vacate students." },
    ]
  },
  {
    module: "Higher Education",
    permissions: [
      { code: "programme:view", label: "View Programmes", description: "View programmes, semesters, course offerings, and GPA records." },
      { code: "programme:manage", label: "Manage Programmes", description: "Create programmes and semesters, offer courses, publish semester grades." },
      { code: "enrollment:manage", label: "Manage HE Enrollment", description: "Enroll students in programmes and courses, manage registration and academic status." },
      { code: "research:view", label: "View Research", description: "View theses, chapter submissions, and viva schedules." },
      { code: "research:manage", label: "Manage Research", description: "Approve proposals, review chapters, schedule vivas, and record results." },
      { code: "internship:view", label: "View Internships", description: "View internships, diary entries, and evaluations." },
      { code: "internship:manage", label: "Manage Internships", description: "Register internships, review diaries, and enter evaluation marks." },
      { code: "alumni:view", label: "View Alumni", description: "View the alumni directory and job board." },
      { code: "alumni:manage", label: "Manage Alumni", description: "Verify alumni profiles and manage job postings." },
    ]
  },
  {
    module: "Online Learning (LMS)",
    permissions: [
      { code: "lms:view", label: "View LMS", description: "View courses, lessons, and own progress." },
      { code: "lms:manage", label: "Manage LMS Courses", description: "Build courses, modules, and lessons; manage enrollments." },
      { code: "lms:live:manage", label: "Manage Live Classes", description: "Schedule, start, and end live classes; record attendance and recordings." },
      { code: "lms:assignments:manage", label: "Manage Assignments", description: "Create and edit assignments and late policies." },
      { code: "lms:assignments:grade", label: "Grade Assignments", description: "Grade submissions and give feedback." },
      { code: "lms:quizzes:manage", label: "Manage Quizzes", description: "Build quizzes and questions, configure attempts, and view results." },
      { code: "lms:discussions:moderate", label: "Moderate Discussions", description: "Pin, lock, and delete threads; mark accepted answers." },
      { code: "lms:analytics:view", label: "View Learning Analytics", description: "View course engagement, progress, and performance dashboards." },
    ]
  },
  {
    module: "Reports",
    permissions: [
      { code: "reports:view", label: "View Reports", description: "View analytics dashboards and MoE/IRD compliance reports." },
    ]
  },
  {
    module: "System Settings",
    permissions: [
      { code: "settings:view", label: "View Settings", description: "View school configuration." },
      { code: "settings:manage", label: "Manage Settings", description: "Edit school configuration and integrations." },
      { code: "rbac:manage", label: "Manage Access Control", description: "Create roles and manage user permissions." },
      { code: "audit:view", label: "View Audit Log", description: "View the system audit log." },
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
