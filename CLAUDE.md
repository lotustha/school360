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

- **PLANNED**: scheduled by a FeePlan but not yet invoiced. No GL impact. Visible to the Collect Fee page — paying against it auto-promotes (see below).
- **BILLED**: a `BL` Voucher has been posted (DR `Student Fee Receivable` 1130 / CR Income head). Row has a `billVoucherNumber` and `billVoucherId`.
- **PARTIAL** / **PAID**: payments have been applied via `FeePaymentAllocation` rows. `paidAmount` is incremented; status auto-recomputed.
- **CANCELLED**: `cancelStudentFee` (only when no money paid) or `writeOffStudentFee` (forgive unpaid balance — reason prefixed `WRITTEN_OFF:`).

#### Voucher posting (accrual mode)

| Event | Voucher type | GL lines |
|---|---|---|
| Bill issuance (manual via `/finance/classes/[id]` "Bill Period", or auto during payment) | `BL` | DR `Student Fee Receivable` (1130) / CR Income head |
| Receipt collected against a bill | `RV` | DR Cash or Bank / CR `Student Fee Receivable` (1130) |
| Receipt with ad-hoc line (no bill behind it) | `RV` | DR Cash or Bank / CR Income head directly (cash-basis recognition for that line) |

A single RV can credit AR (for allocations) AND Income (for ad-hoc lines) in one voucher.

The AR control account is seeded as code `1130` ("Student Fee Receivable", subType `RECEIVABLE`, `isControl: true`). Resolve at runtime via `resolveReceivableAccountId(tx, schoolId)` in `src/actions/billing/allocations.ts`.

#### Auto-bill during collection

When a payment is recorded against a PLANNED row, `applyAllocations(tx, …, accrualCtx)` will:

1. Mint a `BL-FYNAME-NNNN` voucher number (per-FY counter via `voucherCounter`)
2. Create a real BL `Voucher` row (DR AR / CR Income)
3. Stamp `billVoucherNumber` + `billVoucherId` on the StudentFee
4. Flip the row to BILLED, then apply the payment (→ PARTIAL or PAID)

All inside the same Postgres transaction that creates the RV voucher.

#### Voucher reversal cascade

`reverseVoucher(id, reason?)` posts an offsetting voucher (debits/credits swapped) and additionally:

- **RV reversal**: rolls back `StudentFee.paidAmount` per allocation, recomputes status, deletes `FeePaymentAllocation` rows. Keeps `FeePayment` + `FeePaymentLine` rows as voided audit records.
- **BL reversal**: only allowed when no payment is applied — row returns to PLANNED, `billVoucherNumber` / `billVoucherId` cleared. If payments exist, throws (must reverse the receipt first).
- **PV / CV / JV**: just the GL math is reversed.

#### Pre-accrual data (cutover)

This codebase started cash-basis; accrual went live on 2026-05-25. Old receipts pre-cutover credit Income directly (no AR involvement, no BL voucher). New receipts use the accrual pattern. Both coexist in the GL with no migration; reports filter by `Account.type` so they aggregate income correctly regardless of which path posted it. Trial Balance and Balance Sheet will only show meaningful AR balance after the cutover date.

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
