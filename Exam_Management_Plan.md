# Exam Management — Phased Implementation Plan

Target: `/academics/exams/*` — terminal exam routine, seat plans, invigilator assignment, attendance, and printing. Each phase ships independently.

---

## Information Architecture (locked)

Rooms are a **school-wide facility**, not an exam concept. They live under Settings; Classes and Exams both consume them. No new top-level menu.

```
/settings/rooms                                      ← school-wide rooms registry (the one source of truth)
/settings/rooms/[roomId]                             ← seat-layout editor for one room

/academics/exams                                     ← index: list of terms
/academics/exams/[examId]                            ← per-exam dashboard (Overview tab)
/academics/exams/[examId]/routine                    ← DnD date matrix
/academics/exams/[examId]/routine/print              ← printable routine (?mode=faculty|class|combined)
/academics/exams/[examId]/seats/[scheduleId]         ← seat plan for one sitting (picks Rooms + density per room)
/academics/exams/[examId]/seats/[scheduleId]/print   ← printable map + roster
/academics/exams/[examId]/invigilators               ← assignment board (room + running, ?date=…)
/academics/exams/[examId]/attendance/[scheduleId]/[roomId]
```

### `ExamTabs` component (new — mirrors `RoutineTabs`)

`src/app/[domain]/academics/exams/[examId]/exam-tabs.tsx` — internal pill-strip nav at the top of every per-exam page. Items:

```
Overview · Routine · Seats · Invigilators · Attendance · Reports
```

Copy `src/app/[domain]/academics/routine/routine-tabs.tsx` pattern (segmented control with motion `layoutId`). Resolve active tab from `pathname` relative to `/academics/exams/[examId]/`.

### Class drawer link

`Class.classroom` (free text) is **deprecated**. The class drawer adds a Room dropdown sourced from `/settings/rooms`. Keep the old text field as a read-only fallback during the migration window — write null to it when a `roomId` is set.

### Index page changes (`/academics/exams/page.tsx`)

Today it's a list of terms. After Phase 1:
- Same list. Each row links to `/academics/exams/[examId]` (the new per-exam Overview).
- A small "Rooms" link in the header points to `/settings/rooms` for convenience.

---

## Phase 0 — Documentation discovery (allowed APIs in this repo)

This list is the contract for every later phase. Copy these patterns; don't invent.

### Reusable building blocks (already in repo)

| Capability | Use this | Notes |
|---|---|---|
| BS + AD date input | `src/components/ui/nepali-date-input.tsx` → `<NepaliDateInput value onChange minYear maxYear />` | Returns BS string `"YYYY-MM-DD"`. Internal converter handles AD. |
| Multi-tenant + filter URL bar | `src/components/ui/global-filters-bar.tsx` → `<GlobalFiltersBar show=["facultyId","classId","academicYearId"] />` | Reads/writes `?facultyId=…&classId=…&academicYearId=…`. Renders chips in `show` array order. |
| DataTable (TanStack) + DnD reorder + multi-sort + visibility | `src/components/ui/data-table.tsx` → pass `storageKey="exam-…"` to enable opt-in features. |
| Drag-and-drop primitives | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — see `src/app/[domain]/students/students-table.tsx` for `useSortable + SortableContext + DndContext` pattern. |
| Sheet drawer (right-side) | `src/components/ui/sheet.tsx` → `<Sheet><SheetTrigger/><SheetContent>…</SheetContent></Sheet>` — see `src/app/[domain]/academics/faculties/faculty-drawer.tsx`. |
| Avatar | `src/components/ui/avatar-img.tsx` → `<Avatar name url size />`. |
| Working-day helpers | `src/lib/working-days.ts` → `effectiveWorkingDays`, `DAY_LABELS_SHORT`, `dayDisplayNumber`. |
| Natural class sort | `src/lib/class-sort.ts` → `sortClassesByFacultyThenName(rows)`. |
| Class label | `src/lib/class-label.ts` → `formatClassLabel({name, facultyName}, {hideFaculty})`. |
| Routine print pattern | `src/app/[domain]/academics/routine/print/page.tsx` + `print-view.tsx` — landscape A4, auto-`window.print()` on mount, no-print toolbar, school header. Copy the `@page { size: A4 landscape }` + `@media print` block verbatim. |
| Session badge | `src/components/ui/session-badge.tsx` — small "Year + Current" pill for scope-locked pages. |
| Liquid-glass card class | `bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm` — used everywhere. |
| Color tokens (existing convention) | Amber=sessions, Violet=faculty, Emerald=academic/class, Sky=section/attendance, Rose=delete/error, Slate=neutral. |

### Existing exam surface

| File | Lines | What it does |
|---|---|---|
| `prisma/schema.prisma:341-378` | — | `Exam` (name, academicYearId, schoolId) + `TerminalExamScore` only. |
| `src/actions/exams.ts` | 46 | CRUD on `Exam`. |
| `src/app/[domain]/academics/exams/page.tsx` | 43 | Server page → `ExamsClient`. |
| `src/app/[domain]/academics/exams/exams-client.tsx` | 220 | Exam list + add/edit/delete drawer. |
| `src/actions/terminal-marks.ts` | 132 | Mark entry (independent of routine — don't touch). |

### Hard rules (don't violate)

1. **Multi-tenant**: every new query MUST include `schoolId` in `where`.
2. **`"use server"`** files may only export async functions and TypeScript types.
3. **Don't break `TerminalExamScore`**: it currently keys on `(examId, studentId, subjectId)`. Future evolution to `ExamPaper` is opt-in via a nullable `paperId` column added later, not by replacing this table.
4. URL is the source of truth for filter state on all list pages.
5. **No emojis as UI** — Lucide icons only.

---

## Phase 1 — Schema additions (one Prisma migration)

**Goal**: Land all new tables in one migration so future phases just write to them.

### New models (`prisma/schema.prisma`)

```prisma
// One paper per (Exam × Subject) — shared across multiple classes when needed.
model ExamPaper {
  id          String   @id @default(cuid())
  schoolId    String
  examId      String          // Term 1, Term 2, Final
  subjectName String          // Display name (Math, English) — kept denorm for cross-class papers
  code        String?         // optional short code (used on the print)
  fullMarks   Float?
  passMarks   Float?
  durationMin Int             // 90, 120, 180
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  school    School           @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  exam      Exam             @relation(fields: [examId],   references: [id], onDelete: Cascade)
  targets   ExamPaperTarget[]      // which (class, subject) rows this paper serves
  schedules ExamSchedule[]         // when this paper is sat
  seats     ExamSeat[]
  attendances ExamRoomAttendance[]

  @@index([schoolId, examId])
  @@map("exam_papers")
}

// Many-to-one: one paper → many (class, subject) targets — supports combined-class exams.
model ExamPaperTarget {
  id        String @id @default(cuid())
  paperId   String
  classId   String
  subjectId String          // points at the per-class Subject row

  paper   ExamPaper @relation(fields: [paperId],   references: [id], onDelete: Cascade)
  class   Class     @relation(fields: [classId],   references: [id], onDelete: Cascade)
  subject Subject   @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@unique([paperId, classId, subjectId])
  @@index([classId])
  @@map("exam_paper_targets")
}

// When this paper is sat. Typically 1 row per paper but allowing >1 for
// makeup sittings without schema change.
model ExamSchedule {
  id          String   @id @default(cuid())
  paperId     String
  dateBS      String   // "2082-04-12"
  dateAD      DateTime
  startTime   String   // "08:00"
  durationMin Int?     // override paper.durationMin if set
  roomHint    String?  // optional free-text (replaced by room assignment in Phase 4)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  paper       ExamPaper            @relation(fields: [paperId], references: [id], onDelete: Cascade)
  invigilators ExamRoomInvigilator[]
  runningInvigilators ExamRunningInvigilator[]

  @@index([paperId, dateAD])
  @@map("exam_schedules")
}

// ─── Rooms (school-wide facility, used by Classes AND Exams) ──────────────

model Room {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "Hall A", "Room 102"
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  school              School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  seats               RoomSeat[]
  classes             Class[]                              // 1-N: classes whose home room is this
  examScheduleRooms   ExamScheduleRoom[]
  examSeats           ExamSeat[]
  examAttendances     ExamRoomAttendance[]
  invigilatorAssignments ExamRoomInvigilator[]

  @@unique([schoolId, name])
  @@index([schoolId])
  @@map("rooms")
}

// One physical chair. Variable per row — row 1 can be 4 wide, row 2 can be 2 wide.
model RoomSeat {
  id     String @id @default(cuid())
  roomId String
  row    Int            // 1-indexed
  col    Int            // 1-indexed within the row
  kind   String @default("SEAT")   // "SEAT" | "AISLE" | "TEACHER_DESK" — only "SEAT" is seatable
  label  String?                   // optional ("A3", "Bench 2 R")

  room      Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  examSeats ExamSeat[]

  @@unique([roomId, row, col])
  @@index([roomId])
  @@map("room_seats")
}

// ─── Exam → Room link (which rooms host this sitting + at what density) ───

model ExamScheduleRoom {
  id         String @id @default(cuid())
  scheduleId String
  roomId     String
  density    String @default("FULL")   // "FULL" | "HALF" | "ALTERNATING"
  notes      String?

  schedule ExamSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  room     Room         @relation(fields: [roomId],     references: [id], onDelete: Cascade)

  @@unique([scheduleId, roomId])
  @@index([scheduleId])
  @@map("exam_schedule_rooms")
}

// One seat assignment per (sitting × student) → points at a specific physical RoomSeat.
model ExamSeat {
  id         String @id @default(cuid())
  paperId    String
  scheduleId String
  roomId     String
  roomSeatId String
  studentId  String
  createdAt  DateTime @default(now())

  paper    ExamPaper    @relation(fields: [paperId],    references: [id], onDelete: Cascade)
  schedule ExamSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  room     Room         @relation(fields: [roomId],     references: [id], onDelete: Cascade)
  roomSeat RoomSeat     @relation(fields: [roomSeatId], references: [id], onDelete: Cascade)
  student  Student      @relation(fields: [studentId],  references: [id], onDelete: Cascade)

  @@unique([scheduleId, roomSeatId])     // a physical chair holds one student per sitting
  @@unique([scheduleId, studentId])      // a student sits only once per sitting
  @@index([scheduleId, roomId])
  @@map("exam_seats")
}

model ExamRoomInvigilator {
  id          String @id @default(cuid())
  scheduleId  String
  roomId      String
  teacherId   String          // User.id where role = TEACHER
  isPrimary   Boolean @default(false)
  createdAt   DateTime @default(now())

  schedule ExamSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  room     Room         @relation(fields: [roomId],     references: [id], onDelete: Cascade)
  teacher  User         @relation("InvigilatorTeacher", fields: [teacherId], references: [id])

  @@unique([scheduleId, roomId, teacherId])
  @@index([teacherId, scheduleId])
  @@map("exam_room_invigilators")
}

model ExamRunningInvigilator {
  id         String @id @default(cuid())
  scheduleId String
  teacherId  String
  createdAt  DateTime @default(now())

  schedule ExamSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  teacher  User         @relation("RunningInvigilatorTeacher", fields: [teacherId], references: [id])

  @@unique([scheduleId, teacherId])
  @@map("exam_running_invigilators")
}

model ExamHoliday {
  id       String @id @default(cuid())
  schoolId String
  examId   String          // scoped to a term — different terms can have different blocked dates
  dateBS   String
  dateAD   DateTime
  reason   String?

  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  exam   Exam   @relation(fields: [examId],   references: [id], onDelete: Cascade)

  @@unique([examId, dateBS])
  @@map("exam_holidays")
}

model ExamRoomAttendance {
  id         String   @id @default(cuid())
  scheduleId String
  paperId    String
  roomId     String
  studentId  String
  status     String   @default("PRESENT") // PRESENT | ABSENT | LATE | DEBARRED
  note       String?
  markedById String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  schedule ExamSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  paper    ExamPaper    @relation(fields: [paperId],    references: [id], onDelete: Cascade)
  room     Room         @relation(fields: [roomId],     references: [id], onDelete: Cascade)
  student  Student      @relation(fields: [studentId],  references: [id], onDelete: Cascade)
  markedBy User         @relation("ExamAttendanceMarker", fields: [markedById], references: [id])

  @@unique([scheduleId, studentId])
  @@index([scheduleId, roomId])
  @@map("exam_room_attendances")
}
```

### Required additions to existing models

- `Exam` → add `papers ExamPaper[]`, `holidays ExamHoliday[]`
- `Class` → add `examPaperTargets ExamPaperTarget[]`, **`roomId String?`** + **`room Room? @relation(fields: [roomId], references: [id])`** (replaces the existing free-text `classroom` field — keep `classroom` for one release as a fallback then drop)
- `Subject` → add `examPaperTargets ExamPaperTarget[]`
- `Student` → add `examSeats ExamSeat[]`, `examAttendances ExamRoomAttendance[]`
- `User` → add `invigilatorAssignments ExamRoomInvigilator[] @relation("InvigilatorTeacher")`, `runningInvigilatorAssignments ExamRunningInvigilator[] @relation("RunningInvigilatorTeacher")`, `examAttendancesMarked ExamRoomAttendance[] @relation("ExamAttendanceMarker")`
- `School` → add `rooms Room[]`, `examHolidays ExamHoliday[]`

### Migration verification

```bash
npm run db:push       # local Postgres (per memory: project uses local PG 18)
npx tsc --noEmit
```

**Skip if**: this phase is required — no later phase compiles without it.

---

## Phase 2 — Exam routine matrix (DnD date assignment)

**Goal**: For one selected Exam (Term), let the user assemble papers and pin each to a date + start time.

### Route

`src/app/[domain]/academics/exams/[examId]/routine/page.tsx`

URL: `?facultyId=…&classId=…&academicYearId=…` (scope filter, doesn't change data — just narrows what shows).

### Server actions (`src/actions/exams.ts` — extend, don't replace existing)

```ts
export async function listExamPapers(schoolId, examId, scope?: { facultyIds?, classIds? }): Promise<PaperRow[]>
export async function createExamPaper(input: { schoolId, examId, subjectName, code?, fullMarks?, passMarks?, durationMin })
export async function updateExamPaper(id, patch)
export async function deleteExamPaper(id)

export async function attachPaperTargets(paperId, targets: { classId, subjectId }[])  // replace-all
export async function detachPaperTarget(targetId)

export async function setSchedule(input: { paperId, dateBS, startTime, durationMin? })  // upserts the single sitting
export async function clearSchedule(scheduleId)

export async function autoSpreadDates(input: {
  examId, paperIds: string[], startDateBS: string, gapDays: number,
  skipDays: number[],           // 0..6 (Sat=6)
  skipHolidays: boolean,
})  // returns { ok: PaperId[], failed: { paperId, reason }[] }
```

### Components

- `routine-matrix.tsx` (client) — the DnD grid:
  - Left rail: **paper pills** (subject name + class chips + duration + a small "drop me" handle).
  - Top rail: **day columns** — generated from `Exam.AcademicYear.startDateBS…endDateBS` (or a narrower picker), one column per non-holiday non-skipped day. Header shows date BS + AD + weekday short.
  - Cell: when a paper is dropped, becomes a chip with time editor + delete pin.
  - Left rail also has "Unassigned" tray; remove-from-day chip puts it back here.
  - Use `DndContext + useDraggable + useDroppable` (not Sortable — papers move freely between cells, not ordered).
  - Validation banner above the grid: conflicts (same class same date+time) listed red; warnings (cross-faculty paper without target) amber.

- `paper-drawer.tsx` (Sheet) — add/edit paper:
  - Fields: subjectName, code, fullMarks, passMarks, durationMin, **Targets**: a multi-select of (Class → Subject) pairs. Subjects auto-filtered to the picked class. Multiple targets = combined-class paper.
  - "Create paper from existing Subject(s)" quick action: scan selected classes' subjects, pre-create one paper per distinct subject name with all matching targets attached.

- `auto-fill-dialog.tsx` — auto-spread:
  - Inputs: start date BS, gap days (default 1 = exam every other day), checkboxes for skip Sat/Sun, checkbox "skip configured holidays".
  - Preview list before commit.

- `bulk-date-dialog.tsx` — pick a paper → type a date → "Apply to all classes sharing this paper" (replaces or fills missing schedule).

### DnD UX details

- Drag handle = the whole pill (cursor: grab → grabbing).
- Drop target highlights as the row hovers (border + bg).
- Drop on a day that's a holiday or skip-day → shake + toast error, don't write.
- On drop: optimistic update + server action with rollback if conflict.

### Edge cases

- Two papers for the same class on the same day at the same time → reject (server-side unique check on day+time per class derived from targets).
- Duration > slot to next day = warn but allow.
- Subject name change after creation: paper.subjectName is denorm, targets still reference Subject. Show a sync button to push paper.subjectName ← targets' shared subject name when they all match.

### Verification

- `npx tsc --noEmit && npx eslint src/app/[domain]/academics/exams/...`
- Manually: create paper with 2 class targets, drop on a day, switch to another exam — only the original's chip should appear.

**Skip if** short on time: ship without `autoSpreadDates` (`bulk-date-dialog` covers the basic need).

---

## Phase 3 — Printable exam routine

**Goal**: Three print views, all per-Exam — Faculty, Class, Combined.

### Route

`src/app/[domain]/academics/exams/[examId]/routine/print/page.tsx`
Query: `?mode=faculty|class|combined&facultyId=…&classId=…`

### Components

- `print-view.tsx` — copy verbatim from `src/app/[domain]/academics/routine/print/print-view.tsx`:
  - Same `@page A4 landscape` + `@media print` block.
  - Same no-print toolbar (Close + Print).
  - Auto-`window.print()` on mount.
- Body renders one of three table layouts:
  - **Faculty mode**: rows = days, columns = subjects (papers); each cell shows class chips + time. One section per faculty.
  - **Class mode**: rows = days, columns = subjects; one section per class.
  - **Combined mode**: rows = days, one row per paper, columns: subject + classes + time + duration + invigilator-count (if Phase 7+ done).

### Add Print buttons on `routine-matrix.tsx` toolbar

Three small buttons (`Faculty`, `Class`, `Combined`) that open the print route in a new tab — same pattern as the routine compact-grid print button.

### Verification

- Open print URL with one paper scheduled → header shows school + term + date, table prints landscape, toolbar hidden.

**Skip if**: ship `combined` only; the per-faculty and per-class views can use the same combined layout with a CSS filter applied via URL.

---

## Phase 4 — Rooms registry + seat-layout editor (Settings)

**Goal**: One school-wide rooms registry with a visual per-room seat editor. Used by both Classes and Exams.

### Routes

- `src/app/[domain]/settings/rooms/page.tsx` — list of rooms.
- `src/app/[domain]/settings/rooms/[roomId]/page.tsx` — seat-layout editor for one room.

Add `Rooms` to the settings nav (`src/app/[domain]/settings/layout.tsx`).

### Server actions (new file `src/actions/rooms.ts`)

```ts
export async function listRooms(schoolId): Promise<RoomRow[]>          // with capacity (sum of SEAT-kind seats) + class count
export async function getRoomWithSeats(roomId, schoolId): Promise<RoomDetail>
export async function createRoom({ schoolId, name, notes })             // empty layout — user adds rows in editor
export async function updateRoom(id, patch)
export async function deleteRoom(id)                                    // refuse if classes or exam seats reference it; offer soft-disable
export async function setRoomLayout(roomId, schoolId, rows: { seats: { kind: "SEAT"|"AISLE"|"TEACHER_DESK", label?: string }[] }[])
  // replace-all: server diffs against existing RoomSeat rows to preserve IDs where (row,col) match
```

### Components

- `rooms-table.tsx` — shared `DataTable` with `storageKey="rooms"`. Columns: Name, Capacity (SEAT-count), Class count (1-N classes assigned), Active toggle, Edit Layout, Actions.
- `room-drawer.tsx` (Sheet) — add/rename room (name + notes only — layout is on the detail page).
- `seat-layout-editor.tsx` — the heart of this phase:
  - Stack of rows. Each row = horizontal strip of seat tiles.
  - "Add row" button → new row with 4 SEATs by default.
  - Per row: `+`/`−` to add/remove a seat at the end.
  - Per seat: click cycles `SEAT → AISLE → TEACHER_DESK → SEAT`. Right-click (or `…` menu) to label or delete the seat.
  - Drag the entire row to reorder (`@dnd-kit` sortable). Drag a seat within a row to reposition.
  - Live capacity counter ("28 seats, 4 aisles").
  - Save button (debounced auto-save on change, plus an explicit Commit).
  - Print preview (small): see the room map exactly as it would appear in seat-print mode.

### Edge cases

- Layout change after seats exist: server's `setRoomLayout` must diff carefully — deleting a seat that's referenced by an `ExamSeat` row must reject (or auto-eject the student with a warning).
- `name` uniqueness per school.
- Empty layout = capacity 0 = exam can't pick this room (filter it out).

**Skip if**: not optional — every later exam phase needs this.

---

## Phase 4b — Wire Rooms into the Class drawer

**Goal**: Replace `Class.classroom` (free text) with a Room dropdown. Tiny, ships in <1 hour.

### Changes

- `src/app/[domain]/academics/classes/class-drawer.tsx` — add a Room `<Select>` populated from `listRooms(schoolId)`. When set, write `classId.roomId`; null the legacy `classroom` text.
- `src/app/[domain]/academics/classes/columns.tsx` — Class table now reads `room?.name` and falls back to `classroom` text for un-migrated rows. Render a tiny door-icon badge.
- `src/actions/academics.ts` — `updateClass` accepts `roomId: string | null` and clears `classroom` when `roomId` is set.

### Edge cases

- Migration story: existing rows have `classroom: "201"` but no `roomId`. UI shows the text in muted italic with a "Link a room" pill that opens the dropdown.

**Skip if**: ship later — exam phases don't require it.

---

## Phase 5 — Seat plan (room picker + density + auto-assign + DnD)

**Goal**: Per `ExamSchedule`, pick rooms with per-room density, then assign students to physical seats.

### Route

`src/app/[domain]/academics/exams/[examId]/seats/[scheduleId]/page.tsx`

### Server actions (`src/actions/exam-seats.ts`)

```ts
export async function listSeatsForSchedule(scheduleId): Promise<SeatRow[]>
export async function listEligibleStudents(paperId): Promise<StudentRow[]>      // from paper.targets

// Step 1: room picker
export async function setScheduleRooms(scheduleId, rooms: { roomId, density: "FULL"|"HALF"|"ALTERNATING" }[])
export async function clearScheduleRooms(scheduleId)                            // also clears seats

// Step 2: auto-assign
export async function autoAssignSeats(input: {
  scheduleId,
  strategy: "ROLL_ASC" | "ALTERNATING_CLASS" | "MIXED_FACULTY" | "RANDOM_SEEDED",
  seed?: number,
})

// DnD overrides
export async function moveSeat(seatId, toRoomSeatId)            // by RoomSeat — server resolves room
export async function swapSeats(aSeatId, bSeatId)
export async function clearSeats(scheduleId)
```

### Density semantics

Per-room density is set on `ExamScheduleRoom.density`. When the auto-assigner walks a room's `RoomSeat[]` in (row, col) order:
- **FULL**: every `kind="SEAT"` is usable.
- **HALF**: every other usable seat is skipped (creates 1-empty-1-empty pattern down rows for anti-collusion). Effectively halves capacity.
- **ALTERNATING**: same as HALF but also offsets adjacent rows so no two students are vertically adjacent. Best anti-collusion mode.

`AISLE` and `TEACHER_DESK` kinds are always skipped.

### Auto-assign strategies (one sentence each)

- **ROLL_ASC**: order students by (className, rollNumber, name), fill rooms in user-picked order seat by seat.
- **ALTERNATING_CLASS**: round-robin by class before filling — neighbours are always from different classes when class count ≥ 2.
- **MIXED_FACULTY**: for each empty usable seat, choose the next student minimising same-faculty neighbours (up/down/left/right).
- **RANDOM_SEEDED**: deterministic Fisher-Yates from `seed` (default = `scheduleId` hash). Same input → same map → reproducible printout.

### Components

- `room-picker.tsx` — top of page: searchable multi-select of active rooms with capacity preview ("Hall A · 24 seats"). For each picked room, a tiny `<Select>` for density (FULL / HALF / ALTERNATING) with a live "effective seats" recalculation. Save → calls `setScheduleRooms`.
- `seat-board.tsx` — once rooms are picked:
  - Top toolbar: strategy picker, "Auto-assign", "Clear", "Print".
  - Body: stacked **room cards**. Each card draws the room's RoomSeat grid faithfully (variable row widths; aisles as gaps; teacher desks at the top). Seat tile shows initials + roll, class-tinted background. Disabled seats (skipped by density) are diagonally striped.
  - DnD: each occupied seat is `useDraggable`; each usable empty seat is `useDroppable`. Drop empty → move. Drop occupied → swap-confirm.
  - Unassigned tray under the cards: any eligible student not yet placed.
- `strategy-dialog.tsx` — tiny visual preview of each strategy on a sample 6×4 room.

### Edge cases

- `effective seats across picked rooms` < `eligible students` → auto-assign refuses with a numeric shortfall.
- Layout edit (Phase 4) deletes a seat that's referenced here → cascade-eject the student into the Unassigned tray with a toast.
- Student no longer in `paper.targets` (class change) → flagged red on seat; one-click eject.

### Verification

- Auto-assign + DnD swap + reload → state persists; densities respected; rooms drawn with correct variable widths.

**Skip if**: ship ROLL_ASC + FULL density only; HALF/ALTERNATING and the other strategies are v2.

---

## Phase 6 — Seat print (room map + roster)

**Goal**: Two printable artefacts per room per sitting.

### Route

`src/app/[domain]/academics/exams/[examId]/seats/[scheduleId]/print/page.tsx`
Query: `?roomId=…&mode=map|roster|both`

### Layouts

- **Seat map** (one page per room, portrait A4):
  - Header: School + term + paper + date + room.
  - Grid: cell shows `Roll / Adm No / Class` in small mono. Bold border, gridlines.
- **Roster** (landscape A4):
  - Table: Sl. No, Adm No, Roll, Name, Class, **Signature** (empty box, height 28pt — copy from `students/print` signature cell pattern).
- **Both**: map first, roster second, `page-break-after: always` between them.

Reuse the exact print-view template from `routine/print/print-view.tsx`.

**Skip if**: build roster only; seat map is gravy.

---

## Phase 7 — Invigilator assignment (with constraints + DnD)

**Goal**: Per `ExamSchedule` per `ExamRoom` pick 1+ invigilators; rotation across days.

### Route

`src/app/[domain]/academics/exams/[examId]/invigilators/page.tsx`
Query: `?date=…` (BS date) — auto-selects schedules on that date.

### Server actions (`src/actions/exam-invigilators.ts`)

```ts
export async function listInvigilatorsForExam(examId): Promise<{ scheduleId, roomId, teachers }[]>
export async function setRoomInvigilators(scheduleId, roomId, teacherIds: string[])  // replace-all
export async function autoAssignInvigilators(input: {
  examId, dateBS: string,
  rule: "MIN_LOAD_FIRST" | "ROTATE_BY_HISTORY",
  excludeTeachingSameClass: boolean,    // priority hint
  excludeIfSubjectExaminedToday: true,  // hard rule
})
```

### Auto-assign algorithm (one sentence)

For each (schedule, room) on that day:
1. **Eligible pool**: all teachers whose subject is NOT being examined today (these are running-invigilator candidates instead).
2. **Penalty**: +1 if the teacher teaches a class whose students are in this room (priority hint, soft).
3. **Score**: invigilator-count-history (ascending) + penalty + small random tiebreak.
4. Assign the lowest-scoring teacher; mark them busy for the duration to prevent same-slot double-book.

### Components

- `invigilator-board.tsx` (client):
  - Top: date picker (BS), shows which schedules + rooms are active.
  - Left rail: teacher list (search + filter by faculty), each card draggable. Shows that teacher's running-invigilator status if applicable.
  - Right: room cards for the day, each with a slot list (invigilators) → `useDroppable`. Drag a teacher onto a room. Drag teacher across rooms to swap.
  - Top-right: "Auto-assign for today" button with constraint toggles.
- `invigilator-rotation-report.tsx` — read-only table: teacher × dates of the exam, count of rooms assigned per day; surfaces uneven load.

### Edge cases

- Teacher already invigilating another room in an overlapping slot → reject server-side.
- Teacher's own subject's exam is today → block from invigilator pool; show in running-invigilator suggestion list.

**Skip if**: ship manual assignment only (no auto). The DnD UI alone is high value.

---

## Phase 8 — Running invigilator

**Goal**: Per day pick 1+ "running" teachers who float between rooms.

### Route

Same page as Phase 7 (`invigilators/page.tsx`) — a second tab/panel "Running" alongside the room board.

### Server actions

```ts
export async function setRunningInvigilators(scheduleId, teacherIds: string[])
```

### Auto-suggest

For each day, the running-invigilator candidates = teachers whose subject is being examined today (they're already at school for paper distribution / supervision). One click "Use suggested".

**Skip if**: subset of Phase 7 — combine into one page from day one.

---

## Phase 9 — Attendance per room

**Goal**: At exam time, quickly mark each student in each room.

### Route

`src/app/[domain]/academics/exams/[examId]/attendance/[scheduleId]/[roomId]/page.tsx`

### Server actions (`src/actions/exam-attendance.ts`)

```ts
export async function getRoomAttendance(scheduleId, roomId): Promise<{ student, seat, status }[]>
export async function setAttendance(scheduleId, roomId, marks: { studentId, status, note? }[])
export async function bulkMarkAll(scheduleId, roomId, status: AttendanceStatus)
```

### Components

- `attendance-board.tsx` — visual: rooms grid (same as seat plan) but each tile is a tap-cycle: P → A → L → D → P. Counters at top (Present / Absent / Late / Debarred). Sticky save bar at bottom (auto-saves on cycle).
- Print: "Hall Attendance Sheet" — roster with a checkbox column and a signature column. Reuse `routine/print/print-view.tsx`.

### Edge cases

- Sync `ExamRoomAttendance.status === "ABSENT"` ↔ `TerminalExamScore.isAbsent` on commit (idempotent upsert).

**Skip if**: defer to v2 — Phase 5 gives you the roster, paper attendance can be on paper for now.

---

## Phase 10 — Polish + dashboard + holidays admin

- `/academics/exams` dashboard tab — per Exam show: papers count, scheduled %, rooms used, invigilator coverage %, holidays. Each metric clickable to its module.
- `holidays-dialog.tsx` — manage `ExamHoliday[]` for the selected exam; used by Phase 2's auto-spread.
- Sweep: ensure every page uses `GlobalFiltersBar` with the agreed chip order `["facultyId", "academicYearId", "classId"]`.

**Skip if**: this is purely polish — every individual feature works without it.

---

## Final phase — Verification

```bash
# Schema integrity
npm run db:push
npx tsc --noEmit

# Lint surfaces
npx eslint "src/app/[domain]/academics/exams/" "src/app/[domain]/settings/rooms/" \
           "src/actions/exams.ts" "src/actions/rooms.ts" \
           "src/actions/exam-seats.ts" "src/actions/exam-invigilators.ts" \
           "src/actions/exam-attendance.ts"

# Multi-tenant grep — every server action body should mention schoolId
grep -n "schoolId" src/actions/exam*.ts | wc -l   # expect: many

# Print routes round-trip
# Manually open: /academics/exams/[id]/routine/print?mode=combined
# /academics/exams/[id]/seats/[sid]/print?roomId=…&mode=both
```

### Anti-pattern guards (grep these before declaring done)

- `grep -rn "prisma.examPaper.findMany" src/actions | grep -v schoolId` → must be empty (every query scoped).
- `grep -rn "isPrimary" src/actions/exam-invigilators.ts` → must exist (one teacher per room marked primary for accountability).
- No `_count` of seats per room without a `where: { schoolId }` ancestor.

---

## Build order recap (one-line)

1 Schema → 2 Routine matrix → 3 Routine print → **4 Rooms (Settings) → 4b Class drawer linkage** → 5 Seats (rooms + density + assign) → 6 Seat print → 7 Invigilators → 8 Running invigilators → 9 Attendance → 10 Polish.

Phase 4 (Rooms) is the hard dependency for 5–9. Phase 4b can ship in parallel with anything after 4 lands.

Phases 2–9 are each independently shippable once their predecessors land.

---

## "Killer feature" UI commitments

- **Everything is drag-and-drop**: papers onto days, students onto seats, teachers onto rooms.
- **Smart defaults everywhere**: auto-spread dates, auto-assign seats, auto-pick invigilators with constraints.
- **Print is first-class**: every list view has a "Print" button that opens a beautiful landscape A4 view with auto-print on mount.
- **One scope filter**: `GlobalFiltersBar` is on every page; URL is source of truth; bookmarkable and shareable.
- **Liquid glass + warm color palette**: amber for exam (matches sessions), violet bands for faculty grouping, emerald accents for academic data, rose only for destructive actions.
- **Empty states tell you what to do next**: dashed glass cards with a one-line CTA.
