# School360 Nepal ERP — Master Implementation Roadmap

> **Stack:** Next.js 15+ App Router · TypeScript · Prisma 7 · Supabase PostgreSQL · shadcn/ui · Tailwind CSS v4 · NextAuth v4  
> **Pattern:** All CRUD via Server Actions · Multi-tenant via subdomain rewrite · RBAC permission gates  
> **Last updated:** 2026-05-03

---

## Quick-Reference: Established Patterns

Before building any feature, every developer must internalize these patterns:

| Pattern | Source File | Key Rule |
|---------|-------------|----------|
| Server action | `src/actions/academics.ts` | `"use server"`, call `revalidatePath()` after mutation |
| Data-table page | `src/app/[domain]/academics/faculties/page.tsx` | Async RSC, fetch data, pass to `<DataTable>` |
| Drawer form | `src/app/[domain]/academics/faculties/faculty-drawer.tsx` | `"use client"`, RHF + Zod, `router.refresh()` after success |
| Column definitions | `src/app/[domain]/academics/faculties/columns.tsx` | Typed `FacultyColumn`, `ColumnDef<T>[]` array |
| Empty state | `src/components/ui/empty.tsx` | `<Empty><EmptyMedia variant="icon"><EmptyHeader>` |
| Prisma isolation | All server actions | **Always** filter by `schoolId` from session/params |
| Session shape | `src/auth.ts` | `session.user.{ id, role, schoolId, schoolSlug }` |
| Permissions | `src/lib/permissions.ts` | 16+ codes, check before any mutation |

---

## Phase 0 — Foundation Infrastructure
**Priority: CRITICAL — Do before any feature work**
**Complexity: Medium**
**Dependencies: None**

### 0.1 Auth & Session Helpers

**New file:** `src/lib/auth.ts`

```ts
// Pattern to use in every server action and server component
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.schoolId) throw new Error("Unauthorized")
  return session.user
}

export async function getSchoolId(domain: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { slug: domain },
    select: { id: true },
  })
  if (!school) notFound()
  return school.id
}
```

### 0.2 Permission Guard Utility

**New file:** `src/lib/guard.ts`

```ts
// Use at the top of every server action that requires a permission
export async function requirePermission(schoolId: string, userId: string, code: string) {
  // 1. Check UserPermission overrides (isGranted=false blocks even if role allows)
  // 2. Check Role permissions via user.roleId → RolePermission
  // 3. Throw 403 if not granted
}
```

### 0.3 Module Access Guard

**New file:** `src/lib/modules.ts`

```ts
// Returns active module keys for a school (checks trial expiry)
export async function getActiveModules(schoolId: string): Promise<string[]>

// Throws if school doesn't have the module or trial expired
export async function requireModule(schoolId: string, moduleKey: string): Promise<void>
```

### 0.4 Nepal Date Utilities

**New file:** `src/lib/nepali-date.ts`

```ts
import NepaliDate from "nepali-date-converter"

export function todayBS(): string           // "2081-01-15"
export function toBS(date: Date): string    // AD → BS string
export function toAD(bsStr: string): Date   // BS string → AD Date
export function formatBS(bsStr: string): string  // "Baishakh 15, 2081"
export function currentBSYear(): number
export function currentAcademicYear(): { start: string; end: string; name: string }
```

### 0.5 IRD/Finance Computation Utilities

**New file:** `src/lib/finance.ts`

```ts
// TDS brackets per Nepal Income Tax Act FY 2081/82
export function computeTDS(annualSalary: number): number

// SSF: employee 11%, employer 20% of basic salary
export function computeSSF(basicSalary: number): { employee: number; employer: number }

// VAT: 13% on taxable amount
export function addVAT(amount: number): { subtotal: number; vat: number; total: number }
```

### 0.6 Permission System Expansion

**Update:** `src/lib/permissions.ts` — add new permission codes:

```
timetable:view, timetable:manage      (NEW)
exam:view, exam:manage                (NEW — for EXAM_CAS module)
library:view, library:manage          (NEW)
transport:view, transport:manage      (NEW — for TRANSPORT_GPS module)
notice:view, notice:manage            (NEW)
leave:view, leave:manage              (NEW)
audit:view                            (NEW)
```

### Verification Checklist
- [ ] `requireSession()` returns correct `schoolId` in both RSC and Server Actions
- [ ] `requirePermission()` checks UserPermission overrides before Role permissions
- [ ] `getActiveModules()` returns module keys with trial expiry check
- [ ] `todayBS()` returns correct Bikram Sambat date string
- [ ] TDS brackets match Nepal FY 2081/82 rates
- [ ] SSF: employee = `basic * 0.11`, employer = `basic * 0.20`

---

## Phase 1 — Core Platform: Students
**Priority: HIGH — Unlocks all other modules**
**Complexity: High**
**Dependencies: Phase 0**
**Permission codes:** `student:view`, `student:manage`

### 1.1 Schema Additions

```prisma
model Student {
  id            String    @id @default(cuid())
  userId        String    @unique
  schoolId      String
  rollNumber    String?
  admissionNo   String

  classId       String
  sectionId     String?

  // Nepal-specific identity
  dobBS         String                      // "2065-03-12" Bikram Sambat
  dobAD         DateTime?
  gender        String                      // MALE | FEMALE | OTHER
  bloodGroup    String?
  religion      String?
  caste         String?                     // Nepal CBS caste categories
  ethnicity     String?
  motherTongue  String?

  // Address
  permanentAddress  String?
  temporaryAddress  String?
  district          String?                 // 77 districts of Nepal
  municipality      String?
  wardNo            String?

  // Status
  enrolledAt    DateTime  @default(now())
  leftAt        DateTime?
  status        String    @default("ACTIVE") // ACTIVE | LEFT | GRADUATED | SUSPENDED

  school        School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  class         Class     @relation(fields: [classId], references: [id])
  section       Section?  @relation(fields: [sectionId], references: [id])
  guardians     StudentGuardian[]
  attendances   Attendance[]
  documents     StudentDocument[]
  feeCollections FeeCollection[]
  markSheets    MarkSheet[]
  transport     StudentTransport?

  @@unique([schoolId, admissionNo])
  @@map("students")
}

model StudentGuardian {
  id           String   @id @default(cuid())
  studentId    String
  name         String
  relation     String   // FATHER | MOTHER | GUARDIAN
  phone        String
  email        String?
  occupation   String?
  isPrimary    Boolean  @default(false)
  student      Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@map("student_guardians")
}

model StudentDocument {
  id          String   @id @default(cuid())
  studentId   String
  type        String   // BIRTH_CERT | CITIZENSHIP | MIGRATION | CHARACTER | SLC | NEB
  fileUrl     String
  fileName    String
  uploadedAt  DateTime @default(now())
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@map("student_documents")
}
```

**Also update:** Add `student Student?` to `User` model, `students Student[]` to `Class` and `Section` models.

### 1.2 Routes to Create

```
src/app/[domain]/students/
├── page.tsx                    # Student directory table (server RSC)
├── columns.tsx                 # StudentColumn + ColumnDef[]
├── student-drawer.tsx          # Quick-add drawer (minimal fields)
├── student-filters.tsx         # Class/Section/Status filter bar (client)
├── [studentId]/
│   ├── page.tsx                # Full student profile view
│   └── edit/
│       └── page.tsx            # Edit student form
└── new/
    └── page.tsx                # Multi-step full enrollment form
```

### 1.3 Server Actions

**New file:** `src/actions/students.ts`

```ts
export async function getStudents(schoolId: string, filters?: {
  classId?: string; sectionId?: string; status?: string
})
export async function getStudentById(schoolId: string, studentId: string)
export async function enrollStudent(schoolId: string, data: EnrollStudentInput): Promise<Student>
  // Creates User (role: "STUDENT") + Student record in $transaction
  // Auto-generates admissionNo: {slug}-{BSYear}-{seq padded to 4}
export async function updateStudent(schoolId: string, studentId: string, data: Partial<StudentInput>)
export async function updateStudentStatus(schoolId: string, studentId: string, status: string)
export async function addGuardian(studentId: string, data: GuardianInput)
```

### 1.4 Nepal-Specific Requirements
- `admissionNo` format: `{schoolSlug}-{BSYear}-{0042}` e.g. `gyan-2081-0042`
- District dropdown: all 77 Nepal districts (hardcode list in `src/lib/nepal-data.ts`)
- Caste categories: Brahmin, Chhetri, Janajati, Dalit, Muslim, Others (per Nepal CBS)
- SLC/SEE registration number field for Grade 9–10 students
- NEB registration number field for Grade 11–12

---

## Phase 1B — Attendance System
**Priority: HIGH**
**Complexity: Medium**
**Dependencies: Phase 1**
**Permission codes:** `attendance:view`, `attendance:manage`

### Schema Additions

```prisma
model Attendance {
  id          String   @id @default(cuid())
  studentId   String
  schoolId    String
  classId     String
  sectionId   String?
  dateBS      String                           // "2081-01-15"
  dateAD      DateTime
  period      Int?                             // null=daily, 1-8=period-wise
  status      String   // PRESENT | ABSENT | LATE | EXCUSED
  note        String?
  takenById   String
  createdAt   DateTime @default(now())

  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  school      School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  takenBy     User     @relation("AttendanceTaker", fields: [takenById], references: [id])

  @@unique([studentId, dateBS, period])
  @@map("attendances")
}
```

### Routes

```
src/app/[domain]/attendance/
├── page.tsx              # Today's attendance overview (class-wise completion status)
├── take/
│   └── page.tsx          # Class+Section selector → student grid with status toggles
├── history/
│   └── page.tsx          # Calendar-based history with filters
└── report/
    └── page.tsx          # Monthly attendance report table per student
```

### Server Actions

**New file:** `src/actions/attendance.ts`

```ts
export async function takeAttendance(schoolId: string, data: {
  classId: string; sectionId?: string; dateBS: string; period?: number
  records: { studentId: string; status: string; note?: string }[]
  takenById: string
})
export async function getAttendanceByDate(schoolId: string, classId: string, dateBS: string)
export async function getStudentAttendanceSummary(schoolId: string, studentId: string, monthBS: string)
// Returns: { present: n, absent: n, late: n, percentage: 85.5 }
```

### Nepal-Specific
- BS calendar for date selection (use `nepali-date-converter`)
- Exclude public holidays from attendance calculation
- Minimum 75% attendance threshold warning (Nepal education guidelines)
- Period-wise attendance only for secondary (Grade 6+)

---

## Phase 1C — Notice Board
**Priority: MEDIUM**
**Complexity: Low**
**Dependencies: Phase 0**
**Permission codes:** `notice:view`, `notice:manage`

### Schema Additions

```prisma
model Notice {
  id          String   @id @default(cuid())
  schoolId    String
  title       String
  body        String   @db.Text
  audience    String   @default("ALL")     // ALL | STUDENTS | STAFF | PARENTS
  priority    String   @default("NORMAL")  // NORMAL | HIGH | URGENT
  publishedAt DateTime @default(now())
  expiresAt   DateTime?
  createdById String
  isActive    Boolean  @default(true)
  attachments NoticeAttachment[]
  school      School   @relation(...)
  createdBy   User     @relation(...)
  @@map("notices")
}

model NoticeAttachment {
  id        String @id @default(cuid())
  noticeId  String
  fileUrl   String
  fileName  String
  notice    Notice @relation(...)
  @@map("notice_attachments")
}
```

### Routes

```
src/app/[domain]/notices/
├── page.tsx          # Notice board list with priority badges
└── new/
    └── page.tsx      # Create notice (title, body, audience, expiry, attachments)
```

---

## Phase 2 — Academics Extension: Timetable
**Priority: MEDIUM**
**Complexity: High**
**Dependencies: Phase 1**
**Permission codes:** `timetable:view`, `timetable:manage`

### Schema Additions

```prisma
model TimeSlot {
  id          String   @id @default(cuid())
  schoolId    String
  name        String                           // "Period 1", "Break", "Lunch"
  startTime   String                           // "10:00"
  endTime     String                           // "10:45"
  order       Int
  isBreak     Boolean  @default(false)
  school      School   @relation(...)
  timetable   Timetable[]
  @@map("time_slots")
}

model Timetable {
  id             String   @id @default(cuid())
  schoolId       String
  classId        String
  sectionId      String?
  academicYearId String
  dayOfWeek      Int      // 0=Sunday ... 6=Saturday
  timeSlotId     String
  subjectId      String?
  teacherId      String?
  school         School    @relation(...)
  class          Class     @relation(...)
  section        Section?  @relation(...)
  timeSlot       TimeSlot  @relation(...)
  subject        Subject?  @relation(...)
  teacher        User?     @relation("TeacherTimetable", ...)
  @@unique([classId, sectionId, academicYearId, dayOfWeek, timeSlotId])
  @@map("timetable")
}

model TeacherSubjectAssignment {
  id             String @id @default(cuid())
  teacherId      String
  subjectId      String
  classId        String
  sectionId      String?
  schoolId       String
  academicYearId String
  school         School @relation(...)
  @@unique([teacherId, subjectId, classId, sectionId, academicYearId])
  @@map("teacher_subject_assignments")
}
```

### Routes

```
src/app/[domain]/timetable/
├── page.tsx          # Weekly grid view (class selector)
├── builder/
│   └── page.tsx      # Drag-and-drop builder (@dnd-kit/core)
├── teachers/
│   └── page.tsx      # Teacher schedule view
└── assignments/
    └── page.tsx      # Teacher ↔ Subject ↔ Class table
```

### Server Actions — `src/actions/timetable.ts`

```ts
export async function getTimetable(schoolId: string, classId: string, sectionId?: string, academicYearId?: string)
export async function setTimetableSlot(schoolId: string, data: TimetableSlotInput)
export async function clearTimetableSlot(timetableId: string)
export async function getTeacherSchedule(schoolId: string, teacherId: string)
export async function assignTeacherToSubject(schoolId: string, data: TeacherAssignmentInput)
// Conflict detection: warn if teacher already assigned for same period
```

---

## Phase 3 — Exam & CAS Module (EXAM_CAS)
**Priority: HIGH**
**Complexity: High**
**Dependencies: Phase 1, Phase 2**
**Permission codes:** `exam:view`, `exam:manage`, `gradebook:view`, `gradebook:edit`
**Module gate:** `EXAM_CAS`

### 3.1 Schema Additions

```prisma
model MarkSheet {
  id            String   @id @default(cuid())
  schoolId      String
  studentId     String
  examId        String
  classId       String
  totalObtained Float?
  totalFull     Float?
  percentage    Float?
  gpa           Float?   // NEB GPA 0.0–4.0
  grade         String?  // A+, A, B+, B, C+, C, D, E, NG
  rank          Int?
  isPublished   Boolean  @default(false)
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  school        School   @relation(...)
  student       Student  @relation(...)
  @@unique([studentId, examId])
  @@map("mark_sheets")
}
```

**CAS breakdown JSON structure** (stored in `Mark.breakdownMarks`):
```json
{
  "participation": 2.5,
  "project":       14,
  "term1":         3,
  "term2":         2.5
}
```

### 3.2 GPA Tables

**New file:** `src/lib/grading.ts`

**NEB Grade Conversion (Grades 9–12):**
```
90–100 → A+ (4.0) Outstanding
80–89  → A  (3.6) Excellent
70–79  → B+ (3.2) Very Good
60–69  → B  (2.8) Good
50–59  → C+ (2.4) Satisfactory
40–49  → C  (2.0) Acceptable
35–39  → D  (1.6) Partially Acceptable
<35    → E  (0.8) Insufficient / NG
```

**CDC Grading (Grades 1–8):**
```
90–100 → A+  Excellent
75–89  → A   Very Good
60–74  → B+  Good
45–59  → B   Satisfactory
33–44  → C+  Acceptable
<33    → C   Below Average
```

```ts
export function getNEBGrade(percentage: number): { grade: string; gpa: number; description: string }
export function getCDCGrade(percentage: number): { grade: string; description: string }
export function calculateNEBGPA(subjects: { creditHours: number; gpa: number }[]): number
export function isPassingNEB(percentage: number, passMarks: number): boolean
```

### 3.3 Routes

```
src/app/[domain]/exams/
├── page.tsx                  # Exam list for current academic year
├── new/
│   └── page.tsx              # Create exam
├── [examId]/
│   ├── page.tsx              # Exam overview (per-class completion stats)
│   ├── marks/
│   │   └── page.tsx          # Mark entry: class → subject → student grid
│   ├── marksheet/
│   │   └── page.tsx          # View/generate marksheets
│   └── report-cards/
│       └── page.tsx          # Print report cards (PDF via @react-pdf/renderer)
└── cas/
    └── page.tsx              # CAS entry UI for Grades 1–8
```

### 3.4 Server Actions — `src/actions/exams.ts`

```ts
export async function createExam(schoolId: string, data: ExamInput)
export async function getExams(schoolId: string, academicYearId: string)
export async function deleteExam(examId: string, schoolId: string)
export async function getMarksForEntry(schoolId: string, examId: string, classId: string, subjectId: string)
// Returns: { students, existingMarks, component }
export async function saveMarks(schoolId: string, marks: MarkInput[])
// Upsert with @@unique([studentId, examId, subjectComponentId])
export async function computeMarkSheet(schoolId: string, studentId: string, examId: string): Promise<MarkSheet>
// Aggregates all marks → totals → percentage → GPA → grade → rank
export async function publishMarkSheets(schoolId: string, examId: string, classId: string)
export async function getReportCardData(schoolId: string, studentId: string, examId: string)
```

### 3.5 Mark Entry UI Pattern

```
1. Cascading selectors: Academic Year → Exam → Class → Section → Subject
2. Student grid columns: Roll No | Name | [Component columns] | Total | Grade | Status
3. Inline cell editing with auto-save on blur
4. CAS components show breakdown sub-inputs (participation, project, term1, term2)
5. Real-time total calculation
6. Progress bar: X/Y students marked
7. Lock button prevents further edits after submission
```

### 3.6 Nepal Compliance
- CAS mandatory for all Grades 1–8 (CDC guideline)
- NEB GPA calculation mandatory for Grades 9–12
- Pass marks: 33% Primary, 35% Secondary, 35% per subject NEB
- Report card must include: School PAN, MoE registration number, principal signature line
- Practical marks printed separately for Grade 11–12 Science

---

## Phase 4 — Finance & Tax Module (FINANCE_TAX)
**Priority: HIGH**
**Complexity: Very High**
**Dependencies: Phase 1 (Students), Phase 5 (HR)**
**Permission codes:** `finance:view`, `finance:manage`, `payroll:view`, `payroll:manage`
**Module gate:** `FINANCE_TAX`

### 4.1 Schema Additions

```prisma
// Extend FeeStructure:
//   feeType    String @default("MONTHLY")  // MONTHLY | TERM | ANNUAL | ONE_TIME
//   termNumber Int?
//   dueDay     Int?

model FeeCollection {
  id              String   @id @default(cuid())
  schoolId        String
  studentId       String
  feeStructureId  String
  academicYearId  String
  amount          Float
  discount        Float    @default(0)
  netAmount       Float
  paidAmount      Float    @default(0)
  dueAmount       Float
  dueDate         DateTime?
  status          String   @default("PENDING") // PENDING | PARTIAL | PAID | OVERDUE | WAIVED
  termMonth       Int?     // 1-12 (BS month)
  termYear        Int?     // BS year
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  payments        FeePayment[]
  school          School         @relation(...)
  student         Student        @relation(...)
  feeStructure    FeeStructure   @relation(...)
  @@map("fee_collections")
}

model FeePayment {
  id              String   @id @default(cuid())
  schoolId        String
  feeCollectionId String
  amount          Float
  paymentDate     DateTime @default(now())
  paymentDateBS   String
  method          String   // CASH | BANK | ESEWA | KHALTI | CHEQUE
  referenceNo     String?
  receivedById    String
  invoiceNo       String   @unique   // INV-2081-00042
  isVatBilled     Boolean  @default(false)
  vatAmount       Float    @default(0)
  remarks         String?
  createdAt       DateTime @default(now())
  school          School         @relation(...)
  feeCollection   FeeCollection  @relation(...)
  receivedBy      User           @relation(...)
  @@map("fee_payments")
}

model Expense {
  id              String   @id @default(cuid())
  schoolId        String
  title           String
  category        String   // SALARY | MAINTENANCE | SUPPLIES | UTILITIES | OTHER
  amount          Float
  vatAmount       Float    @default(0)
  expenseDate     DateTime
  expenseDateBS   String
  payee           String?
  panNumber       String?
  isTDSApplicable Boolean  @default(false)
  tdsAmount       Float    @default(0)
  receiptUrl      String?
  createdById     String
  createdAt       DateTime @default(now())
  school          School   @relation(...)
  createdBy       User     @relation(...)
  @@map("expenses")
}

model PayrollRun {
  id               String   @id @default(cuid())
  schoolId         String
  monthBS          String                      // "2081-01"
  status           String   @default("DRAFT") // DRAFT | APPROVED | PAID
  totalBasic       Float    @default(0)
  totalTDS         Float    @default(0)
  totalSSFEmployee Float    @default(0)
  totalSSFEmployer Float    @default(0)
  totalNet         Float    @default(0)
  approvedById     String?
  approvedAt       DateTime?
  paidAt           DateTime?
  createdAt        DateTime @default(now())
  slips            PayrollSlip[]
  school           School   @relation(...)
  @@unique([schoolId, monthBS])
  @@map("payroll_runs")
}

model PayrollSlip {
  id              String   @id @default(cuid())
  payrollRunId    String
  employeeId      String
  schoolId        String
  basicSalary     Float
  allowances      Json?    // { "dearness": 500, "house": 1000, "transport": 300 }
  grossSalary     Float
  tdsAmount       Float    @default(0)
  ssfEmployee     Float    @default(0)
  ssfEmployer     Float    @default(0)
  otherDeductions Float    @default(0)
  netSalary       Float
  isPaid          Boolean  @default(false)
  paidAt          DateTime?
  paymentMethod   String?
  remarks         String?
  createdAt       DateTime @default(now())
  payrollRun      PayrollRun @relation(...)
  employee        Employee   @relation(...)
  school          School     @relation(...)
  @@unique([payrollRunId, employeeId])
  @@map("payroll_slips")
}
```

### 4.2 Routes

```
src/app/[domain]/finance/
├── page.tsx                   # Overview: today's collection, pending dues, payroll status
├── fees/
│   ├── page.tsx               # Fee structures list
│   └── new/page.tsx           # Create fee structure
├── collections/
│   ├── page.tsx               # All student fee collections (with filters)
│   ├── collect/page.tsx       # Collect fee: search student → show dues → take payment
│   └── [collectionId]/page.tsx # Invoice view + print
├── expenses/
│   ├── page.tsx               # Expense ledger
│   └── new/page.tsx           # Record expense
├── cashbook/
│   └── page.tsx               # Daily cash/bank ledger (income vs expense)
├── payroll/
│   ├── page.tsx               # Payroll runs list by month
│   ├── run/page.tsx           # Run payroll (auto-compute for selected month)
│   └── [runId]/
│       ├── page.tsx           # Run detail: all employee slips
│       └── slip/[slipId]/page.tsx  # Talabi Bharpai (salary slip) — printable
└── reports/
    ├── vat/page.tsx           # VAT report (IRD format)
    └── tds/page.tsx           # TDS certificate per employee
```

### 4.3 Server Actions — `src/actions/finance.ts`

```ts
// Fee Structures
export async function createFeeStructure(schoolId: string, data: FeeStructureInput)
export async function updateFeeStructure(schoolId: string, id: string, data: Partial<FeeStructureInput>)
export async function deleteFeeStructure(schoolId: string, id: string)

// Fee Collection
export async function generateFeeCollections(schoolId: string, academicYearId: string, month: number, year: number)
// Bulk-creates FeeCollection for all ACTIVE students in matching classes

export async function collectFee(schoolId: string, data: CollectFeeInput): Promise<FeePayment>
// Auto-generates invoiceNo, updates collection status, applies VAT if flagged

export async function getStudentFeeStatus(schoolId: string, studentId: string, academicYearId: string)
export async function getOverdueFees(schoolId: string)
export async function getDailyCollectionSummary(schoolId: string, dateBS: string)

// Expenses
export async function recordExpense(schoolId: string, data: ExpenseInput)
export async function getExpensesByMonth(schoolId: string, monthBS: string)

// Payroll
export async function runPayroll(schoolId: string, monthBS: string): Promise<PayrollRun>
// For each active employee:
//   gross = basic + sum(allowances)
//   tds = computeTDS(gross * 12) / 12
//   ssf = computeSSF(basic)
//   net = gross - tds - ssf.employee
// Creates PayrollRun + PayrollSlip[] in $transaction

export async function approvePayrollRun(schoolId: string, runId: string, approvedById: string)
export async function markPayrollPaid(schoolId: string, runId: string)
export async function getPayrollSlip(schoolId: string, slipId: string)
```

### 4.4 Nepal IRD Compliance
- Invoice number format: `INV-{BSYear}-{seq 5-digit}` e.g. `INV-2081-00042`
- VAT invoice mandatory for transactions > Rs. 5,000 (add School VAT reg. no.)
- TDS brackets FY 2081/82: 1% up to 5L/yr, 10% on 5L-7L, 20% on 7L-10L, 30% above 10L
- SSF: employee 11% + employer 20% of basic salary
- Talabi Bharpai must include: employee PAN, bank account, position, all breakdowns
- IRD VAT report: output VAT, input VAT (from expenses), net VAT payable

---

## Phase 5 — HR & Staff Module
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 0**
**Permission codes:** `employee:view`, `employee:manage`, `attendance:view`, `attendance:manage`, `leave:view`, `leave:manage`

### Schema Additions

```prisma
// Extend Employee model with:
//   designation   String?   // "Principal" | "Teacher" | "Accountant"
//   department    String?   // "Science" | "Management" | "Admin"
//   joinDateBS    String?
//   employeeType  String  @default("PERMANENT") // PERMANENT | CONTRACT | PART_TIME
//   qualification String?

model StaffAttendance {
  id          String   @id @default(cuid())
  employeeId  String
  schoolId    String
  dateBS      String
  dateAD      DateTime
  checkIn     DateTime?
  checkOut    DateTime?
  status      String   // PRESENT | ABSENT | LATE | HALF_DAY | ON_LEAVE
  note        String?
  createdAt   DateTime @default(now())
  employee    Employee @relation(...)
  school      School   @relation(...)
  @@unique([employeeId, dateBS])
  @@map("staff_attendances")
}

model LeaveType {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "Sick Leave" | "Casual Leave" | "Maternity Leave"
  maxDays   Int
  isPaid    Boolean  @default(true)
  school    School   @relation(...)
  requests  LeaveRequest[]
  @@map("leave_types")
}

model LeaveRequest {
  id            String   @id @default(cuid())
  schoolId      String
  employeeId    String
  leaveTypeId   String
  fromDateBS    String
  toDateBS      String
  totalDays     Int
  reason        String
  status        String   @default("PENDING") // PENDING | APPROVED | REJECTED
  reviewedById  String?
  reviewedAt    DateTime?
  reviewNote    String?
  createdAt     DateTime @default(now())
  school        School     @relation(...)
  employee      Employee   @relation(...)
  leaveType     LeaveType  @relation(...)
  reviewedBy    User?      @relation(...)
  @@map("leave_requests")
}
```

### Routes

```
src/app/[domain]/hr/
├── page.tsx                   # HR overview: staff count, attendance today, pending leaves
├── staff/
│   ├── page.tsx               # Staff directory DataTable
│   ├── new/page.tsx           # Add staff (creates User + Employee in transaction)
│   └── [staffId]/
│       ├── page.tsx           # Staff profile (personal, payroll, leave history)
│       └── edit/page.tsx      # Edit profile
├── attendance/
│   ├── page.tsx               # Take staff attendance (today's register)
│   └── history/page.tsx       # Staff attendance calendar view
└── leaves/
    ├── page.tsx               # All leave requests with status filters
    ├── types/page.tsx         # Configure leave types
    └── [requestId]/page.tsx   # Review + approve/reject
```

### Server Actions — `src/actions/hr.ts`

```ts
export async function createEmployee(schoolId: string, data: EmployeeInput)
// Creates User (role: "STAFF") + Employee in $transaction

export async function updateEmployee(schoolId: string, employeeId: string, data: Partial<EmployeeInput>)
export async function getEmployees(schoolId: string, filters?: { department?: string; type?: string })
export async function takeStaffAttendance(schoolId: string, records: StaffAttendanceRecord[])
export async function createLeaveRequest(schoolId: string, employeeId: string, data: LeaveRequestInput)
export async function reviewLeaveRequest(schoolId: string, requestId: string, status: "APPROVED" | "REJECTED", note: string, reviewedById: string)
export async function getLeaveBalance(schoolId: string, employeeId: string, bsYear: number)
// Returns: { leaveType, used, remaining }[]
```

---

## Phase 6 — Transport GPS Module (TRANSPORT_GPS)
**Priority: LOW (module-gated)**
**Complexity: Medium**
**Dependencies: Phase 1**
**Module gate:** `TRANSPORT_GPS`

### Schema Additions

```prisma
model Vehicle {
  id         String   @id @default(cuid())
  schoolId   String
  regNumber  String   // "Ba 1 Kha 1234" (Nepal vehicle format)
  model      String?
  capacity   Int?
  driverId   String?
  status     String   @default("ACTIVE") // ACTIVE | MAINTENANCE | RETIRED
  createdAt  DateTime @default(now())
  school     School   @relation(...)
  driver     User?    @relation(...)
  routes     TransportRoute[]
  @@map("vehicles")
}

model TransportRoute {
  id            String   @id @default(cuid())
  schoolId      String
  vehicleId     String
  name          String   // "Lalitpur Route"
  stops         Json     // [{ name, lat, lng, order, estimatedTime }]
  morningTime   String   // "07:30"
  afternoonTime String   // "16:00"
  feePerMonth   Float    @default(0)
  isActive      Boolean  @default(true)
  school        School   @relation(...)
  vehicle       Vehicle  @relation(...)
  assignments   StudentTransport[]
  @@map("transport_routes")
}

model StudentTransport {
  id          String         @id @default(cuid())
  studentId   String         @unique
  routeId     String
  pickupStop  String
  dropStop    String
  isActive    Boolean        @default(true)
  enrolledAt  DateTime       @default(now())
  student     Student        @relation(...)
  route       TransportRoute @relation(...)
  @@map("student_transports")
}
```

### Routes

```
src/app/[domain]/transport/
├── page.tsx              # Overview: routes, vehicles, enrolled students
├── vehicles/page.tsx     # Vehicle management DataTable
├── routes/
│   ├── page.tsx          # Routes list
│   └── [routeId]/page.tsx # Route detail + assigned students + stop map
└── assign/page.tsx       # Assign students to routes
```

---

## Phase 7 — Mobile App APIs (MOBILE_APP)
**Priority: LOW (module-gated)**
**Complexity: Medium**
**Dependencies: Phase 1, 1B, Phase 3, Phase 4**
**Module gate:** `MOBILE_APP`

### Architecture Note

This phase creates **API Routes** (not server actions) — the mobile app is an external client using JWT auth.

### Routes to Create

```
src/app/api/v1/
├── auth/
│   └── route.ts              # POST /login → returns JWT
├── schools/[slug]/
│   ├── notices/route.ts      # GET notices
│   ├── students/[id]/
│   │   ├── attendance/route.ts  # GET attendance summary
│   │   ├── fees/route.ts        # GET fee status
│   │   └── marks/route.ts       # GET report card
│   └── calendar/route.ts     # GET academic calendar
└── notifications/
    └── route.ts              # POST send push (internal use)
```

### Schema Addition

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   // IOS | ANDROID | WEB
  createdAt DateTime @default(now())
  user      User     @relation(...)
  @@map("device_tokens")
}
```

### Server Actions — `src/actions/notifications.ts`

```ts
export async function sendPushNotification(schoolId: string, data: {
  audience: "ALL_STUDENTS" | "ALL_PARENTS" | "ALL_STAFF" | string[]
  title: string
  body: string
  data?: Record<string, string>
})
```

---

## Phase 8 — Reports & Analytics
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 1, 1B, Phase 3, Phase 4**

### Routes

```
src/app/[domain]/reports/
├── page.tsx                 # Reports hub
├── academic/
│   ├── page.tsx             # Class-wise performance (BarChart)
│   └── progress/page.tsx    # Student progress over exams (LineChart)
├── attendance/
│   └── page.tsx             # Monthly/yearly attendance (AreaChart + table)
├── finance/
│   ├── page.tsx             # Revenue vs expense (BarChart + summary cards)
│   └── dues/page.tsx        # Outstanding fee report table
├── staff/
│   └── page.tsx             # Staff attendance + leave summary
└── compliance/
    ├── moe/page.tsx         # MoE format: student/staff statistics
    └── ird/page.tsx         # TDS + VAT summary for IRD submission
```

### Charts (Recharts — already installed)

```ts
// 1. BarChart: Fee collection vs target per month
// 2. LineChart: Attendance trend (last 30 days)
// 3. PieChart: Student distribution by class/gender
// 4. AreaChart: Revenue over academic year
// 5. RadarChart: Subject-wise class average
```

### MoE Report Fields
Total students by: gender, caste/ethnicity, disability status, grade-wise
Teacher qualification statistics (per MoE format)
Attendance percentage summary

---

## Phase 9 — Settings Extension
**Priority: MEDIUM**
**Complexity: Low**
**Dependencies: Phase 0**

### Schema Additions

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  schoolId    String
  userId      String
  action      String   // "COLLECT_FEE" | "ENROLL_STUDENT" | "APPROVE_PAYROLL"
  resource    String   // "Student" | "FeePayment" | "PayrollRun"
  resourceId  String?
  metadata    Json?    // { before: {...}, after: {...} }
  ipAddress   String?
  createdAt   DateTime @default(now())
  school      School   @relation(...)
  user        User     @relation(...)
  @@map("audit_logs")
}
```

**New file:** `src/lib/audit.ts`

```ts
export async function logAction(schoolId: string, userId: string, action: string, resource: string, resourceId?: string, metadata?: object): Promise<void>
```

### Routes to Add/Update

```
src/app/[domain]/settings/
├── page.tsx           # Existing — keep but redirect to school/
├── school/page.tsx    # NEW: Edit school profile (name, phone, address, logo)
├── academic-years/
│   ├── page.tsx       # List academic years
│   └── new/page.tsx   # Create new academic year
├── roles/page.tsx     # Existing — extend with permission matrix UI
├── users/
│   ├── page.tsx       # Existing — extend with invite/deactivate
│   └── [userId]/permissions/page.tsx  # Per-user permission overrides
├── subscription/page.tsx  # NEW: Active plan, modules, trial countdown, billing
└── audit/page.tsx         # NEW: System audit log DataTable
```

### Server Actions — `src/actions/settings.ts`

```ts
export async function updateSchoolProfile(schoolId: string, data: {
  name?: string; phone?: string; address?: string; logoUrl?: string
})
// Note: slug and panNumber are immutable after registration

export async function createAcademicYear(schoolId: string, data: AcademicYearInput)
export async function setCurrentAcademicYear(schoolId: string, yearId: string)
export async function inviteUser(schoolId: string, data: { email: string; fullName: string; roleId: string })
export async function deactivateUser(schoolId: string, userId: string)
export async function setUserPermissionOverride(schoolId: string, userId: string, permissionCode: string, isGranted: boolean)
```

---

## Phase 10 — Super Admin (Platform Level)
**Priority: LOW**
**Complexity: Medium**
**Dependencies: All phases**

### Architecture

Super admin panel at root domain: `www.school360.com.np/admin`
Auth check: `session.user.role === "SUPER_ADMIN"`

### Routes

```
src/app/(admin)/
├── layout.tsx            # Super admin layout
├── page.tsx              # Platform overview: schools count, ARR, trials expiring
├── schools/
│   ├── page.tsx          # All tenant schools DataTable
│   └── [schoolId]/page.tsx  # School detail + subscription management
├── subscriptions/page.tsx   # All subscriptions: trial expirations, renewals
└── analytics/page.tsx       # Platform-wide charts
```

### Schema Additions

```prisma
model SupportTicket {
  id          String   @id @default(cuid())
  schoolId    String
  submittedBy String
  subject     String
  body        String   @db.Text
  status      String   @default("OPEN") // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  priority    String   @default("NORMAL")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  school      School   @relation(...)
  @@map("support_tickets")
}
```

---

## Phase 11 — Liquid Glass UI Redesign
**Priority: MEDIUM (UX enhancement)**
**Complexity: Medium**
**Dependencies: Can run parallel after Phase 0**

### Files to Update

1. **`src/app/globals.css`** — Add glass CSS system
2. **`src/components/app-sidebar.tsx`** — Glass panel sidebar
3. **`src/app/[domain]/layout.tsx`** — Floating glass header
4. **`src/app/[domain]/page.tsx`** — Full glass dashboard

### CSS Tokens to Add

```css
:root {
  --glass-bg:     rgba(255,255,255,0.68);
  --glass-border: rgba(255,255,255,0.38);
  --glass-blur:   blur(20px) saturate(180%);
  --glass-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
  --sidebar:      rgba(248,252,248,0.72);
}
.dark {
  --glass-bg:     rgba(10,15,35,0.60);
  --glass-border: rgba(255,255,255,0.09);
  --glass-shadow: 0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06);
  --sidebar:      rgba(10,15,35,0.72);
}
body {
  background-image:
    radial-gradient(ellipse 80% 60% at 10% 15%, oklch(0.82 0.15 150 / 0.22), transparent),
    radial-gradient(ellipse 70% 65% at 88% 8%, oklch(0.78 0.16 260 / 0.18), transparent),
    radial-gradient(ellipse 65% 55% at 55% 90%, oklch(0.78 0.13 310 / 0.16), transparent);
}
```

---

---

## ═══════════════════════════════════════════════════
## GAP FIXES — Critical Missing Features
## ═══════════════════════════════════════════════════

## Phase 12 — Institution Type Architecture
**Priority: CRITICAL (enables HE expansion)**
**Complexity: Low**
**Dependencies: Phase 0**

### Why This Phase Exists
The same platform serves K-12 schools, +2 colleges, Bachelor's colleges, and universities.
One `institutionType` field on `School` controls which modules, routes, and UI elements activate.

### Schema Change

```prisma
// Add to School model:
institutionType  String  @default("SCHOOL")
// SCHOOL     = Grades 1–12 only
// COLLEGE    = K-12 + Bachelor's programmes
// UNIVERSITY = K-12 + Bachelor's + Master's + PhD
affiliatedTo     String? // "TU" | "KU" | "PU" | "PUF" | "FWU" | "MU" — for affiliated colleges
affiliationCode  String? // University-assigned college code
moeRegNo         String? // MoE registration number
```

### Routing Rules

```
institutionType === "SCHOOL"     → show: Class/Section/CAS/NEB routes
                                   hide: Department/Programme/Semester/LMS/Thesis routes

institutionType === "COLLEGE"    → show: all SCHOOL routes + Department/Programme/Semester/LMS
                                   hide: Thesis/PhD routes

institutionType === "UNIVERSITY" → show: all routes including Thesis/PhD/Research
```

### New utility — `src/lib/institution.ts`

```ts
export async function getInstitutionType(schoolId: string): Promise<"SCHOOL" | "COLLEGE" | "UNIVERSITY">
export function isHE(type: string): boolean   // COLLEGE or UNIVERSITY
export function hasThesis(type: string): boolean  // UNIVERSITY only
```

---

## Phase 13 — Student Promotion & Year-End Rollover
**Priority: CRITICAL**
**Complexity: Medium**
**Dependencies: Phase 1**

### Schema Additions

```prisma
model StudentPromotion {
  id             String   @id @default(cuid())
  schoolId       String
  studentId      String
  academicYearId String                          // The year being closed
  fromClassId    String
  toClassId      String?                         // null = graduated/left
  fromSectionId  String?
  toSectionId    String?
  status         String   // PROMOTED | RETAINED | GRADUATED | TRANSFERRED | LEFT
  remarks        String?
  promotedById   String
  promotedAt     DateTime @default(now())
  school         School   @relation(...)
  student        Student  @relation(...)
  @@map("student_promotions")
}
```

### Routes

```
src/app/[domain]/settings/promotion/
├── page.tsx          # Year-end wizard (step 1: select year, step 2: class-by-class review)
└── history/page.tsx  # Past promotion records
```

### Server Actions — `src/actions/promotion.ts`

```ts
export async function getPromotionCandidates(schoolId: string, academicYearId: string, classId: string)
// Returns students with their current marks/GPA and suggested promotion status

export async function bulkPromote(schoolId: string, promotions: PromotionInput[])
// $transaction: updates student.classId/sectionId, creates StudentPromotion records

export async function rolloverAcademicYear(schoolId: string, fromYearId: string, toYearId: string)
// 1. Promotes all students per promotion decisions
// 2. Sets new year as isCurrent = true
// 3. Archives old year's data
```

---

## Phase 14 — SMS & Email Notifications
**Priority: CRITICAL (Nepal schools run on SMS)**
**Complexity: Medium**
**Dependencies: Phase 0**
**New module:** `NOTIFICATIONS` (bundled with Core)

### Nepal SMS Gateways

- **Sparrow SMS** — most used in Nepal (`https://api.sparrowsms.com/v2/sms/`)
- **Vianet SMS** — alternative
- **AAKASH SMS** — cost-effective

### Schema Additions

```prisma
model NotificationConfig {
  id          String   @id @default(cuid())
  schoolId    String   @unique
  smsProvider String?  // SPARROW | VIANET | AAKASH
  smsApiKey   String?
  smsToken    String?
  smsSenderId String?  // e.g. "SCHOOL360"
  emailFrom   String?  // e.g. "no-reply@school360.com.np"
  emailProvider String? // RESEND | SMTP
  emailApiKey String?
  school      School   @relation(...)
  @@map("notification_configs")
}

model NotificationLog {
  id          String   @id @default(cuid())
  schoolId    String
  channel     String   // SMS | EMAIL | PUSH
  recipient   String   // Phone or email
  subject     String?
  body        String
  status      String   // SENT | FAILED | PENDING
  errorMsg    String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  school      School   @relation(...)
  @@map("notification_logs")
}
```

### New utility — `src/lib/notifications.ts`

```ts
export async function sendSMS(schoolId: string, to: string, message: string): Promise<void>
// Reads NotificationConfig, calls Sparrow/Vianet API

export async function sendEmail(schoolId: string, to: string, subject: string, html: string): Promise<void>
// Uses Resend SDK or Nodemailer SMTP

export async function notifyParents(schoolId: string, event: "ABSENT" | "FEE_DUE" | "EXAM_RESULT" | "NOTICE", data: object): Promise<void>
// Fetches parent phones from StudentGuardian, bulk sends SMS
```

### Trigger Points
- **Fee overdue:** daily cron job → send SMS to guardian
- **Absent today:** after attendance locked → SMS to parents of absent students
- **Exam results published:** bulk SMS/email to all students
- **New notice:** push + SMS to relevant audience
- **30-day trial expiry warning:** 7 days before, 1 day before → email to school admin

### Routes

```
src/app/[domain]/settings/notifications/
└── page.tsx    # Configure SMS gateway + email provider, test send
```

---

## Phase 15 — Academic Calendar
**Priority: HIGH**
**Complexity: Low**
**Dependencies: Phase 0**

### Schema Additions

```prisma
model AcademicCalendarEvent {
  id             String   @id @default(cuid())
  schoolId       String
  academicYearId String
  title          String
  eventType      String   // HOLIDAY | EXAM | EVENT | BREAK | PTM | SPORT | CULTURAL
  dateBS         String   // Start date in BS
  endDateBS      String?  // End date (for multi-day events)
  isHoliday      Boolean  @default(false)
  isAllDay       Boolean  @default(true)
  description    String?
  color          String?  // Calendar display color
  school         School   @relation(...)
  @@map("academic_calendar_events")
}
```

### Pre-loaded Nepal Holidays (seed data in `src/lib/nepal-holidays.ts`)

```ts
export const NEPAL_PUBLIC_HOLIDAYS_2081 = [
  { titleBS: "Prithvi Jayanti", dateBS: "2081-09-27" },
  { titleBS: "Martyrs' Day", dateBS: "2081-10-05" },
  { titleBS: "Democracy Day", dateBS: "2081-10-21" },
  { titleBS: "Fagu Purnima (Holi)", dateBS: "2081-11-11" },
  // ... all 38 public holidays FY 2081/82
]
```

### Routes

```
src/app/[domain]/calendar/
├── page.tsx          # Full calendar view (month/week/list) using BS dates
└── events/
    └── new/page.tsx  # Create event
```

---

## Phase 16 — Online Admission Portal
**Priority: HIGH (lead generation)**
**Complexity: Medium**
**Dependencies: Phase 1**

### Schema Additions

```prisma
model AdmissionForm {
  id              String   @id @default(cuid())
  schoolId        String
  academicYearId  String
  classId         String
  title           String   // "Admission 2081/82"
  isOpen          Boolean  @default(true)
  openDateBS      String?
  closeDateBS     String?
  instructions    String?
  school          School   @relation(...)
  inquiries       AdmissionInquiry[]
  @@map("admission_forms")
}

model AdmissionInquiry {
  id              String   @id @default(cuid())
  schoolId        String
  formId          String
  studentName     String
  dobBS           String
  gender          String
  guardianName    String
  guardianPhone   String
  guardianEmail   String?
  address         String?
  previousSchool  String?
  previousClass   String?
  documents       Json?    // [{ type, url }]
  status          String   @default("PENDING") // PENDING | SHORTLISTED | REJECTED | ENROLLED
  reviewNote      String?
  reviewedById    String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
  school          School   @relation(...)
  form            AdmissionForm @relation(...)
  @@map("admission_inquiries")
}
```

### Routes

```
# Public-facing (marketing site):
src/app/(marketing)/apply/[slug]/page.tsx   # Public admission form for a school

# Admin (tenant dashboard):
src/app/[domain]/admissions/
├── page.tsx            # All inquiries DataTable with status filters
├── forms/
│   ├── page.tsx        # Manage admission forms (open/close)
│   └── new/page.tsx    # Create admission form
└── [inquiryId]/
    └── page.tsx        # Review inquiry → shortlist/reject/enroll
```

---

## Phase 17 — Fee Discounts & Scholarships
**Priority: HIGH**
**Complexity: Medium**
**Dependencies: Phase 4**

### Schema Additions

```prisma
model DiscountType {
  id           String   @id @default(cuid())
  schoolId     String
  name         String   // "Scholarship", "Sibling Discount", "Staff Ward", "Govt Quota"
  description  String?
  discountPct  Float?   // e.g. 50.0 = 50%
  discountAmt  Float?   // Fixed amount e.g. Rs. 500
  isAutoApply  Boolean  @default(false)
  school       School   @relation(...)
  studentDiscounts StudentDiscount[]
  @@map("discount_types")
}

model StudentDiscount {
  id             String   @id @default(cuid())
  schoolId       String
  studentId      String
  discountTypeId String
  feeStructureId String?  // null = applies to ALL fee types
  academicYearId String
  fromDateBS     String
  toDateBS       String?  // null = ongoing
  approvedById   String
  note           String?
  school         School       @relation(...)
  student        Student      @relation(...)
  discountType   DiscountType @relation(...)
  @@map("student_discounts")
}
```

### Server Actions addition to `src/actions/finance.ts`

```ts
export async function createDiscountType(schoolId: string, data: DiscountTypeInput)
export async function assignStudentDiscount(schoolId: string, data: StudentDiscountInput)
// Auto-applies discount to existing PENDING FeeCollections when assigned

export async function getStudentDiscounts(schoolId: string, studentId: string, academicYearId: string)
// Used during fee collection to show applicable discounts before payment
```

---

## Phase 18 — Library Management
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 1**
**Permission codes:** `library:view`, `library:manage`

### Schema Additions

```prisma
model LibraryBook {
  id              String   @id @default(cuid())
  schoolId        String
  title           String
  isbn            String?
  author          String?
  publisher       String?
  publishedYear   Int?
  category        String   // TEXTBOOK | REFERENCE | FICTION | JOURNAL | MAGAZINE
  subject         String?
  language        String   @default("Nepali")
  totalCopies     Int      @default(1)
  availableCopies Int      @default(1)
  shelfLocation   String?  // "A-3-2" = Rack A, Shelf 3, Position 2
  coverUrl        String?
  school          School   @relation(...)
  issues          LibraryIssue[]
  @@map("library_books")
}

model LibraryMembership {
  id          String   @id @default(cuid())
  schoolId    String
  userId      String   @unique
  memberNo    String
  maxBooks    Int      @default(2)
  isActive    Boolean  @default(true)
  school      School   @relation(...)
  user        User     @relation(...)
  @@map("library_memberships")
}

model LibraryIssue {
  id          String   @id @default(cuid())
  schoolId    String
  bookId      String
  memberId    String
  issuedAt    DateTime @default(now())
  issuedAtBS  String
  dueDateBS   String                         // Typically 14 days
  returnedAt  DateTime?
  returnedAtBS String?
  fine        Float    @default(0)           // Per-day fine after due date
  status      String   @default("ISSUED")   // ISSUED | RETURNED | OVERDUE | LOST
  issuedById  String
  returnedById String?
  school      School   @relation(...)
  book        LibraryBook @relation(...)
  @@map("library_issues")
}
```

### Routes

```
src/app/[domain]/library/
├── page.tsx              # Dashboard: total books, issued today, overdue count
├── books/
│   ├── page.tsx          # Book catalog DataTable
│   ├── new/page.tsx      # Add book
│   └── [bookId]/page.tsx # Book detail + issue history
├── issue/
│   └── page.tsx          # Issue book: search member + book → confirm
├── return/
│   └── page.tsx          # Return book: search by member or book
└── overdue/
    └── page.tsx          # Overdue books report + fine calculation
```

---

## Phase 19 — Certificate & ID Card Generation
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 1**

### Schema Additions

```prisma
model IssuedDocument {
  id            String   @id @default(cuid())
  schoolId      String
  recipientId   String                       // User ID (student or staff)
  type          String
  // CHARACTER_CERT | MIGRATION_CERT | TRANSFER_CERT | MARKSHEET_CERT
  // ID_CARD_STUDENT | ID_CARD_STAFF | BONAFIDE | SCHOLARSHIP_CERT
  issuedDateBS  String
  issuedById    String
  documentNo    String   @unique             // CHR-2081-00042
  qrPayload     String?                      // Encoded verification data
  fileUrl       String?
  isPrinted     Boolean  @default(false)
  printedAt     DateTime?
  school        School   @relation(...)
  @@map("issued_documents")
}
```

### Document Number Formats
```
Character Certificate:  CHR-{BSYear}-{seq}   e.g. CHR-2081-00042
Migration Certificate:  MIG-{BSYear}-{seq}
Transfer Certificate:   TC-{BSYear}-{seq}
Bonafide Certificate:   BON-{BSYear}-{seq}
```

### Routes

```
src/app/[domain]/documents/
├── page.tsx              # All issued documents DataTable
├── issue/
│   └── page.tsx          # Issue new document: select student + type → generate PDF
└── verify/
    └── [code]/page.tsx   # Public QR verification page (no auth required)
```

### PDF Generation (using `@react-pdf/renderer`)

```ts
// src/lib/documents/character-certificate.tsx
export function CharacterCertificatePDF({ school, student, document }: Props)
// Renders official letterhead with principal signature line

// src/lib/documents/id-card.tsx
export function StudentIDCardPDF({ school, student }: Props)
// 85.6mm × 54mm standard card size
```

---

## Phase 20 — Parent Web Portal
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 1, 1B, Phase 3, Phase 4**

### Architecture

Accessible at `{slug}.school360.com.np/parent` — same subdomain, separate auth role check.
Parents log in with credentials created by admin (or self-service via admission inquiry).

### Routes

```
src/app/[domain]/parent/
├── layout.tsx              # Parent layout (different sidebar — no admin links)
├── page.tsx                # Overview: children list
├── [childId]/
│   ├── page.tsx            # Child dashboard: attendance %, recent marks, fee status
│   ├── attendance/page.tsx # Monthly attendance calendar
│   ├── marks/page.tsx      # Published marksheets
│   ├── fees/page.tsx       # Fee dues + payment history
│   ├── timetable/page.tsx  # Child's timetable
│   └── notices/page.tsx    # School notices
└── profile/
    └── page.tsx            # Parent profile + contact update
```

### Auth Logic

```ts
// In src/middleware.ts — add parent route check:
if (pathname.startsWith('/parent')) {
  const session = await getSession()
  if (session?.user?.role !== 'PARENT') redirect('/login')
}
```

---

## Phase 21 — eSewa / Khalti Payment Gateway
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 4**

### Schema Additions

```prisma
model PaymentGatewayConfig {
  id          String   @id @default(cuid())
  schoolId    String   @unique
  esewaKey    String?                        // eSewa merchant key
  esewaSandbox Boolean @default(true)
  khaltiKey   String?                        // Khalti secret key
  khaltiSandbox Boolean @default(true)
  school      School   @relation(...)
  @@map("payment_gateway_configs")
}
```

### API Routes (webhooks from payment providers)

```
src/app/api/payments/
├── esewa/
│   ├── initiate/route.ts   # POST — create eSewa payment request
│   └── verify/route.ts     # GET — eSewa success callback, verify + record payment
└── khalti/
    ├── initiate/route.ts   # POST — create Khalti payment URL
    └── verify/route.ts     # POST — Khalti webhook, verify + record payment
```

### eSewa Flow (Nepal v2 API)

```ts
// 1. Initiate: encode params → redirect to eSewa payment page
// 2. eSewa redirects back to /api/payments/esewa/verify?data={base64}
// 3. Decode, verify with HMAC SHA256 using secret key
// 4. On success: call collectFee() with method: "ESEWA", referenceNo: transactionUUID
```

---

## Phase 22 — Bulk Operations & Data Export
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 1, Phase 4**

### Bulk Operations

```
src/app/[domain]/tools/
├── page.tsx                    # Tools hub
├── import/
│   ├── students/page.tsx       # CSV bulk student import with template download
│   ├── attendance/page.tsx     # CSV bulk attendance import
│   └── marks/page.tsx          # Excel bulk marks import
└── export/
    ├── students/page.tsx       # Export student list (CSV/Excel)
    ├── fees/page.tsx           # Export fee collection report (PDF/Excel)
    ├── payroll/page.tsx        # Export payroll summary (Excel — IRD format)
    ├── attendance/page.tsx     # Export attendance summary (Excel)
    └── moe/page.tsx            # Export MoE EMIS format
```

### New packages needed

```bash
npm install xlsx                    # Excel read/write (Apache-2.0 license)
npm install -D @types/xlsx
```

### Server Actions — `src/actions/bulk.ts`

```ts
export async function importStudentsFromCSV(schoolId: string, csvData: StudentCSVRow[]): Promise<{ created: number; errors: string[] }>
export async function exportStudentsToExcel(schoolId: string, filters?: StudentFilter): Promise<Buffer>
export async function exportFeeReportToExcel(schoolId: string, monthBS: string): Promise<Buffer>
export async function exportMoEReport(schoolId: string, academicYearId: string): Promise<Buffer>
// MoE EMIS format: student counts by grade/gender/caste/disability
```

---

## Phase 23 — Supabase Storage (Production File Uploads)
**Priority: HIGH (current /public/uploads/ breaks in serverless)**
**Complexity: Low**
**Dependencies: Phase 0**

### Why Critical

The current `writeFile()` to `/public/uploads/` fails in:
- Vercel (read-only filesystem)
- Any serverless/container deployment
- Multiple instances (no shared disk)

### New utility — `src/lib/storage.ts`

```ts
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Server-side only
)

export async function uploadFile(bucket: string, path: string, file: File | Buffer): Promise<string>
// Returns public URL: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}

export async function deleteFile(bucket: string, path: string): Promise<void>
export async function getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string>
```

### Storage Buckets to Create in Supabase Dashboard

```
school-logos/      — public read, authenticated write
student-photos/    — authenticated read only
documents/         — authenticated read only (certs, report cards)
assignments/       — authenticated read only
lms-content/       — authenticated read only (PDFs, slides)
lms-videos/        — authenticated read only (recorded lectures)
```

### `.env.local` Addition

```
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

---

## ═══════════════════════════════════════════════════
## HIGHER EDUCATION — Bachelor's & Master's Support
## ═══════════════════════════════════════════════════

## Phase 24 — HE Academic Structure
**Priority: HIGH (if institutionType = COLLEGE/UNIVERSITY)**
**Complexity: High**
**Dependencies: Phase 12, Phase 0**
**Module gate:** `HIGHER_EDUCATION` (new module key)

### How K-12 Maps to HE (same models, different terminology)

| K-12 Term | HE Term | Model Used |
|-----------|---------|------------|
| Faculty | Department | `Faculty` (reused) |
| Class | Programme (BCA, MBA) | New `Programme` model |
| Section | Batch/Year | `Section` (reused as "Batch") |
| Subject | Course | `Subject` (reused + credit hours already exist) |
| AcademicYear | Academic Year | `AcademicYear` (shared) |
| — | Semester | New `Semester` model |
| — | CourseOffering | New `CourseOffering` model |
| — | CourseEnrollment | New `CourseEnrollment` model |

### Schema Additions

```prisma
model Programme {
  id               String   @id @default(cuid())
  schoolId         String
  departmentId     String                         // Uses existing Faculty.id
  name             String   // "Bachelor of Computer Application"
  shortName        String   // "BCA"
  level            String   // BACHELOR | MASTER | PHD | DIPLOMA | PGDIPLOMA
  durationYears    Int      // 4 for Bachelor, 2 for Master
  totalCredits     Int      // 120 for typical Bachelor
  affiliationCode  String?  // TU/KU programme registration code
  isActive         Boolean  @default(true)
  school           School   @relation(...)
  semesters        Semester[]
  students         Student[]    // HE students enrolled in this programme
  @@map("programmes")
}

model Semester {
  id              String   @id @default(cuid())
  schoolId        String
  programmeId     String
  semesterNumber  Int      // 1–8 for Bachelor, 1–4 for Master
  academicYearId  String
  startDateBS     String
  endDateBS       String
  isCurrent       Boolean  @default(false)
  name            String   // "First Semester 2081"
  school          School   @relation(...)
  programme       Programme @relation(...)
  academicYear    AcademicYear @relation(...)
  courseOfferings CourseOffering[]
  grades          SemesterGrade[]
  @@unique([programmeId, semesterNumber, academicYearId])
  @@map("semesters")
}

model CourseOffering {
  id              String   @id @default(cuid())
  schoolId        String
  semesterId      String
  subjectId       String                          // Reuses Subject model as "Course"
  instructorId    String?
  isElective      Boolean  @default(false)
  maxStudents     Int?
  school          School   @relation(...)
  semester        Semester @relation(...)
  subject         Subject  @relation(...)
  enrollments     CourseEnrollment[]
  @@unique([semesterId, subjectId])
  @@map("course_offerings")
}

model CourseEnrollment {
  id               String   @id @default(cuid())
  schoolId         String
  studentId        String
  courseOfferingId String
  enrolledAt       DateTime @default(now())
  status           String   @default("ENROLLED") // ENROLLED | DROPPED | COMPLETED | FAILED
  finalGrade       String?  // A, B+, B, C+, C, D, F
  finalGPA         Float?   // Grade point
  school           School   @relation(...)
  student          Student  @relation(...)
  offering         CourseOffering @relation(...)
  @@unique([studentId, courseOfferingId])
  @@map("course_enrollments")
}

model SemesterGrade {
  id                String   @id @default(cuid())
  schoolId          String
  studentId         String
  semesterId        String
  sgpa              Float                          // Semester GPA
  cgpa              Float                          // Cumulative GPA up to this semester
  creditsEarned     Int
  creditsCumulative Int
  status            String   // PASS | FAIL | PROBATION | INCOMPLETE
  isPublished       Boolean  @default(false)
  school            School   @relation(...)
  @@unique([studentId, semesterId])
  @@map("semester_grades")
}

model CoursePrerequisite {
  courseId         String
  prerequisiteId   String
  @@id([courseId, prerequisiteId])
  @@map("course_prerequisites")
}
```

### Routes

```
src/app/[domain]/programmes/
├── page.tsx                    # Programmes list (BCA, MBA, etc.)
├── new/page.tsx                # Create programme
└── [programmeId]/
    ├── page.tsx                # Programme detail + semesters
    ├── semesters/
    │   ├── page.tsx            # Semester list for this programme
    │   └── [semesterId]/
    │       ├── page.tsx        # Semester detail: courses + enrolled students
    │       └── courses/
    │           └── page.tsx    # Course offerings for this semester
    └── students/
        └── page.tsx            # All students enrolled in programme
```

### Server Actions — `src/actions/programmes.ts`

```ts
export async function createProgramme(schoolId: string, data: ProgrammeInput)
export async function createSemester(schoolId: string, data: SemesterInput)
export async function offerCourse(schoolId: string, data: CourseOfferingInput)
export async function enrollStudentInCourse(schoolId: string, studentId: string, courseOfferingId: string)
export async function selfEnrollCourses(schoolId: string, studentId: string, semesterId: string, courseIds: string[])
// HE students self-register for courses each semester (like university registration)
export async function computeSemesterGPA(schoolId: string, studentId: string, semesterId: string): Promise<SemesterGrade>
export async function generateTranscript(schoolId: string, studentId: string): Promise<TranscriptData>
```

### Nepal HE Grading (TU/KU system)

```ts
// src/lib/grading.ts — add HE grading:
// TU Semester System GPA (most common):
// 90–100: A  (4.0) — Outstanding
// 80–89:  A- (3.7) — Excellent
// 70–79:  B+ (3.3) — Very Good
// 65–69:  B  (3.0) — Good
// 60–64:  B- (2.7) — Above Average
// 55–59:  C+ (2.3) — Average
// 50–54:  C  (2.0) — Satisfactory
// 45–49:  C- (1.7) — Pass (some TU programmes)
// 40–44:  D  (1.3) — Marginal Pass
// <40:    F  (0.0) — Fail

export function getTUGrade(percentage: number): { grade: string; gpa: number }
export function computeSGPA(courses: { creditHours: number; gpa: number }[]): number
export function computeCGPA(semesters: { sgpa: number; credits: number }[]): number
```

---

## Phase 25 — HE Student Enrollment & Self-Service
**Priority: HIGH**
**Dependencies: Phase 24, Phase 1**

### Schema Extensions to Student model

```prisma
// Add to Student:
// programmeId     String?    // Links to Programme
// admissionType   String?    // MERIT | QUOTA | SCHOLARSHIP | MANAGEMENT
// entranceScore   Float?     // Entrance exam score if applicable
// currentSemester Int?       // Which semester they're in (1-8)
// academicStatus  String?    // GOOD | PROBATION | SUSPENDED | GRADUATED
// thesisId        String?    // Link to Thesis (for Master's)
// alumniId        String?    // Link to Alumni after graduation
```

### Routes

```
src/app/[domain]/students/[studentId]/
├── transcript/page.tsx     # Full academic transcript (printable PDF)
├── courses/page.tsx        # Enrolled courses this semester + registration
└── grades/page.tsx         # Semester-wise GPA history + CGPA
```

### Student Self-Service Portal additions

```
src/app/[domain]/parent/[childId]/
└── courses/page.tsx        # View enrolled courses (for HE student portal)
```

---

## Phase 26 — Research & Thesis Management (Master's / PhD)
**Priority: MEDIUM**
**Complexity: High**
**Dependencies: Phase 24, Phase 25**

### Schema Additions

```prisma
model Thesis {
  id              String   @id @default(cuid())
  schoolId        String
  studentId       String   @unique
  programmeId     String
  title           String
  abstract        String?  @db.Text
  supervisorId    String
  coSupervisorId  String?
  status          String   // PROPOSAL | APPROVED | IN_PROGRESS | SUBMITTED | DEFENDED | COMPLETED | REJECTED
  proposalUrl     String?
  finalDocUrl     String?
  defenseDateBS   String?
  defenseLocation String?
  result          String?  // PASS | PASS_WITH_REVISION | FAIL
  finalRemarks    String?
  school          School   @relation(...)
  student         Student  @relation(...)
  supervisor      User     @relation("ThesisSupervisor", ...)
  chapters        ThesisChapter[]
  viva            ThesisViva?
  @@map("theses")
}

model ThesisChapter {
  id          String   @id @default(cuid())
  thesisId    String
  chapterNo   Int      // 1, 2, 3, 4, 5
  title       String   // "Introduction", "Literature Review", etc.
  fileUrl     String
  submittedAt DateTime @default(now())
  status      String   // SUBMITTED | UNDER_REVIEW | APPROVED | REVISION_REQUIRED
  feedback    String?
  thesis      Thesis   @relation(...)
  @@map("thesis_chapters")
}

model ThesisViva {
  id           String   @id @default(cuid())
  thesisId     String   @unique
  scheduledAt  DateTime
  location     String?
  panelMembers Json     // [{ userId, role: "CHAIR|INTERNAL|EXTERNAL" }]
  result       String?  // PASS | PASS_WITH_REVISION | FAIL
  remarks      String?
  thesis       Thesis   @relation(...)
  @@map("thesis_vivas")
}
```

### Routes

```
src/app/[domain]/research/
├── page.tsx                    # Research overview: all theses by status
├── [thesisId]/
│   ├── page.tsx                # Thesis detail + timeline
│   ├── chapters/page.tsx       # Chapter submissions + feedback
│   └── viva/page.tsx           # Viva scheduling + result entry
└── new/page.tsx                # Submit thesis proposal
```

---

## Phase 27 — Hostel Management
**Priority: MEDIUM**
**Dependencies: Phase 1**

### Schema Additions

```prisma
model Hostel {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "Boys Hostel Block A"
  gender    String   // MALE | FEMALE | MIXED
  totalRooms Int
  wardenId  String?
  school    School   @relation(...)
  rooms     HostelRoom[]
  @@map("hostels")
}

model HostelRoom {
  id          String   @id @default(cuid())
  hostelId    String
  roomNumber  String
  floor       Int?
  capacity    Int
  type        String   // SINGLE | DOUBLE | TRIPLE | DORMITORY
  monthlyFee  Float
  hostel      Hostel   @relation(...)
  allocations HostelAllocation[]
  @@map("hostel_rooms")
}

model HostelAllocation {
  id          String   @id @default(cuid())
  schoolId    String
  studentId   String
  roomId      String
  checkInBS   String
  checkOutBS  String?
  monthlyFee  Float
  status      String   @default("ACTIVE") // ACTIVE | VACATED
  school      School   @relation(...)
  student     Student  @relation(...)
  room        HostelRoom @relation(...)
  @@map("hostel_allocations")
}
```

### Routes

```
src/app/[domain]/hostel/
├── page.tsx              # Overview: occupancy rate, hostel list
├── [hostelId]/
│   ├── page.tsx          # Room grid view
│   └── rooms/[roomId]/page.tsx  # Room detail + current occupants
└── allocate/page.tsx     # Assign student to room
```

---

## Phase 28 — Internship & Practicum
**Priority: MEDIUM**
**Dependencies: Phase 24 (for HE students)**

### Schema Additions

```prisma
model Internship {
  id              String   @id @default(cuid())
  schoolId        String
  studentId       String
  programmeId     String
  company         String
  position        String
  supervisorName  String
  supervisorPhone String?
  startDateBS     String
  endDateBS       String?
  totalWeeks      Int?
  location        String?
  status          String   // PENDING | ONGOING | COMPLETED | CANCELLED
  reportUrl       String?
  supervisorEval  Json?    // Evaluation from company supervisor
  internalMark    Float?   // Marks from college supervisor
  externalMark    Float?   // Marks from company supervisor
  totalMark       Float?
  createdAt       DateTime @default(now())
  school          School   @relation(...)
  student         Student  @relation(...)
  @@map("internships")
}
```

### Routes

```
src/app/[domain]/internships/
├── page.tsx              # All internships DataTable
├── new/page.tsx          # Register internship
└── [internshipId]/
    ├── page.tsx          # Detail + evaluation forms
    └── diary/page.tsx    # Weekly diary entries
```

---

## Phase 29 — Alumni & Job Placement
**Priority: LOW**
**Dependencies: Phase 13 (Promotion), Phase 24**

### Schema Additions

```prisma
model Alumni {
  id               String   @id @default(cuid())
  schoolId         String
  userId           String   @unique
  graduationYearBS String
  programmeId      String?
  classId          String?
  currentCompany   String?
  currentPosition  String?
  currentCity      String?
  linkedin         String?
  isVerified       Boolean  @default(false)
  school           School   @relation(...)
  user             User     @relation(...)
  @@map("alumni")
}

model JobPosting {
  id             String   @id @default(cuid())
  schoolId       String
  postedById     String
  company        String
  position       String
  description    String   @db.Text
  requirements   String?
  location       String?
  salaryRange    String?
  applicationUrl String?
  deadline       DateTime?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  school         School   @relation(...)
  @@map("job_postings")
}
```

### Routes

```
src/app/[domain]/alumni/
├── page.tsx           # Alumni directory
└── jobs/page.tsx      # Job board
```

---

## ═══════════════════════════════════════════════════
## LMS — Online Learning System (Full)
## ═══════════════════════════════════════════════════

## Phase 30 — LMS Core: Course Builder
**Priority: HIGH (if ONLINE_LEARNING module active)**
**Complexity: High**
**Dependencies: Phase 12, Phase 24 (for HE) or Phase 2 (for K-12)**
**Module gate:** `ONLINE_LEARNING` (new module key — add to onboarding)

### Schema Additions

```prisma
model LMSCourse {
  id               String   @id @default(cuid())
  schoolId         String
  title            String
  description      String?  @db.Text
  coverImageUrl    String?
  instructorId     String
  // Link to either K-12 subject OR HE course offering:
  subjectId        String?
  courseOfferingId String?
  status           String   @default("DRAFT") // DRAFT | PUBLISHED | ARCHIVED
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  school           School   @relation(...)
  instructor       User     @relation(...)
  modules          LMSModule[]
  enrollments      LMSEnrollment[]
  liveClasses      LiveClass[]
  assignments      Assignment[]
  quizzes          Quiz[]
  threads          DiscussionThread[]
  @@map("lms_courses")
}

model LMSModule {
  id          String   @id @default(cuid())
  courseId    String
  title       String
  description String?
  order       Int
  isPublished Boolean  @default(false)
  course      LMSCourse @relation(...)
  lessons     LMSLesson[]
  @@map("lms_modules")
}

model LMSLesson {
  id          String   @id @default(cuid())
  moduleId    String
  title       String
  type        String
  // VIDEO | PDF | SLIDES | LINK | TEXT | EMBED
  // (Quizzes and Assignments are separate models linked by lessonId)
  content     String?  @db.Text             // HTML text or embed code
  fileUrl     String?                       // Supabase Storage URL for PDF/slides
  videoUrl    String?                       // Supabase Storage or YouTube/Vimeo URL
  videoDuration Int?                        // Seconds
  order       Int
  isPublished Boolean  @default(false)
  isFree      Boolean  @default(false)      // Preview without enrollment
  module      LMSModule @relation(...)
  completions LessonCompletion[]
  @@map("lms_lessons")
}

model LessonCompletion {
  id          String   @id @default(cuid())
  lessonId    String
  studentId   String
  completedAt DateTime @default(now())
  timeSpent   Int?                          // Seconds
  lesson      LMSLesson @relation(...)
  @@unique([lessonId, studentId])
  @@map("lesson_completions")
}

model LMSEnrollment {
  id          String   @id @default(cuid())
  courseId    String
  studentId   String
  enrolledAt  DateTime @default(now())
  completedAt DateTime?
  progress    Float    @default(0)           // 0–100 percentage
  lastAccess  DateTime?
  certUrl     String?                        // Auto-generated completion certificate
  course      LMSCourse @relation(...)
  @@unique([courseId, studentId])
  @@map("lms_enrollments")
}
```

### Routes

```
src/app/[domain]/lms/
├── page.tsx                        # LMS hub: my courses (student) / manage courses (instructor)
├── courses/
│   ├── page.tsx                    # All courses DataTable (admin view)
│   ├── new/page.tsx                # Create course wizard
│   └── [courseId]/
│       ├── page.tsx                # Course overview (student landing page)
│       ├── builder/page.tsx        # Course builder: add/reorder modules+lessons
│       ├── [moduleId]/
│       │   └── [lessonId]/page.tsx # Lesson viewer (video player / PDF viewer / text)
│       ├── live/page.tsx           # Live classes for this course
│       ├── assignments/page.tsx    # Assignments list
│       ├── quizzes/page.tsx        # Quizzes list
│       ├── discussion/page.tsx     # Discussion forum
│       ├── students/page.tsx       # Enrolled students + progress (instructor)
│       └── analytics/page.tsx     # Engagement analytics (instructor)
└── my-courses/page.tsx             # Student: enrolled courses with progress
```

### Server Actions — `src/actions/lms.ts`

```ts
export async function createCourse(schoolId: string, data: LMSCourseInput)
export async function publishCourse(schoolId: string, courseId: string)
export async function createModule(courseId: string, data: LMSModuleInput)
export async function createLesson(moduleId: string, data: LMSLessonInput)
export async function reorderLessons(moduleId: string, orderedIds: string[])
export async function enrollStudent(courseId: string, studentId: string)
export async function bulkEnrollClass(courseId: string, classId: string)  // K-12: enroll whole class
export async function markLessonComplete(lessonId: string, studentId: string, timeSpent?: number)
export async function getCourseProgress(courseId: string, studentId: string): Promise<number>
export async function generateCompletionCertificate(courseId: string, studentId: string): Promise<string>
```

---

## Phase 31 — Live Classes
**Priority: HIGH**
**Complexity: Medium**
**Dependencies: Phase 30**

### Video Platform Decision

| Platform | Cost | Pros | Cons |
|----------|------|------|------|
| **Jitsi Meet** (self-hosted) | Free | Open source, no per-minute cost | Needs own server |
| **Google Meet** (link-based) | Free tier | Simple, familiar | No API for recording |
| **Zoom** (link-based) | Paid | Best quality, recording | API cost |
| **Daily.co** | $0.004/min/participant | Good API, recording | USD cost |
| **LiveKit** (self-hosted) | Free | WebRTC, scalable | Needs infra |

**Recommendation for Nepal:** Start with **Google Meet / Zoom links** (store URL in `meetingUrl`), migrate to LiveKit when scale demands.

### Schema Additions

```prisma
model LiveClass {
  id               String   @id @default(cuid())
  schoolId         String
  courseId         String?
  classId          String?                        // K-12 use
  sectionId        String?
  title            String
  description      String?
  scheduledAt      DateTime
  scheduledAtBS    String
  durationMinutes  Int
  platform         String   @default("GOOGLE_MEET") // GOOGLE_MEET | ZOOM | JITSI | CUSTOM
  meetingUrl       String?
  meetingId        String?
  meetingPassword  String?
  recordingUrl     String?
  status           String   @default("SCHEDULED") // SCHEDULED | LIVE | ENDED | CANCELLED
  createdById      String
  school           School   @relation(...)
  course           LMSCourse? @relation(...)
  attendances      LiveClassAttendance[]
  @@map("live_classes")
}

model LiveClassAttendance {
  id           String   @id @default(cuid())
  liveClassId  String
  studentId    String
  joinedAt     DateTime?
  leftAt       DateTime?
  durationSecs Int?
  liveClass    LiveClass @relation(...)
  @@unique([liveClassId, studentId])
  @@map("live_class_attendances")
}
```

### Routes

```
src/app/[domain]/lms/live/
├── page.tsx              # Upcoming live classes (all courses)
├── new/page.tsx          # Schedule live class
└── [liveClassId]/
    ├── page.tsx          # Live class detail + join button
    └── attendance/page.tsx # Post-class attendance + recording upload
```

### Server Actions — `src/actions/live-classes.ts`

```ts
export async function scheduleLiveClass(schoolId: string, data: LiveClassInput)
export async function startLiveClass(liveClassId: string)  // status → LIVE, send SMS/push to students
export async function endLiveClass(liveClassId: string, recordingUrl?: string)
export async function recordAttendance(liveClassId: string, studentId: string, action: "JOIN" | "LEAVE")
export async function getUpcomingClasses(schoolId: string, studentId: string)
```

---

## Phase 32 — Assignments & Submissions
**Priority: HIGH**
**Complexity: Medium**
**Dependencies: Phase 30**

### Schema Additions

```prisma
model Assignment {
  id            String   @id @default(cuid())
  schoolId      String
  courseId      String?
  classId       String?
  subjectId     String?
  title         String
  description   String   @db.Text
  attachments   Json?    // [{ name, url }]
  dueDate       DateTime
  dueDateBS     String
  totalMarks    Float    @default(100)
  passMarks     Float    @default(40)
  allowLate     Boolean  @default(false)
  latePenaltyPct Float   @default(0)         // % deducted per late day
  maxFileSize   Int      @default(10)         // MB
  allowedTypes  String   @default("pdf,doc,docx,zip")
  createdById   String
  createdAt     DateTime @default(now())
  school        School   @relation(...)
  submissions   AssignmentSubmission[]
  @@map("assignments")
}

model AssignmentSubmission {
  id            String   @id @default(cuid())
  assignmentId  String
  studentId     String
  submittedAt   DateTime @default(now())
  isLate        Boolean  @default(false)
  fileUrls      Json     // [{ name, url, size }]
  note          String?
  status        String   @default("SUBMITTED") // SUBMITTED | GRADED | RETURNED | RESUBMIT
  marks         Float?
  feedback      String?  @db.Text
  gradedById    String?
  gradedAt      DateTime?
  assignment    Assignment @relation(...)
  @@unique([assignmentId, studentId])
  @@map("assignment_submissions")
}
```

### Routes

```
src/app/[domain]/lms/courses/[courseId]/assignments/
├── page.tsx                    # Assignment list with submission status
├── new/page.tsx                # Create assignment (instructor)
└── [assignmentId]/
    ├── page.tsx                # Assignment detail + submit (student)
    └── grade/page.tsx          # Grade all submissions (instructor)
```

---

## Phase 33 — Quizzes & Online Exams
**Priority: HIGH**
**Complexity: High**
**Dependencies: Phase 30**

### Schema Additions

```prisma
model Quiz {
  id           String   @id @default(cuid())
  schoolId     String
  courseId     String?
  classId      String?
  title        String
  description  String?
  timeLimitMin Int?                           // null = unlimited time
  totalMarks   Float
  passMarks    Float
  shuffleQ     Boolean  @default(false)
  shuffleOpts  Boolean  @default(false)       // Shuffle MCQ options
  showResult   Boolean  @default(true)        // Show score immediately
  showAnswers  Boolean  @default(false)       // Show correct answers after
  maxAttempts  Int      @default(1)
  startAt      DateTime?
  endAt        DateTime?
  createdById  String
  school       School   @relation(...)
  questions    QuizQuestion[]
  attempts     QuizAttempt[]
  @@map("quizzes")
}

model QuizQuestion {
  id            String   @id @default(cuid())
  quizId        String
  type          String   // MCQ | MULTI_SELECT | TRUE_FALSE | SHORT_ANSWER | ESSAY
  questionText  String   @db.Text
  imageUrl      String?
  options       Json?    // [{ id, text, isCorrect }] — for MCQ/MULTI_SELECT
  correctAnswer String?  // For SHORT_ANSWER
  marks         Float
  negativeMarks Float    @default(0)          // For MCQ negative marking
  order         Int
  explanation   String?                       // Shown after quiz ends
  quiz          Quiz     @relation(...)
  @@map("quiz_questions")
}

model QuizAttempt {
  id          String   @id @default(cuid())
  quizId      String
  studentId   String
  startedAt   DateTime @default(now())
  submittedAt DateTime?
  timeTaken   Int?                            // Seconds
  score       Float?
  isPassed    Boolean?
  answers     Json     // [{ questionId, selectedOptions, textAnswer, marks, isCorrect }]
  status      String   @default("IN_PROGRESS") // IN_PROGRESS | SUBMITTED | EXPIRED
  attemptNo   Int      @default(1)
  quiz        Quiz     @relation(...)
  @@map("quiz_attempts")
}
```

### Routes

```
src/app/[domain]/lms/courses/[courseId]/quizzes/
├── page.tsx                    # Quiz list
├── new/page.tsx                # Quiz builder with question editor
└── [quizId]/
    ├── page.tsx                # Take quiz (student) / view results (instructor)
    ├── take/page.tsx           # Active quiz taking UI (full-screen, timer)
    └── results/page.tsx        # All student attempts + analytics (instructor)
```

### Quiz Taking UI Pattern

```
Full-screen quiz mode:
1. Header: Quiz title | Time remaining (countdown) | Question X of Y
2. Question display: text + optional image
3. Answer area: radio (MCQ) / checkboxes (MULTI) / textarea (ESSAY)
4. Navigation: Previous | Next | Question map (jump to any Q)
5. Flag button: mark question for review
6. Submit button (confirmation dialog)
7. Auto-submit when timer reaches 0
```

---

## Phase 34 — Discussion Forums & Collaboration
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 30**

### Schema Additions

```prisma
model DiscussionThread {
  id          String   @id @default(cuid())
  schoolId    String
  courseId    String
  title       String
  body        String   @db.Text
  type        String   @default("DISCUSSION") // DISCUSSION | QUESTION | ANNOUNCEMENT
  isPinned    Boolean  @default(false)
  isLocked    Boolean  @default(false)
  authorId    String
  views       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  school      School   @relation(...)
  course      LMSCourse @relation(...)
  replies     DiscussionReply[]
  @@map("discussion_threads")
}

model DiscussionReply {
  id          String   @id @default(cuid())
  threadId    String
  authorId    String
  body        String   @db.Text
  parentId    String?                          // For nested replies
  isAnswer    Boolean  @default(false)         // Accepted answer mark
  upvotes     Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  thread      DiscussionThread @relation(...)
  @@map("discussion_replies")
}
```

### Routes

```
src/app/[domain]/lms/courses/[courseId]/discussion/
├── page.tsx                    # Thread list (pinned + recent)
├── new/page.tsx                # Create thread
└── [threadId]/page.tsx         # Thread + nested replies
```

---

## Phase 35 — Learning Analytics & Progress Dashboard
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phases 30–34**

### What to Track

```ts
// Per student per course:
// - Lessons completed / total lessons (% progress)
// - Time spent on platform
// - Quiz average score
// - Assignment submission rate
// - Last access date
// - Live class attendance rate

// Per course (instructor view):
// - Average completion rate
// - Average quiz score
// - Most-skipped lessons
// - Peak activity times
// - Student engagement score
```

### Routes

```
src/app/[domain]/lms/analytics/
├── page.tsx              # Platform-wide LMS overview (admin)
└── courses/[courseId]/
    └── analytics/page.tsx # Per-course deep analytics (instructor)
```

---

## Updated Implementation Order

| # | Phase | Priority | Weeks |
|---|-------|----------|-------|
| 1 | P0 — Foundation (auth helpers, Nepal utils, finance utils) | CRITICAL | 1 |
| 2 | P12 — Institution Type Architecture | CRITICAL | 0.5 |
| 3 | P23 — Supabase Storage (fix file uploads) | CRITICAL | 0.5 |
| 4 | P14 — SMS & Email Notifications | CRITICAL | 1 |
| 5 | P1 — Students (enrollment, profiles, guardian) | HIGH | 2 |
| 6 | P1B — Attendance (daily/period, BS calendar) | HIGH | 1 |
| 7 | P15 — Academic Calendar | HIGH | 0.5 |
| 8 | P3 — Exam & CAS (marks, GPA, report cards) | HIGH | 3 |
| 9 | P4 — Finance & Tax (fees, payments, payroll, IRD) | HIGH | 4 |
| 10 | P17 — Fee Discounts & Scholarships | HIGH | 1 |
| 11 | P5 — HR & Staff (employees, attendance, leave) | MEDIUM | 2 |
| 12 | P13 — Student Promotion & Year-End Rollover | MEDIUM | 1 |
| 13 | P1C — Notice Board | MEDIUM | 0.5 |
| 14 | P16 — Online Admission Portal | MEDIUM | 1.5 |
| 15 | P2 — Timetable & Teacher Assignments | MEDIUM | 2 |
| 16 | P18 — Library Management | MEDIUM | 1.5 |
| 17 | P19 — Certificates & ID Cards | MEDIUM | 1 |
| 18 | P20 — Parent Web Portal | MEDIUM | 2 |
| 19 | P21 — eSewa / Khalti Payment Gateway | MEDIUM | 1.5 |
| 20 | P22 — Bulk Operations & Data Export | MEDIUM | 1 |
| 21 | P8 — Reports & Analytics | MEDIUM | 2 |
| 22 | P9 — Settings Extension (audit, profile edit) | MEDIUM | 1 |
| 23 | P6 — Transport GPS (module-gated) | LOW | 1.5 |
| 24 | P7 — Mobile App APIs (module-gated) | LOW | 1.5 |
| **--- Higher Education Track ---** | | | |
| 25 | P24 — HE Academic Structure (Dept, Programme, Semester) | HIGH | 3 |
| 26 | P25 — HE Student Enrollment & Transcript | HIGH | 2 |
| 27 | P26 — Research & Thesis (Master's) | MEDIUM | 2 |
| 28 | P27 — Hostel Management | MEDIUM | 1.5 |
| 29 | P28 — Internship & Practicum | MEDIUM | 1 |
| 30 | P29 — Alumni & Job Placement | LOW | 1 |
| **--- LMS / Online Learning Track ---** | | | |
| 31 | P30 — LMS Core (Course builder, content, enrollments) | HIGH | 3 |
| 32 | P31 — Live Classes (scheduling, attendance) | HIGH | 1.5 |
| 33 | P32 — Assignments & Submissions | HIGH | 1.5 |
| 34 | P33 — Quizzes & Online Exams | HIGH | 2 |
| 35 | P34 — Discussion Forums | MEDIUM | 1 |
| 36 | P35 — Learning Analytics | MEDIUM | 1.5 |
| **--- Platform ---** | | | |
| 37 | P10 — Super Admin panel | LOW | 1 |
| 38 | P11 — Liquid Glass UI Redesign | MEDIUM | 1 |

**Total estimated:** ~55–60 developer-weeks for full platform

---

## Complete Module Keys (for onboarding wizard & subscription)

```ts
export const ALL_MODULES = [
  { key: "FINANCE_TAX",      label: "Finance & Tax",      price: 2000, desc: "IRD billing, payroll, TDS, SSF" },
  { key: "EXAM_CAS",         label: "Exam & CAS",         price: 1500, desc: "Grades 1–12, NEB GPA, report cards" },
  { key: "TRANSPORT_GPS",    label: "Transport GPS",      price: 500,  desc: "Bus tracking, route management" },
  { key: "MOBILE_APP",       label: "Mobile App",         price: 833,  desc: "Parent & student mobile app" },
  { key: "ONLINE_LEARNING",  label: "Online Learning",    price: 2500, desc: "LMS, live classes, quizzes, assignments" },
  { key: "HIGHER_EDUCATION", label: "Higher Education",   price: 3000, desc: "Bachelor's & Master's programmes, SGPA/CGPA" },
  { key: "HOSTEL",           label: "Hostel Management",  price: 500,  desc: "Room allocation, hostel fees" },
]
```

---

## ═══════════════════════════════════════════════════
## MARKING SYSTEM — Flexible Grading Engine
## ═══════════════════════════════════════════════════

## ⚠️ CRITICAL DESIGN DECISION: Why the Current Mark Schema Is Wrong

The current schema hardcodes:
```prisma
enum ComponentType { INTERNAL  EXTERNAL  CAS }
model SubjectComponent { type ComponentType; fullMarks Float; passMarks Float }
```

**This breaks every time Nepal changes the curriculum** (which happens every 2–5 years):
- 2073: SLC → SEE, new grading
- 2076: Stream system abolished in +2
- 2077–2080: CBC phased in Grade 1 upward
- 2081: NEB +2 internal/external ratios changed for some subjects

**The fix:** Replace hardcoded types with a database-driven `GradingScheme` + `AssessmentTemplate` system. Schools (or the platform) configure assessment rules per grade level per academic year. Code never changes — only DB records.

---

## Phase 36 — Flexible Grading Engine (Replaces Hardcoded SubjectComponent)
**Priority: CRITICAL — must be done BEFORE Phase 3 (Exam & CAS)**
**Complexity: High**
**Dependencies: Phase 0**

### Nepal Grading Reality (Verified 2081/82)

| Level | System | External | Internal | Pass Rule |
|-------|--------|----------|----------|-----------|
| Grade 1–3 | CBC | 0% | 100% competency | No fail, qualitative only |
| Grade 4–5 | CDC Marks | ~60% | ~40% | 35% each separately |
| Grade 6–8 | CDC CAS | 60% terminal | 40% CAS | 35% theory, 40% internal |
| Grade 9–10 | SEE | 75 external | 25 internal | 35% each separately |
| Grade 9–10 Computer | SEE | 50 theory | 50 practical | 35% each |
| Grade 11–12 Theory | NEB | 75 external | 25 internal | 35% theory, 40% internal |
| Grade 11–12 Science | NEB | 75 theory | 25 practical | 35% theory, 40% practical |
| Bachelor's (TU) | TU GPA | Board exam | Internal | 40% (D grade) |

**SEE Grace Marks:** Up to 3 per subject, max 5 subjects  
**NEB Supplementary:** Max 2 NG subjects can sit grade-increment exam

### Schema — Replace SubjectComponent with Template System

```prisma
// KEEP SubjectComponent for backward compat but link it to a template:

model GradingScheme {
  id             String   @id @default(cuid())
  schoolId       String?                          // null = platform default (seeded)
  name           String   // "SEE 2081", "NEB +2 Theory", "CDC Grade 6-8", "CBC Grade 1-3"
  gradeRange     String   // "1-3" | "4-5" | "6-8" | "9-10" | "11-12" | "bachelor" | "master"
  assessmentType String   // COMPETENCY | MARKS_PERCENT | MARKS_GPA
  applicableFrom String   // BS year e.g. "2081"
  applicableTo   String?  // null = still active
  passMark       Float?   // e.g. 35.0 — minimum % to pass overall (null for COMPETENCY)
  gradeScale     Json
  // [{ label:"A+", minPct:90, maxPct:100, gpa:4.0, description:"Outstanding" },...]
  graceMarksMax  Float    @default(0)             // e.g. 3 per subject (SEE)
  graceSubjMax   Int      @default(0)             // e.g. 5 subjects (SEE)
  isDefault      Boolean  @default(false)
  school         School?  @relation(...)
  templates      AssessmentTemplate[]
  @@map("grading_schemes")
}

model AssessmentTemplate {
  id           String   @id @default(cuid())
  schemeId     String
  name         String   // "SEE Standard", "NEB Science Practical", "NEB Arts Theory"
  subjectTags  Json     // ["SCIENCE","PRACTICAL"] — match when assigning to subject
  components   AssessmentTemplateComponent[]
  subjects     Subject[]  // subjects using this template
  scheme       GradingScheme @relation(...)
  @@map("assessment_templates")
}

model AssessmentTemplateComponent {
  id            String   @id @default(cuid())
  templateId    String
  name          String   // "External Theory" | "Internal Assessment" | "Practical" | "CAS"
  code          String   // "EXT" | "INT" | "PRAC" | "CAS"
  fullMarks     Float    // e.g. 75
  passPct       Float    // e.g. 35.0 — minimum % of THIS component to pass
  isExternal    Boolean  @default(false)  // True = board exam, school cannot edit
  isRequired    Boolean  @default(true)   // Must pass to pass subject
  type          String   // THEORY | PRACTICAL | PROJECT | CAS | ORAL | PORTFOLIO
  weightPct     Float    // 75.0 or 25.0 — percentage weight in final grade
  breakdown     Json?    // For CAS: [{ name:"Participation", marks:5 },...]
  order         Int
  template      AssessmentTemplate @relation(...)
  @@map("assessment_template_components")
}
```

**Update Subject model:**
```prisma
// Add to Subject:
// assessmentTemplateId  String?   // Uses this template; null = old SubjectComponent system
// gradingSchemeId       String?   // Override scheme for this subject
```

### Platform-Seeded Default Templates (run on `prisma db seed`)

```ts
// src/prisma/seed.ts
const PLATFORM_SCHEMES = [
  {
    name: "CBC Grade 1-3 (2080+)",
    gradeRange: "1-3",
    assessmentType: "COMPETENCY",
    applicableFrom: "2080",
    gradeScale: [
      { label: "EE", description: "Exceeding Expectations", minPct: 90 },
      { label: "ME", description: "Meeting Expectations", minPct: 60 },
      { label: "AE", description: "Approaching Expectations", minPct: 40 },
      { label: "BE", description: "Below Expectations", minPct: 0 },
    ],
    templates: [{ name: "CBC Competency", components: [
      { name: "Continuous Assessment", code: "CAS", fullMarks: 100, passPct: 0, isExternal: false, type: "PORTFOLIO", weightPct: 100 }
    ]}]
  },
  {
    name: "CDC Grade 6-8 (2078+)",
    gradeRange: "6-8",
    assessmentType: "MARKS_GPA",
    passMark: 35,
    gradeScale: [
      { label: "A+", minPct: 90, maxPct: 100, gpa: 4.0 },
      { label: "A",  minPct: 80, maxPct: 89,  gpa: 3.6 },
      { label: "B+", minPct: 70, maxPct: 79,  gpa: 3.2 },
      { label: "B",  minPct: 60, maxPct: 69,  gpa: 2.8 },
      { label: "C+", minPct: 50, maxPct: 59,  gpa: 2.4 },
      { label: "C",  minPct: 40, maxPct: 49,  gpa: 2.0 },
      { label: "D",  minPct: 35, maxPct: 39,  gpa: 1.6 },
      { label: "NG", minPct: 0,  maxPct: 34,  gpa: 0.0 },
    ],
    templates: [{ name: "CDC 60/40", components: [
      { name: "Terminal Exam", code: "EXT", fullMarks: 60, passPct: 35, isExternal: true,  type: "THEORY",  weightPct: 60 },
      { name: "Internal/CAS",  code: "INT", fullMarks: 40, passPct: 40, isExternal: false, type: "CAS",     weightPct: 40,
        breakdown: [{ name:"Attendance", marks:5 },{ name:"Participation", marks:10 },{ name:"Assignment", marks:10 },{ name:"Unit Test", marks:15 }]
      }
    ]}]
  },
  {
    name: "SEE Grade 9-10 (2073+)",
    gradeRange: "9-10",
    assessmentType: "MARKS_GPA",
    passMark: 35,
    graceMarksMax: 3,
    graceSubjMax: 5,
    gradeScale: [ /* same as CDC above */ ],
    templates: [
      { name: "SEE Standard 75/25", components: [
        { name: "External Exam", code: "EXT", fullMarks: 75, passPct: 35, isExternal: true,  type: "THEORY",    weightPct: 75 },
        { name: "Internal",      code: "INT", fullMarks: 25, passPct: 40, isExternal: false, type: "CAS",       weightPct: 25 }
      ]},
      { name: "SEE Computer 50/50", subjectTags: ["COMPUTER"], components: [
        { name: "Theory",    code: "EXT",  fullMarks: 50, passPct: 35, isExternal: true,  type: "THEORY",    weightPct: 50 },
        { name: "Practical", code: "PRAC", fullMarks: 50, passPct: 40, isExternal: false, type: "PRACTICAL", weightPct: 50 }
      ]}
    ]
  },
  {
    name: "NEB Grade 11-12 (2076+)",
    gradeRange: "11-12",
    assessmentType: "MARKS_GPA",
    passMark: 35,
    gradeScale: [ /* same */ ],
    templates: [
      { name: "NEB Theory 75/25", components: [
        { name: "External Theory", code: "EXT", fullMarks: 75, passPct: 35, isExternal: true,  type: "THEORY", weightPct: 75 },
        { name: "Internal",        code: "INT", fullMarks: 25, passPct: 40, isExternal: false, type: "CAS",    weightPct: 25 }
      ]},
      { name: "NEB Science Practical 75+25", subjectTags: ["SCIENCE","PRACTICAL"], components: [
        { name: "Theory",    code: "EXT",  fullMarks: 75, passPct: 35, isExternal: true,  type: "THEORY",    weightPct: 75 },
        { name: "Practical", code: "PRAC", fullMarks: 25, passPct: 40, isExternal: false, type: "PRACTICAL", weightPct: 25 }
      ]}
    ]
  }
]
```

### Grading Engine — `src/lib/grading.ts` (complete rewrite)

```ts
export async function computeSubjectResult(
  templateId: string,
  scores: { componentCode: string; obtained: number; isAbsent?: boolean }[],
  graceMarksUsed?: number
): Promise<{
  totalObtained: number; totalFull: number; percentage: number
  grade: string; gpa: number; isPassed: boolean
  failedComponents: string[]; isNG: boolean
}>

export async function computeClassResults(
  schoolId: string; examId: string; classId: string
): Promise<StudentResult[]>
// Batch computes all student results for a class, applies grace marks where eligible

export async function computeSEEGPA(subjectResults: SubjectResult[]): Promise<number>
// CGPA = sum of GPA of 5 main subjects ÷ 5

export async function computeNEBGPA(subjectResults: SubjectResult[]): Promise<number>

// When Nepal changes rules, create a new GradingScheme record.
// The engine reads rules from DB — zero code changes needed.
```

### Routes

```
src/app/[domain]/settings/grading/
├── page.tsx          # Grading schemes list (platform defaults + school custom)
├── new/page.tsx      # Create custom scheme (for schools with non-standard marking)
└── [schemeId]/
    ├── page.tsx      # Scheme detail + templates
    └── templates/
        └── [templateId]/page.tsx  # Edit component weights/marks
```

---

## Phase 37 — CBC Assessment UI (Grades 1–3)
**Priority: HIGH (mandatory for primary schools)**
**Complexity: Medium**
**Dependencies: Phase 36**

### CBC Competency Indicators (Verified Nepal 2081)

```ts
// No numerical marks — qualitative descriptors only
export const CBC_LEVELS = [
  { code: "EE", label: "Exceeding Expectations", color: "emerald" },
  { code: "ME", label: "Meeting Expectations",   color: "blue"    },
  { code: "AE", label: "Approaching Expectations", color: "amber" },
  { code: "BE", label: "Below Expectations",     color: "rose"    },
]
```

### Schema Additions

```prisma
model CBCAssessment {
  id           String   @id @default(cuid())
  schoolId     String
  studentId    String
  subjectId    String
  academicYearId String
  termNumber   Int      // 1, 2, or 3 (Nepal has 3 terms for Grade 1-3)
  level        String   // EE | ME | AE | BE
  teacherNote  String?
  assessedById String
  assessedAt   DateTime @default(now())
  school       School   @relation(...)
  @@unique([studentId, subjectId, academicYearId, termNumber])
  @@map("cbc_assessments")
}
```

### Routes

```
src/app/[domain]/exams/cbc/
├── page.tsx                   # CBC overview (class selector → subject grid)
└── [classId]/[termNumber]/
    └── page.tsx               # Enter CBC levels per student per subject
```

### Report Card for CBC (completely different format)

No marks shown — only competency levels per subject with teacher comments. Print-ready PDF via `@react-pdf/renderer` with visual indicator chips.

---

## Phase 38 — Supplementary / Grade Increment Exam
**Priority: HIGH**
**Complexity: Medium**
**Dependencies: Phase 3, Phase 36**

### Schema Additions

```prisma
model SupplementaryExam {
  id             String   @id @default(cuid())
  schoolId       String
  academicYearId String
  name           String   // "SEE Grade Increment 2082" | "NEB Supplementary 2082"
  type           String   // SEE_GRADE_INCREMENT | NEB_SUPPLEMENTARY | INTERNAL
  applicationFee Float    @default(600)  // Rs. 600 per student (NEB/SEE standard)
  startDateBS    String
  endDateBS      String?
  maxSubjects    Int      @default(2)    // NEB: max 2 subjects per sitting
  registrations  SupplementaryRegistration[]
  school         School   @relation(...)
  @@map("supplementary_exams")
}

model SupplementaryRegistration {
  id           String   @id @default(cuid())
  examId       String
  studentId    String
  subjectIds   Json     // [subjectId1, subjectId2] — max 2 for NEB
  feePaid      Float    @default(0)
  status       String   // REGISTERED | FEE_PAID | APPEARED | PASSED | FAILED
  resultGrade  String?
  resultGPA    Float?
  exam         SupplementaryExam @relation(...)
  @@unique([examId, studentId])
  @@map("supplementary_registrations")
}
```

### Eligibility Check Logic

```ts
// src/lib/grading.ts
export async function getSupplementaryEligibility(schoolId: string, studentId: string, examId: string): Promise<{
  isEligible: boolean
  ngSubjects: Subject[]      // Subjects with NG grade
  reason: string             // "Eligible: 2 NG subjects" | "Ineligible: 4 NG subjects"
}>
// SEE: eligible if NG in ≤ 2 subjects
// NEB: eligible if D+ in all except max 2 with NG, or absent in max 2
```

---

## ═══════════════════════════════════════════════════
## CANTEEN — Student Wallet & Meal Management
## ═══════════════════════════════════════════════════

## Phase 39 — Canteen Management & Student Digital Wallet
**Priority: HIGH**
**Complexity: High**
**Dependencies: Phase 1 (Students), Phase 4 (Finance)**
**Module gate:** `CANTEEN`
**New module price:** Rs. 800/mo

### How It Works

```
Parent/School tops up wallet → Student has wallet balance
Student shows ID/QR at canteen counter
Canteen staff selects items → deducts from wallet
Transaction logged instantly
Low balance → SMS alert to parent
```

### Schema Additions

```prisma
model StudentWallet {
  id           String   @id @default(cuid())
  schoolId     String
  studentId    String   @unique
  balance      Float    @default(0)
  dailyLimit   Float?                              // Optional max spend per day
  isActive     Boolean  @default(true)
  school       School   @relation(...)
  student      Student  @relation(...)
  transactions WalletTransaction[]
  @@map("student_wallets")
}

model WalletTransaction {
  id           String   @id @default(cuid())
  walletId     String
  schoolId     String
  type         String   // CREDIT | DEBIT
  amount       Float
  balanceAfter Float                               // Snapshot balance after transaction
  source       String
  // PARENT_TOPUP | SCHOOL_TOPUP | MDM_CREDIT | CANTEEN_PURCHASE | REFUND | FEE_DEDUCT
  referenceId  String?                             // CanteenOrder.id or FeePayment.id
  description  String
  createdById  String
  createdAt    DateTime @default(now())
  wallet       StudentWallet @relation(...)
  school       School   @relation(...)
  @@map("wallet_transactions")
}

model CanteenMenu {
  id          String   @id @default(cuid())
  schoolId    String
  name        String   // "Regular Menu", "Week A Menu"
  isActive    Boolean  @default(true)
  school      School   @relation(...)
  items       CanteenItem[]
  @@map("canteen_menus")
}

model CanteenItem {
  id          String   @id @default(cuid())
  menuId      String
  name        String   // "Dal Bhat Set", "Momo (6 pcs)", "Khichdi", "Tea"
  price       Float
  category    String   // MEAL | SNACK | DRINK | FRUIT | BREAKFAST
  isAvailable Boolean  @default(true)
  imageUrl    String?
  allergens   String?  // "gluten, dairy"
  calories    Int?
  menu        CanteenMenu @relation(...)
  @@map("canteen_items")
}

model CanteenOrder {
  id          String   @id @default(cuid())
  schoolId    String
  studentId   String
  items       Json     // [{ itemId, name, price, qty, subtotal }]
  totalAmount Float
  paidAt      DateTime @default(now())
  paidAtBS    String
  paymentType String   // WALLET | MDM | CASH
  walletTxId  String?
  servedById  String   // Canteen staff
  school      School   @relation(...)
  student     Student  @relation(...)
  @@map("canteen_orders")
}
```

### Routes

```
src/app/[domain]/canteen/
├── page.tsx                   # Dashboard: today's orders, revenue, low-balance alerts
├── pos/
│   └── page.tsx               # POS terminal: search student by name/ID/QR → select items → charge wallet
├── menu/
│   ├── page.tsx               # Menu items management
│   └── new/page.tsx           # Add menu item
├── wallets/
│   ├── page.tsx               # All student wallets with balance
│   ├── topup/page.tsx         # Bulk top-up (school tops up wallets)
│   └── [studentId]/page.tsx   # Student wallet detail + transaction history
└── reports/
    └── page.tsx               # Daily/monthly canteen revenue + most popular items
```

### Server Actions — `src/actions/canteen.ts`

```ts
export async function getOrCreateWallet(schoolId: string, studentId: string): Promise<StudentWallet>
export async function topUpWallet(schoolId: string, studentId: string, amount: number, source: string, createdById: string)
// source: "PARENT_TOPUP" | "SCHOOL_TOPUP" | "MDM_CREDIT"
// After top-up: check if dailyLimit needs SMS update to parent

export async function processCanteenOrder(schoolId: string, data: CanteenOrderInput): Promise<CanteenOrder>
// 1. Check wallet balance >= total
// 2. Debit wallet (create WalletTransaction DEBIT)
// 3. Create CanteenOrder
// 4. If balance < lowBalanceThreshold → trigger SMS to parent
// All in $transaction

export async function getWalletBalance(schoolId: string, studentId: string): Promise<number>
export async function getDailyCanteenReport(schoolId: string, dateBS: string)
export async function getTopUpHistory(schoolId: string, studentId: string)
```

### POS Terminal UI Pattern

```
Full-screen POS mode (canteen staff view):
1. Student search: type name / scan QR code / type roll number
2. Show student photo + name + wallet balance
3. Menu grid: item cards with price, click to add to order
4. Order summary: items list + running total
5. Confirm button: deduct from wallet
6. Receipt: print or SMS to parent
7. Low balance warning if < Rs. 100 after purchase
```

---

## Phase 40 — Government School Mid-Day Meal (MDM)
**Priority: HIGH (for government/community schools)**
**Complexity: Medium**
**Dependencies: Phase 39**

### Nepal MDM Program Facts (2081/82)
- **Coverage:** ECED to Grade 5, all 77 districts
- **Funding:** Rs. 15/student/day (regular), Rs. 20/student/day (Karnali/remote)
- **School year:** 180 working days
- **Flow:** Govt → Municipality → School → Purchase ingredients locally

### Schema Additions

```prisma
model MDMProgram {
  id              String   @id @default(cuid())
  schoolId        String   @unique
  isEnrolled      Boolean  @default(false)
  ratePerStudent  Float    @default(15)             // Rs. 15 or Rs. 20
  eligibleGrades  Json     @default("[\"ECED\",\"1\",\"2\",\"3\",\"4\",\"5\"]")
  fiscalYearBS    String                            // "2081/82"
  school          School   @relation(...)
  mealRecords     MDMMealRecord[]
  fundReceipts    MDMFundReceipt[]
  @@map("mdm_programs")
}

model MDMMealRecord {
  id          String   @id @default(cuid())
  schoolId    String
  classId     String
  dateBS      String
  presentCount Int                                  // Students who ate (present students)
  mealType    String   @default("LUNCH")           // BREAKFAST | LUNCH | SNACK
  fundUsed    Float                                 // presentCount × ratePerStudent
  preparedBy  String?
  menuDesc    String?                              // "Dal Bhat, Vegetables"
  school      School   @relation(...)
  @@unique([schoolId, classId, dateBS, mealType])
  @@map("mdm_meal_records")
}

model MDMFundReceipt {
  id          String   @id @default(cuid())
  schoolId    String
  amount      Float
  receivedBS  String
  source      String   // "Municipality", "District Education Office"
  referenceNo String?
  school      School   @relation(...)
  @@map("mdm_fund_receipts")
}
```

### Server Actions — `src/actions/mdm.ts`

```ts
export async function recordDailyMDMMeals(schoolId: string, dateBS: string)
// Auto-reads today's attendance for eligible grades → creates MDMMealRecord
// Credits MDM amount to each present student's wallet (walletTxId source: "MDM_CREDIT")

export async function getMDMUtilizationReport(schoolId: string, fromBS: string, toBS: string)
// Returns: total students fed, total fund used, fund received vs used, balance

export async function recordFundReceipt(schoolId: string, data: MDMFundReceiptInput)
```

### MDM Wallet Integration

```ts
// When daily MDM meals are recorded:
// 1. Get present students for eligible grades
// 2. Credit Rs. 15 to each student's wallet with source="MDM_CREDIT"
// 3. Student uses wallet at canteen (deducted as CANTEEN_PURCHASE)
// 4. Or school purchases food directly and records as expense
```

---

## ═══════════════════════════════════════════════════
## PROCUREMENT — Inventory & Vendor Bidding
## ═══════════════════════════════════════════════════

## Phase 41 — Inventory Management
**Priority: MEDIUM**
**Complexity: Medium**
**Dependencies: Phase 0**
**Permission codes:** `inventory:view`, `inventory:manage`

### Schema Additions

```prisma
model InventoryCategory {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "Stationery", "Furniture", "Electronics", "Cleaning", "Sports"
  color     String?
  school    School   @relation(...)
  items     InventoryItem[]
  @@map("inventory_categories")
}

model InventoryItem {
  id              String   @id @default(cuid())
  schoolId        String
  categoryId      String
  name            String   // "A4 Paper 80gsm", "Whiteboard Marker (Black)"
  sku             String?  // Internal SKU
  unit            String   // "Bundle" | "Box" | "Piece" | "Kg" | "Litre" | "Ream"
  currentStock    Float    @default(0)
  minStockAlert   Float    @default(0)                // Alert when below this
  maxStock        Float?                              // Reorder ceiling
  lastPurchasePrice Float?
  lastPurchaseBS  String?
  location        String?                             // "Store Room A, Shelf 3"
  school          School   @relation(...)
  category        InventoryCategory @relation(...)
  stockMovements  StockMovement[]
  requisitionItems RequisitionItem[]
  @@map("inventory_items")
}

model StockMovement {
  id          String   @id @default(cuid())
  schoolId    String
  itemId      String
  type        String   // IN | OUT | ADJUSTMENT
  quantity    Float
  balanceAfter Float
  reason      String   // "Purchase (PO-2081-001)" | "Issued to Class 10" | "Damaged"
  referenceId String?  // PurchaseOrder.id or CanteenOrder.id
  createdById String
  createdAt   DateTime @default(now())
  item        InventoryItem @relation(...)
  school      School   @relation(...)
  @@map("stock_movements")
}
```

### Routes

```
src/app/[domain]/inventory/
├── page.tsx                # Overview: low-stock alerts, recent movements
├── items/
│   ├── page.tsx            # All items DataTable with stock levels
│   ├── new/page.tsx        # Add item
│   └── [itemId]/page.tsx   # Item detail + movement history
├── categories/page.tsx     # Manage categories
└── movements/page.tsx      # Full stock movement log
```

---

## Phase 42 — Procurement & Vendor Bidding
**Priority: MEDIUM**
**Complexity: High**
**Dependencies: Phase 41**
**Permission codes:** `procurement:view`, `procurement:manage`

### How It Works (PPMO-Inspired)

```
School creates Purchase Requisition (what they need + specs)
         ↓
Requisition published → Vendors notified / invited to bid
         ↓
Vendors submit bids (price per item + total + delivery terms)
         ↓
School reviews Comparative Statement (all bids side-by-side)
         ↓
Lowest/best bid selected → Purchase Order generated
         ↓
Vendor delivers → Goods Received Note (GRN) confirms
         ↓
Inventory auto-updated → Payment tracked
```

### Schema Additions

```prisma
model Vendor {
  id           String   @id @default(cuid())
  schoolId     String?                              // null = platform-wide vendor (visible to all schools)
  companyName  String
  contactName  String
  phone        String
  email        String?
  address      String?
  panNumber    String?                              // Nepal VAT/PAN
  categories   Json     // ["Stationery","Furniture","Electronics"]
  rating       Float?                              // Avg from past orders
  totalOrders  Int      @default(0)
  isApproved   Boolean  @default(false)
  isBlacklisted Boolean @default(false)
  createdAt    DateTime @default(now())
  school       School?  @relation(...)
  bids         VendorBid[]
  purchaseOrders PurchaseOrder[]
  @@map("vendors")
}

model PurchaseRequisition {
  id            String   @id @default(cuid())
  schoolId      String
  reqNumber     String   @unique             // REQ-2081-00042
  title         String   // "Office Stationery Q1 2081"
  description   String?
  status        String   @default("DRAFT")
  // DRAFT → OPEN → BIDDING → UNDER_REVIEW → AWARDED → FULFILLED → CANCELLED
  bidDeadline   DateTime                     // When bidding closes
  bidDeadlineBS String
  estimatedTotal Float?
  createdById   String
  createdAt     DateTime @default(now())
  items         RequisitionItem[]
  bids          VendorBid[]
  purchaseOrder PurchaseOrder?
  school        School   @relation(...)
  @@map("purchase_requisitions")
}

model RequisitionItem {
  id               String   @id @default(cuid())
  requisitionId    String
  inventoryItemId  String
  quantity         Float
  unit             String
  specifications   String?  // "80gsm, A4, 500 sheets/ream, ITC or equivalent"
  estimatedPrice   Float?   // School's internal estimate
  requisition      PurchaseRequisition @relation(...)
  inventoryItem    InventoryItem @relation(...)
  bidItems         VendorBidItem[]
  @@map("requisition_items")
}

model VendorBid {
  id              String   @id @default(cuid())
  requisitionId   String
  vendorId        String
  totalAmount     Float                            // Sum of all item bids
  deliveryDays    Int                              // Promised delivery in working days
  validUntilBS    String                           // Bid validity date
  paymentTerms    String?  // "Cash on delivery" | "Net 30 days"
  warrantyTerms   String?
  note            String?
  status          String   @default("SUBMITTED")  // SUBMITTED | AWARDED | REJECTED
  submittedAt     DateTime @default(now())
  items           VendorBidItem[]
  requisition     PurchaseRequisition @relation(...)
  vendor          Vendor   @relation(...)
  @@unique([requisitionId, vendorId])
  @@map("vendor_bids")
}

model VendorBidItem {
  id                String   @id @default(cuid())
  bidId             String
  requisitionItemId String
  brand             String?
  unitPrice         Float
  totalPrice        Float
  deliveryDays      Int?
  notes             String?
  bid               VendorBid @relation(...)
  requisitionItem   RequisitionItem @relation(...)
  @@map("vendor_bid_items")
}

model PurchaseOrder {
  id              String   @id @default(cuid())
  schoolId        String
  requisitionId   String   @unique
  vendorId        String
  bidId           String   @unique
  poNumber        String   @unique             // PO-2081-00042
  totalAmount     Float
  vatAmount       Float    @default(0)
  grandTotal      Float
  status          String   @default("ISSUED")
  // ISSUED | PARTIALLY_DELIVERED | DELIVERED | CANCELLED
  issuedAt        DateTime @default(now())
  issuedAtBS      String
  expectedByBS    String
  deliveredAt     DateTime?
  deliveredAtBS   String?
  paymentStatus   String   @default("PENDING") // PENDING | PARTIAL | PAID
  paidAmount      Float    @default(0)
  school          School   @relation(...)
  vendor          Vendor   @relation(...)
  grn             GoodsReceivedNote?
  @@map("purchase_orders")
}

model GoodsReceivedNote {
  id           String   @id @default(cuid())
  poId         String   @unique
  schoolId     String
  grnNumber    String   @unique             // GRN-2081-00042
  receivedById String
  receivedAt   DateTime @default(now())
  receivedAtBS String
  items        Json
  // [{ requisitionItemId, itemName, orderedQty, receivedQty, unit, condition:"GOOD"|"DAMAGED", remarks }]
  remarks      String?
  isVerified   Boolean  @default(false)
  verifiedById String?
  po           PurchaseOrder @relation(...)
  school       School   @relation(...)
  @@map("goods_received_notes")
}
```

### Routes

```
src/app/[domain]/procurement/
├── page.tsx                        # Dashboard: active requisitions, pending GRNs, vendor ratings
├── requisitions/
│   ├── page.tsx                    # All requisitions with status
│   ├── new/page.tsx                # Create requisition (select items + specs)
│   └── [reqId]/
│       ├── page.tsx                # Requisition detail
│       ├── bids/
│       │   ├── page.tsx            # All bids received + comparative statement
│       │   └── compare/page.tsx    # Side-by-side bid comparison table → award
│       └── po/page.tsx             # Purchase Order detail + print
├── vendors/
│   ├── page.tsx                    # Vendor registry DataTable
│   ├── new/page.tsx                # Register vendor
│   └── [vendorId]/page.tsx         # Vendor profile + bid history + rating
├── grn/
│   ├── page.tsx                    # All GRNs
│   └── [grnId]/page.tsx            # GRN detail → verify → update stock
└── reports/
    └── page.tsx                    # Spending by category, vendor performance, savings vs estimate
```

### Server Actions — `src/actions/procurement.ts`

```ts
export async function createRequisition(schoolId: string, data: RequisitionInput): Promise<PurchaseRequisition>
// Auto-generates REQ-{BSYear}-{seq}

export async function publishRequisition(schoolId: string, reqId: string)
// status: DRAFT → OPEN; notify registered vendors via email/SMS

export async function submitVendorBid(requisitionId: string, vendorId: string, data: BidInput): Promise<VendorBid>
// Only allowed when status === "OPEN" and before bidDeadline

export async function getComparativeStatement(requisitionId: string)
// Returns all bids side-by-side per item, ranked by total price
// Highlights: lowest total, fastest delivery, best-rated vendor

export async function awardBid(schoolId: string, requisitionId: string, bidId: string, awardedById: string)
// 1. status → AWARDED; winning bid status → AWARDED; others → REJECTED
// 2. Creates PurchaseOrder with auto-generated PO number
// 3. Sends award notification to winning vendor

export async function createGRN(schoolId: string, poId: string, data: GRNInput): Promise<GoodsReceivedNote>
// After GRN verified:
// 1. Updates InventoryItem.currentStock (creates StockMovement records)
// 2. PurchaseOrder.status → DELIVERED

export async function getVendorRanking(schoolId: string)
// Returns vendors ranked by: delivery time, price competitiveness, order count
```

### Comparative Statement UI

```
Comparative Statement for: "Office Stationery Q1 2081"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Item                    | Qty | Vendor A    | Vendor B    | Vendor C
                        |     | Rs.Unit/Tot | Rs.Unit/Tot | Rs.Unit/Tot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A4 Paper 80gsm          | 4   | 550/2,200 ✓ | 600/2,400   | 520/2,080 ★
Whiteboard Marker Black | 12  | 30/360      | 25/300 ✓    | 35/420
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL                   |     | Rs. 2,560   | Rs. 2,700   | Rs. 2,500 ★
Delivery Days           |     | 3 days      | 2 days ✓    | 5 days
Vendor Rating           |     | ⭐ 4.2      | ⭐ 4.8 ✓   | ⭐ 3.9

★ = Lowest price   ✓ = Best on this criterion
[Award to Vendor A] [Award to Vendor B] [Award to Vendor C]
```

---

## Updated Complete Module Keys

```ts
export const ALL_MODULES = [
  { key: "FINANCE_TAX",      label: "Finance & Tax",      price: 2000, desc: "IRD billing, payroll, TDS, SSF" },
  { key: "EXAM_CAS",         label: "Exam & CAS",         price: 1500, desc: "Flexible grading engine, NEB/CDC/CBC/TU, report cards" },
  { key: "TRANSPORT_GPS",    label: "Transport GPS",      price: 500,  desc: "Bus tracking, route management" },
  { key: "MOBILE_APP",       label: "Mobile App",         price: 833,  desc: "Parent & student mobile app" },
  { key: "ONLINE_LEARNING",  label: "Online Learning",    price: 2500, desc: "LMS, live classes, quizzes, assignments" },
  { key: "HIGHER_EDUCATION", label: "Higher Education",   price: 3000, desc: "Bachelor's & Master's, SGPA/CGPA, thesis" },
  { key: "HOSTEL",           label: "Hostel Management",  price: 500,  desc: "Room allocation, hostel fees" },
  { key: "CANTEEN",          label: "Canteen + Wallet",   price: 800,  desc: "Student wallet, POS, MDM meal tracking" },
  { key: "PROCUREMENT",      label: "Procurement",        price: 1000, desc: "Inventory, vendor bidding, purchase orders" },
]
```

---

## Updated Dependencies to Install

```bash
# Already planned:
npm install @react-pdf/renderer          # PDF: certs, report cards, invoices, ID cards
npm install @dnd-kit/core @dnd-kit/sortable  # Drag-and-drop: timetable + LMS builder
npm install papaparse && npm install -D @types/papaparse  # CSV bulk import
npm install web-push && npm install -D @types/web-push    # Push notifications

# NEW — Gap fixes:
npm install xlsx                         # Excel export (IRD/MoE reports, payroll)
npm install resend                       # Email notifications
npm install qrcode && npm install -D @types/qrcode  # QR on certificates/marksheets

# NEW — LMS:
npm install react-player                 # Video player (YouTube, file, HLS)
npm install @tiptap/react @tiptap/starter-kit  # Rich text editor for lesson content + discussion
npm install react-dropzone               # File upload UI (assignments, documents)

# NEW — Payment:
npm install crypto                       # eSewa HMAC SHA256 verification (built-in Node.js)

# NEW — Higher Education:
# No new packages needed — uses existing Prisma + React
```

---

## Anti-Patterns to Avoid

1. **Never query without schoolId** — every Prisma query must include `where: { schoolId }`
2. **Never use JS Date for Nepal dates** — always store and display BS strings alongside `DateTime`
3. **Never skip `revalidatePath()`** — every mutation must invalidate the relevant cached route
4. **Never create REST routes for CRUD** — use Server Actions; API routes only for mobile app + payment webhooks
5. **Never inline TDS/SSF math** — always use `src/lib/finance.ts` utilities
6. **Never bypass module gate** — call `requireModule(schoolId, "MODULE_KEY")` in module server actions
7. **Never use `any` for Prisma results** — define typed `*Column` types for DataTable
8. **Never write files to `/public/uploads/`** — always use `src/lib/storage.ts` → Supabase Storage
9. **Never show HE routes to K-12 schools** — always check `institutionType` before rendering HE navigation
10. **Never store quiz answers client-side only** — always persist `QuizAttempt` in DB before submission
11. **Never skip video size validation** — enforce max upload size before Supabase Storage write
12. **Never commit payment keys** — `esewaKey`, `khaltiKey` must be in `.env.local` only

---

*This roadmap is the single source of truth. Each phase is self-contained and can be executed in a fresh chat context.*
*Last updated: 2026-05-03 — Added HE support (Bachelor's/Master's), full LMS, gap fixes (SMS, calendar, admission, promotion, discounts, library, certs, parent portal, eSewa/Khalti, bulk ops, Supabase Storage)*
