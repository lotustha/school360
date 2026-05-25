# Fee Billing & Bill-Assignment System — Implementation Plan

**Project:** School360 (multi-tenant K-12 SaaS, Nepal)
**Author:** Claude Opus 4.7 (1M)
**Created:** 2026-05-24
**Foundation already shipped:** Multi-line fee receipts (`FeePayment` + `FeePaymentLine` + `AccountPicker` + RV voucher posting).

---

## Executive summary

Today the only way to put money against a student is `recordFeePayment` — admins type the head and amount each time, every receipt. There is no concept of "what a student owes." This plan introduces that concept (a **Bill**) and the templates that generate bills automatically (a **Plan** + **Assignment**), then teaches `recordFeePayment` to **settle bills** instead of just record income.

Design pillars (per user requirements):

| Pillar | Concrete target |
|---|---|
| Very less clicks | Bulk-assign a plan to a class = **3 clicks** (plan → class → Apply). Collect fee from a student with outstanding bills = **2 clicks** (pick student → Submit; bills auto-allocate). |
| Most of it automatic | Recurring bills auto-generate on the 1st of each BS month via scheduled action. Payments auto-allocate FIFO. Late fees auto-post on overdue. |
| Beautiful UI | All net-new screens routed through `/ui-ux-pro-max` skill (see UI design call-outs in each phase). |
| Easy to navigate | All billing under `/finance/billing/*`. Add one nav tab to `finance-nav.tsx`. Common admin journeys ≤ 2 screen hops. |

---

## Phase 0 — Documentation Discovery (DONE)

These facts were extracted from the live codebase by subagents on 2026-05-24. **All subsequent phases must follow these conventions, not invent alternatives.**

### Existing models (verbatim-relevant)

- `FeeStructure` — flat template: `name`, `amount: Float`, optional `classId`. **No line items.** Effectively unused today. *Do not extend it; build new models alongside and leave it for backwards-compat.*
- `FeePayment` — multi-line ready: `feeAccountId` is now nullable; `lines: FeePaymentLine[]` is the source of truth for new rows. Header carries `feeStructureId?` (also unused today — we will repurpose it to point at a `FeeBill` via a new column, not by overloading this one).
- `FeePaymentLine` — `feePaymentId`, `feeAccountId`, `amount`, `remarks?`, `lineNo`. Indexed on `feePaymentId`.
- `Voucher` — full double-entry doc with `lines: JournalEntry[]`, `totalAmount`, `status` (DRAFT|POSTED|REVERSED), per-FY numbering.
- `VoucherCounter` — `@@unique([schoolId, fiscalYearId, type])`. Allocation pattern: `upsert({ create: { lastNumber: 1 }, update: { lastNumber: { increment: 1 } } })`. Used for `RV`, `PV`, `CV`, `JV`, `FR`. We will add `BL` (Bill) and `BA` (Bill Adjustment / discount).
- `FiscalYear` — `status: OPEN | CLOSED | LOCKED`. Use `resolveFiscalYearForDate(schoolId, dateBS)` and reject if status ≠ `OPEN`.
- `Account` — `@@unique([schoolId, code])`, `type: ASSET|LIABILITY|EQUITY|INCOME|EXPENSE`. Fee heads = `type === "INCOME"`. There is **no** "Student Receivable" subsidiary today.
- `Student` — has `schoolId, admissionNo, classId?, sectionId?, userId`. Already related to `FeePayment[]`.

### Existing conventions (must follow)

| Concern | Pattern |
|---|---|
| Permission gating | `const session = await requirePermission("finance:manage")` at the top of every action. Add new permission `finance:billing` to `SYSTEM_PERMISSIONS` in `src/lib/permissions.ts`. |
| Input validation | `zod` schemas at the top of the action file. Type-export via `z.infer<typeof schema>`. |
| Atomic mutations | `prisma.$transaction(async (tx) => { ... })` — all writes inside the closure use `tx`, not `prisma`. |
| Numbering | Allocate via `tx.voucherCounter.upsert(...)`; format `${type}-${fy.name}-${String(n).padStart(4, "0")}`. |
| Voucher posting | Build `lines: { create: [...] }` inline on `tx.voucher.create`. `status: "POSTED"`, `postedAt: new Date()`, `postedById: session.user.id`. |
| Cache invalidation | `revalidatePath("/finance")`, `/finance/billing`, `/accounting`, `/accounting/vouchers`, `/accounting/reports/trial-balance` after any mutation that creates a voucher. |
| Nepali dates | `todayBS()`, `toAD(bsStr)`, `toBS(date)`, `formatBS(bsStr)`, `bsMonthName(m)`, `fiscalYearOf(bsStr)`. **Missing helper to add in Phase 1:** `nextBSMonthStart(bsStr): string` and `bsMonthEnd(year, month): string`. |
| UI | shadcn/ui (Radix + Tailwind v4). `AccountPicker`, `NepaliDateInput` exist and must be reused. `cn()` from `@/lib/utils`. |
| Server actions | One file per resource under `src/actions/accounting/` or `src/actions/billing/`. Each action `"use server"`. |

### Anti-patterns to guard against

- ❌ Reading `feeAccount.name` on a `FeePayment` without first checking `lines.length > 0` — legacy rows have it, new rows don't. (Already fixed in current reads — keep this discipline in new code.)
- ❌ Generating a bill outside a fiscal year that's `OPEN`.
- ❌ Posting a payment that exceeds the sum of allocated bills without explicit "advance payment" mode.
- ❌ Reusing `type: "FR"` for bills. New types: `BL` (Bill), `BA` (Bill Adjustment).
- ❌ Editing `FeeStructure` to carry frequency/schedule. It stays legacy. Build `FeePlan` alongside.
- ❌ Lazy bill generation on first view. Always eager + idempotent (one row per `[planAssignmentId, periodBS]`).

---

## Phase 1 — MVP (Manual everything, but correct)

**Goal:** A school admin can (a) define what a class owes, (b) generate this month's bills for a class with one click, (c) see a student's outstanding balance, and (d) collect a payment that auto-allocates to outstanding bills FIFO. **No cron yet.** Everything is button-triggered.

### Schema additions

Add to `prisma/schema.prisma`. All new models include `schoolId` and the standard `@@map` snake_case naming.

```prisma
// A bundle of fee heads at fixed amounts, with a billing frequency.
// Replaces the role FeeStructure was meant to fill.
model FeePlan {
  id          String   @id @default(cuid())
  schoolId    String
  name        String   // "Grade 5 Monthly Tuition", "Annual Function 2082"
  frequency   String   // MONTHLY | ANNUAL | ONE_TIME | EVENT
  /** For MONTHLY: 1-32 (1 = bill on Baisakh 1, etc). For ANNUAL: e.g. 1 = first month of FY. Ignored for ONE_TIME / EVENT. */
  dueDayOfMonth Int?   @default(10)
  /** Default narration prefix applied to generated bills. */
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  school      School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  items       FeePlanItem[]
  assignments FeePlanAssignment[]
  bills       FeeBill[]

  @@index([schoolId])
  @@map("fee_plans")
}

model FeePlanItem {
  id           String  @id @default(cuid())
  feePlanId    String
  feeAccountId String  // INCOME account
  amount       Decimal @db.Decimal(14, 2)
  label        String? // optional override of account name on the bill line
  lineNo       Int

  feePlan    FeePlan @relation(fields: [feePlanId], references: [id], onDelete: Cascade)
  feeAccount Account @relation("FeePlanItemAccount", fields: [feeAccountId], references: [id], onDelete: Restrict)

  @@index([feePlanId])
  @@map("fee_plan_items")
}

// Links a plan to a target. A target is one of:
// - whole school (classId=null, sectionId=null, studentId=null)
// - a class (classId set)
// - a section (classId+sectionId)
// - a single student (studentId)
model FeePlanAssignment {
  id          String   @id @default(cuid())
  schoolId    String
  feePlanId   String
  classId     String?
  sectionId   String?
  studentId   String?
  /** BS date assignment becomes effective. */
  startBS     String
  /** BS date assignment ends. null = open-ended. */
  endBS       String?
  /** Override the plan amount for THIS assignment (e.g. scholarship). null = use plan items as-is. */
  overrideAmount Decimal? @db.Decimal(14, 2)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  school   School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  feePlan  FeePlan   @relation(fields: [feePlanId], references: [id], onDelete: Cascade)
  class    Class?    @relation(fields: [classId],   references: [id], onDelete: SetNull)
  section  Section?  @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  student  Student?  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  bills    FeeBill[]

  @@index([schoolId, isActive])
  @@index([classId])
  @@index([studentId])
  @@map("fee_plan_assignments")
}

// A bill = "Rs X due from student S for period P (a head bundle)".
model FeeBill {
  id              String   @id @default(cuid())
  schoolId        String
  billNumber      String   // BL-FYNAME-NNNN
  studentId       String
  feePlanId       String?
  assignmentId    String?
  /** BS period this bill represents. For MONTHLY: "2082-05". For ANNUAL/EVENT/ONE_TIME: same as issueDateBS. */
  periodBS        String
  issueDateBS     String
  issueDateAD     DateTime
  dueDateBS       String
  dueDateAD       DateTime
  totalAmount     Decimal  @db.Decimal(14, 2)
  paidAmount      Decimal  @default(0) @db.Decimal(14, 2)
  status          String   @default("UNPAID") // UNPAID | PARTIAL | PAID | CANCELLED
  /** Counters / debug. */
  generatedById   String?
  cancelledAt     DateTime?
  cancelledReason String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  school     School             @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  student    Student            @relation(fields: [studentId], references: [id], onDelete: Restrict)
  feePlan    FeePlan?           @relation(fields: [feePlanId], references: [id], onDelete: SetNull)
  assignment FeePlanAssignment? @relation(fields: [assignmentId], references: [id], onDelete: SetNull)
  lines      FeeBillLine[]
  allocations FeePaymentAllocation[]

  @@unique([schoolId, billNumber])
  @@unique([assignmentId, studentId, periodBS])  // idempotency — one bill per (assignment, student, period)
  @@index([schoolId, status])
  @@index([studentId, status])
  @@index([dueDateAD])
  @@map("fee_bills")
}

model FeeBillLine {
  id           String  @id @default(cuid())
  feeBillId    String
  feeAccountId String
  amount       Decimal @db.Decimal(14, 2)
  label        String  // snapshot of fee head name at time of bill
  lineNo       Int

  feeBill    FeeBill @relation(fields: [feeBillId], references: [id], onDelete: Cascade)
  feeAccount Account @relation("FeeBillLineAccount", fields: [feeAccountId], references: [id], onDelete: Restrict)

  @@index([feeBillId])
  @@map("fee_bill_lines")
}

// Many-to-many between a payment and the bills it settles.
model FeePaymentAllocation {
  id           String  @id @default(cuid())
  feePaymentId String
  feeBillId    String
  amount       Decimal @db.Decimal(14, 2)
  createdAt    DateTime @default(now())

  feePayment FeePayment @relation(fields: [feePaymentId], references: [id], onDelete: Cascade)
  feeBill    FeeBill    @relation(fields: [feeBillId],    references: [id], onDelete: Restrict)

  @@unique([feePaymentId, feeBillId])
  @@index([feeBillId])
  @@map("fee_payment_allocations")
}
```

Required relation additions on **existing** models:

- `Account` → add `feePlanItems FeePlanItem[] @relation("FeePlanItemAccount")` and `feeBillLines FeeBillLine[] @relation("FeeBillLineAccount")`.
- `School` → add `feePlans FeePlan[]`, `feePlanAssignments FeePlanAssignment[]`, `feeBills FeeBill[]`.
- `Class` → add `feePlanAssignments FeePlanAssignment[]`.
- `Section` → add `feePlanAssignments FeePlanAssignment[]`.
- `Student` → add `feePlanAssignments FeePlanAssignment[]`, `feeBills FeeBill[]`.
- `FeePayment` → add `allocations FeePaymentAllocation[]`.

**Migration risk:** All new tables; the new `@@unique([assignmentId, studentId, periodBS])` is only on a new table so cannot conflict with existing data. Legacy `FeePayment` rows (no allocations) are tolerated — they read as "unallocated income". The dashboard / history can treat them as past payments without an associated bill.

### Permissions

In `src/lib/permissions.ts`, add to `SYSTEM_PERMISSIONS`:

```ts
{ code: "finance:billing",      label: "Manage Billing", description: "Create plans, assign to students, generate and adjust bills." }
{ code: "finance:billing:view", label: "View Billing",   description: "View student ledgers, bills, and billing reports." }
```

`finance:manage` continues to gate cash-handling (`recordFeePayment`). `finance:billing` gates plan/assignment/bill mutations.

### Server actions (new — under `src/actions/billing/`)

Create the directory `src/actions/billing/`. Each file:

- `plans.ts` — `listFeePlans()`, `createFeePlan(input)`, `updateFeePlan(id, input)`, `togglePlanActive(id)`, `getFeePlanDetail(id)`.
- `assignments.ts` — `listAssignments(filters)`, `assignPlanToTarget({ feePlanId, classId?, sectionId?, studentIds?, startBS, endBS?, overrideAmount? })`, `endAssignment(id, endBS)`. The `assignPlanToTarget` action accepts an array of `studentIds` so the bulk UI can post the whole class in one call.
- `bills.ts` — `listBills(filters)`, `getBill(id)`, `generateBillsManual({ feePlanId?, classId?, sectionId?, studentId?, periodBS })` (manual single-period generation; the worker in Phase 2 calls the same logic), `cancelBill(id, reason)`.
- `ledger.ts` — `getStudentLedger(studentId)` — returns `{ outstanding: FeeBill[], paid: FeeBill[], totals: { billed, paid, balance } }`. This is the data behind `/finance/billing/students/[id]`.
- `allocations.ts` — `previewAllocation(studentId, amount)` returns the proposed FIFO allocation; `applyAllocation(feePaymentId, allocations[])` writes `FeePaymentAllocation` rows + updates `FeeBill.paidAmount` and `status`. (Phase 1 wires this inside `recordFeePayment`; this file exists for adjustments.)

### Action: rewrite `recordFeePayment` to settle bills

In `src/actions/accounting/fee-payments.ts`, after the existing transaction creates `FeePayment` and the `RV` voucher, **insert an allocation step inside the same transaction**:

1. Take an optional `allocations?: Array<{ feeBillId, amount }>` on the input. If absent, auto-compute FIFO against oldest `UNPAID|PARTIAL` bills for the student up to the payment total.
2. For each allocation, validate the bill is school-scoped, status ≠ CANCELLED, and `amount ≤ bill.totalAmount - bill.paidAmount`.
3. Create `FeePaymentAllocation` rows.
4. Update each affected `FeeBill.paidAmount` and recompute `status`: PAID if `paidAmount >= totalAmount`, PARTIAL if `0 < paidAmount < totalAmount`, else UNPAID.
5. If the sum of allocations < payment.amount, leave the residual as "advance" — no error. Reports treat it as on-account credit.

The voucher already credits INCOME accounts on the per-line basis. Allocation is purely an AR-side bookkeeping layer; no extra GL postings are needed in Phase 1.

### UI screens (file paths exact)

| Route | New file | What it does |
|---|---|---|
| `/finance/billing` | `src/app/[domain]/finance/billing/page.tsx` | Dashboard: total outstanding (Rs), overdue count, by-class summary table, recent bills. |
| `/finance/billing/plans` | `src/app/[domain]/finance/billing/plans/page.tsx` + `plans-client.tsx` | List of plans with a "+ New Plan" sheet. |
| `/finance/billing/plans/[id]` | `src/app/[domain]/finance/billing/plans/[id]/page.tsx` + `plan-editor-client.tsx` | Two tabs: **Items** (`AccountPicker` + amount rows) and **Assignments** (target class/section/individual + start/end BS + active toggle). |
| `/finance/billing/assign` | `src/app/[domain]/finance/billing/assign/page.tsx` + `assign-client.tsx` | **The "very less clicks" screen.** Plan picker → class/section/individual picker (with checkboxes; "All in class X" defaults to checked) → "Apply to N students" button. |
| `/finance/billing/bills` | `src/app/[domain]/finance/billing/bills/page.tsx` + `bills-client.tsx` | Bill list with filters (status, class, period, plan). Each row: student, plan, period, due, status badge, paid/total bar, "Print" + "Collect" links. |
| `/finance/billing/students/[id]` | `src/app/[domain]/finance/billing/students/[id]/page.tsx` + `ledger-client.tsx` | Student ledger: outstanding bills card, paid bills accordion, payment history, inline "Collect" CTA that deep-links to `/finance/collect?studentId=...`. |
| `/finance/billing/generate` | `src/app/[domain]/finance/billing/generate/page.tsx` + `generate-client.tsx` | Manual generation: pick plan(s) + period (BS month picker) → preview list of students who will get bills → "Generate N bills" button. |

Update **`/finance/collect`** (`collect-client.tsx`):

- When `student` is picked, call `getStudentLedger(student.id)` and show a **"Outstanding bills (Rs Y)"** card above the existing line-item table.
- Add an "Auto-allocate" toggle (default: ON). When ON, the line-item table is suppressed; instead a compact list of outstanding bills shows with checkboxes pre-checked oldest-first to cover the total amount entered (a single global amount field).
- When OFF, the existing free-form line UI stays — that mode is for "advance payment / pre-payment / unallocated income".
- Submit calls `recordFeePayment` with the new `allocations` parameter.

### UI design call-outs — invoke `/ui-ux-pro-max`

When picking up each screen in implementation, **invoke `/ui-ux-pro-max`** with this brief per screen:

> "Design a [screen name] for a Nepal-market K-12 school admin. Stack: Next.js 15 + shadcn/ui + Tailwind v4. Reuse existing components: `AccountPicker`, `NepaliDateInput`, glass-card pattern (`bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40`). Tone: data-dense but breathable, emerald/sky accents, mono numerals (tabular-nums), small uppercase metadata labels (`text-[10px] uppercase tracking-widest font-bold text-slate-400`). Constraint: [the click target for this screen]. Inputs: [list of data the screen receives]. Outputs: [list of actions a user takes]."

Priority screens for `/ui-ux-pro-max`:

1. **`/finance/billing/assign`** — Click target ≤ 3. Layout idea: 3-column wizard (Plan • Targets • Confirm) with live preview pane "You're about to bill 42 students Rs 8,400/each starting Baisakh 2082." Big primary CTA.
2. **`/finance/billing/students/[id]`** — Click target = 1 to collect. Hero summary card with circular progress (paid vs billed), then outstanding bills table with status pills.
3. **`/finance/collect`** (the auto-allocate refresh) — Show outstanding bills inline; default to one-click submit.
4. **`/finance/billing`** — Dashboard. KPI cards + "Generate this month's bills" prominent CTA (red dot if not yet generated for current BS month).

### Verification (Phase 1 done when)

- [ ] `npx prisma db push` succeeds with all new models.
- [ ] `npx tsc --noEmit` clean.
- [ ] Create a plan with 3 items (Tuition Rs 5000, Transport Rs 1500, Library Rs 200), assign to Class 5 (10 students), generate Baisakh bills → 10 `FeeBill` rows created idempotently (re-running same generation does NOT create duplicates — UNIQUE on `[assignmentId, studentId, periodBS]` enforces it).
- [ ] Student ledger for one of those students shows `outstanding: 6700`.
- [ ] Submit a payment of Rs 4000 via `/finance/collect` with auto-allocate ON → first bill becomes PAID (5000... wait, this would PARTIAL the first bill at 4000/5000). Confirm `FeePaymentAllocation` row exists; `FeeBill.paidAmount = 4000`; `status = PARTIAL`.
- [ ] Submit second payment Rs 3000 → first bill PAID (1000 more), second bill PARTIAL (2000/1500 = exceeds, so 1500 paid in PAID + 500 leftover to next... actually the logic is FIFO sequential).
- [ ] Receipt print still works for legacy single-head FeePayment rows (no allocations).
- [ ] `/accounting/vouchers` still shows fee-collection RV vouchers with correct double-entry (debit cash/bank, credit income heads).

### Anti-pattern guards (Phase 1)

- Do NOT add a new `Receivable` account or post a JV at bill-generation time. Phase 1 keeps GL impact at the point of collection only (matches current behavior, simplifies migration).
- Do NOT remove the manual line-item path in `/finance/collect`. It stays as the "advance / unallocated" path.
- Do NOT modify `FeeStructure` or `FeePayment.feeAccountId`. They are legacy surface.

---

## Phase 2 — Automation

**Goal:** Recurring bills generate themselves. Payments auto-allocate without the admin even toggling. Late fees self-post.

### Schema additions

```prisma
// Audit trail for every bill-generation run.
model BillGenerationRun {
  id           String   @id @default(cuid())
  schoolId     String
  fiscalYearId String
  feePlanId    String?  // null = "all active plans"
  periodBS     String
  trigger      String   // CRON | MANUAL | API
  billsCreated Int
  startedAt    DateTime @default(now())
  completedAt  DateTime?
  errorText    String?
  runById      String?  // null = system/cron

  school     School     @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  fiscalYear FiscalYear @relation(fields: [fiscalYearId], references: [id], onDelete: Restrict)
  feePlan    FeePlan?   @relation(fields: [feePlanId], references: [id], onDelete: SetNull)

  @@index([schoolId, periodBS])
  @@map("bill_generation_runs")
}

// Late-fee policy attached to a plan.
model LateFeePolicy {
  id              String  @id @default(cuid())
  feePlanId       String  @unique
  type            String  // PERCENT | FIXED
  amount          Decimal @db.Decimal(14, 2)  // percent (0-100) OR fixed Rs
  graceDays       Int     @default(7)
  /** Cap: never charge more than this in total late fee per bill. null = no cap. */
  maxAmount       Decimal? @db.Decimal(14, 2)
  /** INCOME account credited when late fee posts. */
  feeAccountId    String

  feePlan    FeePlan @relation(fields: [feePlanId], references: [id], onDelete: Cascade)
  feeAccount Account @relation("LateFeeAccount", fields: [feeAccountId], references: [id], onDelete: Restrict)

  @@map("late_fee_policies")
}
```

### Server actions

- `generateBillsForPeriod({ periodBS, schoolId })` — idempotent. Iterates active `FeePlanAssignment` rows whose `frequency` matches the period (MONTHLY: any month; ANNUAL: first month of FY; ONE_TIME/EVENT: skip), and creates bills for every student in scope. Wrapped in `BillGenerationRun`.
- `applyLateFeesForDate({ asOfBS, schoolId })` — for every bill with `dueDateAD < toAD(asOfBS) - graceDays` and `status in (UNPAID, PARTIAL)`, post a separate `LATE_FEE` bill (one-time, on its own plan with `frequency = ONE_TIME`). Idempotent: if a late-fee bill already exists for `[originalBillId, periodBS]`, skip.
- `autoAllocateOnPaymentSave` — already wired in Phase 1 as the default mode. Phase 2 makes "auto" the only mode for the simple collect flow (the manual-line path still exists for advance payments via an "Advanced" toggle).

### Scheduling (CronCreate)

Schedule a daily job via the `CronCreate` skill (a routine):

- **Daily 02:00 BS-school-local-time** → run `applyLateFeesForDate({ asOfBS: todayBS() })` per school.
- **BS month-rollover (1st of every BS month, 03:00)** → run `generateBillsForPeriod({ periodBS: currentBSMonth() })` per school.

Cron jobs are out-of-process; they call a thin HTTP endpoint or server-action wrapper that loops `prisma.school.findMany({ where: { /* active */ } })` and invokes the per-school action.

**Risk:** Multi-school cron scoping. Per-school cron config in `School` model (add `autoBillEnabled Boolean @default(true)`).

### UI screens

| Route | New file | What it does |
|---|---|---|
| `/finance/billing/runs` | `src/app/[domain]/finance/billing/runs/page.tsx` | Audit log of generation runs. Filter by period / plan. Re-run button. |
| `/finance/billing/plans/[id]` (extend) | (existing) | Add a "Late Fee Policy" tab. |
| `/finance/billing` (extend) | (existing) | Add KPI: "Auto-generated this month: X bills, Rs Y" + green pulse when last run was successful. |

### UI design call-out

Invoke `/ui-ux-pro-max` for `/finance/billing/runs` — an audit log table with status pills (success/partial/failed), expandable per-run row showing how many bills per class. Reuse the day-book table aesthetic from `/accounting/day-book` for consistency.

### Verification (Phase 2 done when)

- [ ] Set system clock to "1st Baisakh 2083", trigger cron manually → monthly bills generated for all active assignments.
- [ ] Run twice in a row → second run records `billsCreated: 0` (idempotent).
- [ ] Set a bill `dueDateBS` to 30 days ago, run `applyLateFeesForDate` → a new LATE_FEE bill is created on the same student. Run again → no duplicate.
- [ ] `/finance/collect` no longer requires the auto-allocate toggle; auto-allocation is the path; "Advanced (advance payment)" is hidden behind a disclosure.

---

## Phase 3 — Reports, Discounts, Polish

**Goal:** Decision-grade reports, per-student scholarships, exports, prints.

### Schema additions

```prisma
// Scholarship / per-student discount profile.
model StudentScholarship {
  id          String   @id @default(cuid())
  studentId   String   @unique
  schoolId    String
  /** Percent applied to every bill auto-generated for this student. 0-100. */
  percentOff  Decimal  @db.Decimal(5, 2)
  reason      String?  // "Topper", "Sibling", "Staff child"
  validFromBS String
  validToBS   String?
  createdAt   DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  school  School  @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@map("student_scholarships")
}

// Optional per-line discount on a bill (manual one-off).
// Extends FeeBillLine — add column `discountAmount Decimal @default(0) @db.Decimal(14, 2)` and recompute totals.
```

When a bill generates, if the student has an active scholarship, apply `percentOff` to each line's `amount` and reduce `totalAmount` accordingly. Store the discount on `FeeBillLine.discountAmount` so the audit trail shows "list - discount = net".

### Server actions

- `getBillingAging({ asOfBS, classId? })` — returns `[{ studentId, name, className, bucket0_30, bucket30_60, bucket60_90, bucket90plus, total }]`. Sorted by total desc.
- `getCollectionEfficiency({ fyId })` — per class per BS month: `{ billed, collected, collectionPct }`.
- `exportBillingReport(type, params)` — generates xlsx via SheetJS (per project convention, see Memory: `project_excel_import_export.md`).
- `printBill(id)` — server-rendered HTML at `/finance/billing/bills/[id]/print`.

### UI screens

| Route | New file | What it does |
|---|---|---|
| `/finance/billing/aging` | `aging/page.tsx` + `aging-client.tsx` | Heatmap table: rows = students, cols = buckets, color intensity by amount. Class filter. Export button. |
| `/finance/billing/efficiency` | `efficiency/page.tsx` | Line chart (Recharts) — billed vs collected per BS month. Class drill-down. |
| `/finance/billing/bills/[id]/print` | `bills/[id]/print/page.tsx` + `bill-print.tsx` | A5 landscape, same skin as `/finance/receipts/[id]/print`. |
| `/finance/billing/scholarships` | `scholarships/page.tsx` | List + create scholarships. |

### UI design call-out

Invoke `/ui-ux-pro-max` for:

- **Aging heatmap** — emerald-to-rose gradient by amount. Sticky student column. Bucket totals in tfoot.
- **Efficiency dashboard** — Recharts line+bar combo. KPI strip on top.
- **Bill print** — A5 landscape, parallels `receipt-print.tsx`, but lists "AMOUNT DUE" (vs "RECEIVED"). Bilingual Nepali/English option (see project supports it).

### Verification (Phase 3 done when)

- [ ] Apply a 20% scholarship to a student, generate next month's bills → that student's bill has `discountAmount` on each line; `totalAmount = sum(amount - discountAmount)`.
- [ ] Aging report renders 4 buckets, totals tie out against `sum(FeeBill.totalAmount - paidAmount where status in (UNPAID, PARTIAL))`.
- [ ] Excel export opens cleanly in LibreOffice / Excel.

---

## Minimum-click workflow walkthroughs

(Counted from "admin lands on /finance/billing" unless noted.)

### Set up monthly tuition for Class 5 — 4 clicks
1. **Click 1** — "Plans" tab → "+ New Plan" sheet opens.
2. Type "Class 5 Monthly Tuition", pick frequency=MONTHLY, add line items via `AccountPicker` (Tuition Rs 5000, Transport Rs 1500). **Click 2** — Save.
3. Land on plan detail → "Assignments" tab → "Assign to class" inline form. **Click 3** — pick "Class 5" in class dropdown.
4. **Click 4** — "Apply to all 42 students" CTA. Done. Bills will auto-generate every BS month-start.

### Bulk-assign annual function fee to whole school — 3 clicks
1. `/finance/billing/assign` (dedicated screen) — preselected "+ Create EVENT plan" inline. Type name, amount.
2. **Click 1** — Plan saved. Stay on same screen.
3. **Click 2** — Target = "All students" radio.
4. **Click 3** — "Apply to 487 students" → bills appear on every student's ledger immediately.

### Collect fee with auto-allocate — 2 clicks
1. `/finance/collect` (or deep-link from student ledger).
2. Type student name in search → pick suggestion. **Click 1** — Student selected; outstanding bills card auto-fills; total amount auto-populates to sum of all outstanding (admin can edit down).
3. Pick payment method (CASH default). **Click 2** — "Record & Print Receipt". Bills settled FIFO behind the scenes.

### Mark a one-time uniform purchase — 3 clicks
1. From a student ledger → "Add one-time bill" button.
2. **Click 1** — opens sheet with `AccountPicker` for fee head + amount field.
3. **Click 2** — Save → bill appears in their outstanding.
4. **Click 3** — Either "Collect now" inline (preselects this bill in /finance/collect) or close.

### Set up a Tour for Class 6 students who opted in — 4 clicks
1. `/finance/billing/assign`.
2. **Click 1** — "+ Create EVENT plan" → name "Pokhara Tour 2082", amount Rs 4500.
3. **Click 2** — Class = "Class 6".
4. **Click 3** — Toggle off the 5 students who aren't going (default = all checked).
5. **Click 4** — "Apply to 37 students."

---

## Critical files — Phase 1 inventory

### New files

```
src/actions/billing/plans.ts
src/actions/billing/assignments.ts
src/actions/billing/bills.ts
src/actions/billing/ledger.ts
src/actions/billing/allocations.ts
src/app/[domain]/finance/billing/page.tsx
src/app/[domain]/finance/billing/plans/page.tsx
src/app/[domain]/finance/billing/plans/plans-client.tsx
src/app/[domain]/finance/billing/plans/[id]/page.tsx
src/app/[domain]/finance/billing/plans/[id]/plan-editor-client.tsx
src/app/[domain]/finance/billing/assign/page.tsx
src/app/[domain]/finance/billing/assign/assign-client.tsx
src/app/[domain]/finance/billing/bills/page.tsx
src/app/[domain]/finance/billing/bills/bills-client.tsx
src/app/[domain]/finance/billing/students/[id]/page.tsx
src/app/[domain]/finance/billing/students/[id]/ledger-client.tsx
src/app/[domain]/finance/billing/generate/page.tsx
src/app/[domain]/finance/billing/generate/generate-client.tsx
```

### Files to edit

```
prisma/schema.prisma                                      (new models + relation back-refs on School/Account/Student/Class/Section/FeePayment)
src/lib/permissions.ts                                    (add finance:billing, finance:billing:view)
src/lib/nepali-date.ts                                    (add nextBSMonthStart, bsMonthEnd helpers)
src/actions/accounting/fee-payments.ts                    (accept allocations[], settle bills inside tx)
src/app/[domain]/finance/collect/collect-client.tsx       (outstanding-bills card + auto-allocate toggle)
src/app/[domain]/finance/finance-nav.tsx                  (add Billing tab/group)
```

### Run after schema edits

```
npm run db:push          # apply new tables
npx prisma generate      # regenerate client
npx tsc --noEmit         # confirm types
```

---

## Risks & migration concerns

| Risk | Likelihood | Mitigation |
|---|---|---|
| Legacy `FeePayment` rows have no allocations → reports double-count income vs allocations | Med | Define "Billed" = sum of `FeeBill.totalAmount`; "Collected" = sum of `FeePaymentAllocation.amount`; "Unallocated" = sum of legacy payments with no allocations. Show all three on dashboard. |
| Duplicate bill generation | High if not guarded | The `@@unique([assignmentId, studentId, periodBS])` constraint enforces single-write. `generateBillsForPeriod` uses `createMany({ skipDuplicates: true })`. |
| Concurrent payment + bill update race | Low | All allocation updates are inside the same `recordFeePayment` transaction; row-level locking via Postgres `SELECT ... FOR UPDATE` if scaling demands it (defer to Phase 3 if observed). |
| Cron firing on closed FY | Low | `generateBillsForPeriod` calls `resolveFiscalYearForDate` and bails if `status != OPEN`. |
| Late-fee policy posts during grace days | — | `dueDateAD + graceDays` is the trigger date, not `dueDateAD` itself. |
| FY rollover: bills span FYs | Low | Bills are always anchored in the FY of their `issueDateBS`. Generation never spans an FY. End-of-FY closing job (already exists at `/accounting/year-end`) does not touch bills — they continue to be UNPAID until paid or cancelled. |
| Schema bloat | Med | All new models grouped under `// --- Fee Billing ---` divider in `schema.prisma` for navigability. |
| Auto-allocate FIFO is "wrong" for parents who want to pay for a specific bill | Med | "Auto-allocate" toggle in `/finance/collect` lets the admin disable it and pick which bills to settle. |
| User-side memory `project_excel_import_export.md` says every module needs xlsx import/export | High | Phase 3 includes export. Phase 1 ships **without** xlsx import for plans/assignments — note this as a Phase 3+ follow-up. |

---

## Out of scope (intentionally)

- Parent-facing online payment portal (Khalti / eSewa integration).
- SMS / email reminders on overdue bills.
- Multi-currency.
- Sibling-discount auto-detect (Phase 3 handles it manually via `StudentScholarship`).
- Refunds (would need a `FeeRefund` model + JV posting; design later).
- Bill modification after partial payment (Phase 1 only allows CANCEL of unpaid bills; partial-paid bills are immutable).

---

## When to next call `/ui-ux-pro-max`

Each implementation phase has at least one UI-heavy screen. Before writing the JSX, hand the screen brief to `/ui-ux-pro-max` (it returns refined component composition, color/typography choices, and concrete shadcn snippets). The phase tables above list which screens.

---

## End-of-plan checklist

When this plan is fully executed:

- [ ] Phase 1, 2, 3 verification checklists all green.
- [ ] No regressions on `/finance/collect`, `/finance/history`, `/finance/receipts/[id]/print`, `/accounting/vouchers`, `/accounting/reports/trial-balance` (the existing surfaces).
- [ ] `Fee_Billing_Plan.md` updated with any in-flight deviations.
- [ ] Memory updated (`project_fee_billing.md`) describing the final shipped surface.

