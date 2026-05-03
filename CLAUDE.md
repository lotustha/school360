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

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for subdomain detection (e.g. `localhost:3000` locally) |
| `NEXT_PUBLIC_APP_NAME` | App branding name |

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
