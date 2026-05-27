# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Push Prisma schema to database
npm run db:studio    # Open Prisma Studio GUI
```

No test suite is configured.

## Architecture Overview

School360 is a **multi-tenant SaaS ERP for K-12 schools in Nepal**. Each school (tenant) gets a unique subdomain and operates in isolation while sharing the same database and codebase.

### Routing Model

`src/middleware.ts` handles subdomain-based routing:
- `www.school360.com.np` → serves `src/app/(marketing)/` (public landing + onboarding wizard)
- `{slug}.school360.com.np` → rewrites to `src/app/[domain]/` (tenant dashboard)

The `domain` param flowing through `[domain]/` pages is the school's slug. All tenant pages resolve the school from this slug via Prisma.

### Authentication

NextAuth v4 with JWT strategy and a Credentials provider (`src/auth.ts`). Session includes `schoolId` and `schoolSlug` alongside standard fields. Login is per-tenant at `/{domain}/login`. Password verification tries bcryptjs first, then falls back to plaintext (legacy).

### Database & ORM

Prisma 7 with PostgreSQL via `@prisma/adapter-pg`. Schema is at `prisma/schema.prisma`. The `.env` currently has a MySQL URL — this needs a PostgreSQL connection string to work. Core multi-tenant anchor: the `School` model with a unique `slug`.

Key model relationships:
- `School` → `User`, `AcademicYear`, `Faculty`, `Class`, `Section`, `Subject`, `FeeStructure`, `Role`
- `SubjectComponent` → per-subject evaluation breakdown (INTERNAL / EXTERNAL / CAS types, full/pass marks)
- `Mark` → `obtainedMarks` + `breakdownMarks` (JSON) per student per component

### Permissions (RBAC)

Defined in `src/lib/permissions.ts`. 16 permission codes across 4 modules:
- `academic:*`, `gradebook:*` — academics
- `finance:*`, `payroll:*` — finance
- `student:*`, `employee:*`, `attendance:*` — HR
- `settings:*`, `rbac:manage` — admin

Roles are per-school. Users have a base role plus optional `UserPermission` grant/revoke overrides.

### Server Actions

All mutations use Next.js server actions (`"use server"`) in `src/actions/`. After mutations, actions call `revalidatePath()` to invalidate the relevant route cache. No API routes for CRUD — use server actions.

### UI Stack

shadcn/ui (Radix UI + Tailwind CSS v4) for all components — 40+ pre-built components in `src/components/ui/`. Class merging via `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Forms: React Hook Form + Zod. Charts: Recharts. Icons: Lucide React.

### Nepal-Specific Features

- Bikram Sambat date support via `nepali-date-converter`
- PAN validation (9-digit format)
- NEB-standard grading, CAS evaluation (Grades 1–8)
- SSF/TDS compliance for payroll

### Fee Billing & Accounting Flow

Two coupled modules: **Billing** (`src/actions/billing/`, UI at `/finance/*`) and **Accounting** (`src/actions/accounting/`, UI at `/accounting/*`). Billing is the customer-facing receivables layer; Accounting is the General Ledger underneath.

#### StudentFee lifecycle

A `StudentFee` row represents one fee owed by one student for one period.

```
PLANNED ──▶ BILLED ──▶ PARTIAL ──▶ PAID
                  │       │
                  └───────┴──▶ CANCELLED  (cancel or write-off)
```

- **PLANNED**: scheduled by a FeePlan but not yet issued to the parent. No GL impact. Visible to the Collect Fee page.
- **BILLED**: marked as issued to the parent via "Bill Period". **No GL impact** — billing is purely a billing-module marker (cash-basis; income is recognized only on payment). No voucher, no `billVoucher*` fields.
- **PARTIAL** / **PAID**: payments have been applied via `FeePaymentAllocation` rows. `paidAmount` is incremented; status auto-recomputed.
- **CANCELLED**: `cancelStudentFee` (only when no money paid) or `writeOffStudentFee` (forgive unpaid balance — reason prefixed `WRITTEN_OFF:`).

#### Income recognition (cash-basis)

Income is recognized **only when cash is received** — a receivable is never booked. Billing a period has no GL effect; it just flips PLANNED→BILLED so the fee surfaces as an issued, collectable charge. The per-class outstanding rollup lives on the **Classes landing page** (`/finance/classes`, aggregated in its `page.tsx`); `getStudentLedger` (`src/actions/billing/`) gives the per-student view. These are billing-module receivables views, **not** GL accounts.

`billed` / `outstanding` figures count **issued rows only** (BILLED + PARTIAL + PAID); PLANNED rows are reported in a separate "Planned" bucket and are never folded into billed or outstanding. (The standalone Bill Book page that previously held this rollup was removed 2026-05-26 and merged into `/finance/classes`.)

| Event | Voucher type | GL lines |
|---|---|---|
| Bill issuance (`/finance/classes/[id]` "Bill Period") | — (none) | No GL posting; row flips PLANNED→BILLED |
| Receipt collected (`recordFeePayment`) | `RV` | DR Cash or Bank / CR Income head (one credit per fee head, whether settling a bill or an ad-hoc charge) |

`applyAllocations(tx, schoolId, feePaymentId, allocations)` only updates `StudentFee.paidAmount` / status — it posts no GL. There is **no** AR control account: account `1130` and the `resolveReceivableAccountId` / `accrualCtx` / BL-voucher machinery were removed when the system moved to cash-basis on 2026-05-26. (`1140` Staff Advances still uses subType `RECEIVABLE`.)

#### Voucher reversal cascade

`reverseVoucher(id, reason?)` posts an offsetting voucher (debits/credits swapped) and additionally:

- **RV reversal**: rolls back `StudentFee.paidAmount` per allocation, recomputes status (full reversal → BILLED, partial → PARTIAL), deletes `FeePaymentAllocation` rows. Keeps `FeePayment` + `FeePaymentLine` rows as voided audit records.
- **PV / CV / JV**: just the GL math is reversed.

#### History note (accrual cutover)

Accrual was briefly live (2026-05-25). On 2026-05-26 the system moved to cash-basis: existing `BL` vouchers were deleted, the one accrual-era `RV` that credited AR was offset by an adjusting `JV` (DR 1130 / CR Income), and account 1130 was left dormant at a zero balance. Pre-accrual and post-cutover receipts both credit Income directly, so reports aggregate income correctly by `Account.type`.

#### Permissions

- `finance:view` — basic read (Collect page header)
- `finance:manage` — GL mutations (voucher posting, account CRUD)
- `finance:billing` — billing mutations (create plans, bill periods, edit fee heads)
- `finance:billing:view` — billing reads (history, audit log, plans/heads lists)

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for subdomain detection (e.g. `localhost:3000` locally) |
| `NEXT_PUBLIC_APP_NAME` | App branding name |

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
