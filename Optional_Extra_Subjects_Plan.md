# Optional & Extra Subject Enrollment Plan

Drafted 2026-05-19. Supersedes the `StudentSubjectOptOut` opt-out model with an explicit enrollment model. Three subject types are handled cleanly:

1. **REGULAR** — every student in the class is implicitly enrolled. No `SubjectGroup`, no `SubjectEnrollment` rows. Default mark-entry path.
2. **OPTIONAL** — students pick `pickCount` from a named bucket (e.g. "Optional I" = {Math, Economics}; pick 1). Modelled as `SubjectGroup{kind: OPTIONAL_PICK}`.
3. **EXTRA** — admin-curated student cohort (e.g. only some students take "Computer"). Modelled as `SubjectGroup{kind: EXTRA_COHORT}`.

Year context lives on `SubjectGroup` (one group per `(classId, academicYearId, label)`). `Class` stays **global** — same Class row across years. The year-carry flow uses promotion (`Student.classId` change between years) as the natural filter.

---

## 1. Goals

| # | Goal |
|---|---|
| G1 | Replace the score-row heuristic in `exam-reports.ts:167-185` with exact enrollment counts |
| G2 | Make OPTIONAL pick mutually-exclusive within a bucket |
| G3 | Let admins curate the student list for EXTRA subjects |
| G4 | Year-carry of cohorts from one year's group to the next, with optional "passed previous session" filter |
| G5 | One-button auto-fill for the leftover cohort |

## 2. Out of scope (separate plans owed)

- **Full-marks unification** between `ExamPaper.fullMarks` and `EvaluationComponent.sourceMaxMarks`. User decision locked: "Evaluation Configure is the source." Tracked as a separate workstream — to be drafted before mark-entry integration (Phase 5) lands, since report pass/fail logic touches both areas.
- **Grading-band pass/fail** (replacing fixed `passMarks` with NG / first-non-pass band) — depends on the unification plan above.

---

## 3. Schema

### 3.1 `Class` adds `previousClassId` only

`Class` stays year-agnostic (no `academicYearId`). One Class row per grade ("Class 9") shared across years. `previousClassId` records grade-progression lineage (Class 10's previous = Class 9) — set once by admins, walked by the year-carry action.

```prisma
model Class {
  // existing fields...
  previousClassId  String?
  previousClass    Class?  @relation("ClassLineage", fields: [previousClassId], references: [id], onDelete: SetNull)
  nextClasses      Class[] @relation("ClassLineage")

  @@index([previousClassId])
}
```

### 3.2 New tables

```prisma
enum SubjectGroupKind {
  OPTIONAL_PICK   // ≥2 subjects, student picks `pickCount` of them
  EXTRA_COHORT    // exactly 1 subject (must be EXTRA type); cohort is explicit
}

// Year-AGNOSTIC. One row per class+label (e.g. "Class 9 Optional I").
// Enrollments are year-scoped; the group itself spans years.
model SubjectGroup {
  id             String   @id @default(cuid())
  schoolId       String
  classId        String
  label          String              // "Optional I" / "Computer Cohort"
  kind           SubjectGroupKind
  pickCount      Int      @default(1)
  sourceGroupId  String?             // grade-predecessor group (Class 10's group → Class 9's group), for carry default
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  school      School                @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  class       Class                 @relation(fields: [classId], references: [id], onDelete: Cascade)
  subjects    SubjectGroupSubject[]
  enrollments SubjectEnrollment[]
  sourceGroup SubjectGroup?         @relation("SubjectGroupCarry", fields: [sourceGroupId], references: [id], onDelete: SetNull)
  carries     SubjectGroup[]        @relation("SubjectGroupCarry")

  @@unique([classId, label])
  @@index([schoolId, classId])
}

model SubjectGroupSubject {
  groupId   String
  subjectId String

  group   SubjectGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  subject Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  @@id([groupId, subjectId])
  @@unique([subjectId])              // a Subject lives in at most one group (subjects are class-scoped)
}

// Year-SCOPED. A row says "this student is taking this subject in this year".
model SubjectEnrollment {
  id             String   @id @default(cuid())
  studentId      String
  subjectId      String
  academicYearId String
  groupId        String              // back-link for listing/cleanup
  createdAt      DateTime @default(now())

  student      Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  group        SubjectGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([studentId, subjectId, academicYearId])
  @@index([groupId, academicYearId])
  @@index([subjectId, academicYearId])
}
```

### 3.3 Deprecated

- `StudentSubjectOptOut` (added 2026-05-18). Pre-migration: query row count. If zero (expected — table is one day old), drop in the same migration as the new tables land. If non-zero, keep one release as read-only fallback; drop in Phase 8.

---

## 4. Mark-entry & report rules (spelled out)

The rule for "is student S enrolled in subject T for year Y":

```
if Subject.type == REGULAR:
    enrolled = (Student.classId == Subject.classId)
else:
    group = SubjectGroup containing T  (via SubjectGroupSubject)
    if group is null:
        # not yet configured — fall back to permissive default
        enrolled = (Student.classId == Subject.classId)
    else:
        enrolled = exists SubjectEnrollment(studentId=S, subjectId=T, academicYearId=Y)
```

REGULAR shortcut skips the enrollment check entirely — that path retains today's behavior.

Consumers:
- `getClassMarkSheet`: per-subject student list filtered by the rule above.
- `terminalExamScore` write actions: reject if student fails the rule.
- `getExamSummary` reports: `expected` denominator = enrolled count per subject; `entered` numerator = unchanged.

Drop the `subjectsWithAnyEntry` heuristic in `exam-reports.ts:167-185` once the consumers are switched over.

---

## 5. Server-action surface

New file: `src/actions/subject-groups.ts`

```
createSubjectGroup(schoolId, classId, { label, kind, pickCount, subjectIds, sourceGroupId? })
updateSubjectGroup(groupId, { label, pickCount, subjectIds })
deleteSubjectGroup(groupId)
listSubjectGroups(classId)                            // groups are year-agnostic
listGroupEnrollments(groupId, academicYearId)         // per-year enrollment + counts

enrollStudent(groupId, academicYearId, studentId, subjectId)
unenrollStudent(groupId, academicYearId, studentId, subjectId)
bulkEnroll(groupId, academicYearId, studentIds, subjectId)
fillRemaining(groupId, academicYearId, subjectId)     // all unassigned-in-this-year-this-group students → subjectId

carryEnrollmentsFromPreviousYear(
  groupId, targetAcademicYearId, sourceAcademicYearId,
  opts: { passedOnly: bool }
)
```

Validation rules enforced in actions:
- `OPTIONAL_PICK`: ≥2 subjects, `1 ≤ pickCount < subjects.length`. Block `pickCount == subjects.length` (degenerates to REGULAR).
- `EXTRA_COHORT`: exactly 1 subject, subject's `type === "EXTRA"`.
- A student's enrollments within a `(groupId, academicYearId)` slice must be ≤ `pickCount`.
- Enrollment subject must belong to the group's subjects.
- Student must be in the group's class for the year being enrolled (`Student.classId == group.classId AND Student.academicYearId == academicYearId`).
- `carryEnrollmentsFromPreviousYear`: source year must precede target (`AcademicYear.startDateBS` comparison). Source enrollments are filtered by `Student.classId == group.classId` in the target year (i.e. the student is currently enrolled in this class) AND (optionally) by prior pass.

### 5.1 Cross-grade carry (separate from same-class year-carry)

When a `SubjectGroup` at Class 10 has `sourceGroupId` set to a Class 9 group, an additional flow promotes the cohort up a grade:

```
promoteCohortFromGradePredecessor(
  targetGroupId, sourceGroupId, sourceAcademicYearId, targetAcademicYearId,
  opts: { passedOnly: bool }
)
```

Reads enrollments from `(sourceGroupId, sourceAcademicYearId)`, finds those students in `targetAcademicYearId` whose current `classId == targetGroup.classId` (they got promoted), and writes new enrollments on `(targetGroupId, targetAcademicYearId)` for the same subject. Useful for carrying an EXTRA_COHORT (e.g. "Computer kids") up to the next grade.

---

## 6. UI

### 6.1 New tab on `/academics/subjects`: "Groups"

Filters at top: Class (groups are year-agnostic) + Academic Year (for displaying enrolled count). Table rows: label · kind · subjects · enrolled-this-year count · actions.

### 6.2 "Manage Students" drawer per group

```
┌─────────────────────────────────────────────────────────────┐
│ Optional I — Class 9 — 2082 — Pick 1                        │
│ Status: 12 of 30 students unassigned   [Fill remaining → ▼] │
├─────────────────────────────────────────────────────────────┤
│ Roll │ Name          │ Math    │ Economics │ Actions        │
│  1   │ Aarav Sharma  │   ●     │           │  Clear         │
│  2   │ Sneha Adhikari│         │     ●     │  Clear         │
│  3   │ Bishal Thapa  │  ○      │     ○     │                │
└─────────────────────────────────────────────────────────────┘
```
- One-pick groups: radio per row (single selection per student).
- Multi-pick (`pickCount > 1`): checkboxes, hard-capped at `pickCount` per row.
- **Fill remaining** is an explicit button. User picks a target subject from the dropdown, clicks → all currently unassigned students get enrolled in that subject. Works for any group size. No implicit auto-fill.

### 6.3 EXTRA-cohort drawer

Single-subject group means no row-level pick — a roster with a checkbox column. Header shows "Computer · 14 students enrolled". Bulk select-all / clear all.

### 6.4 Carry flows

**Same-class year-carry** (most common): On the manage-students drawer, an "Import enrollments from previous year" button. Picks `sourceAcademicYearId` (defaults to the year prior to the one being viewed); copies enrollments forward for students whose `classId` still equals the group's class in the new year. Optional "passed only" checkbox.

**Cross-grade promotion-carry**: On group create drawer, an "Inherit from grade predecessor" affordance — sets `sourceGroupId` to a group on the predecessor class. After creation, the manage-students view shows a "Promote cohort from Class 9 (2082)" button that runs `promoteCohortFromGradePredecessor`. Filters source-year members to those who are now in the target class for the target year.

Both flows respect the "Only students who passed previous session" toggle (queries `SubjectEvaluationResult` for the source year).

---

## 7. Phase breakdown

| # | Phase | Deliverable |
|---|---|---|
| 1 | Schema + migration | `SubjectGroup`, `SubjectGroupSubject`, `SubjectEnrollment` tables; drop or keep-fallback `StudentSubjectOptOut` based on row count |
| 2 | Server actions | `subject-groups.ts` with full CRUD, enrollment, carry, fillRemaining |
| 3 | Admin UI: group CRUD | New "Groups" tab on `/academics/subjects` |
| 4 | Admin UI: enrollment drawer | Roster grid + Fill-remaining button |
| 5 | Integration: mark-entry | `getClassMarkSheet` + score-write gates per §4 |
| 6 | Integration: reports | `getExamSummary` enrolled denominator; drop heuristic |
| 7 | Year-carry UX | Import-from-previous-year + passed-only filter |
| 8 | Cleanup | If `StudentSubjectOptOut` was kept: drop it; remove fallback code paths |

---

## 8. Decisions locked

- **Class stays year-agnostic** but gains `previousClassId` for grade-progression lineage. No `Class.academicYearId`.
- **`SubjectGroup` is year-agnostic; `SubjectEnrollment` is year-scoped** via `academicYearId`. Unique key on `(studentId, subjectId, academicYearId)`.
- **One unified `SubjectGroup` table** for both `OPTIONAL_PICK` and `EXTRA_COHORT` (different `kind`, same lifecycle).
- **Auto-fill is an explicit button**, not implicit on "N-1 subjects assigned".
- **Backfill is conditional** on `StudentSubjectOptOut` having actual data. Likely zero rows; if so, skip entirely.
- **Full Marks unification is a separate plan** owed before Phase 5 mark-entry integration.

## 9. Open questions

- "Passed previous session" filter: use `SubjectEvaluationResult.passed` (if such a flag exists) or compute from raw scores at carry time? *Recommendation: stored flag if present; otherwise compute.*
- When carrying, should we copy `pickCount` and subjects from source automatically, or require admin to set those on target first? *Recommendation: copy as defaults, allow override before confirming carry.*
- Should the system warn if an EXTRA subject has no `EXTRA_COHORT` group set (i.e. nobody's enrolled, but mark sheet would still show)? *Recommendation: yes — banner on subject's mark-entry page.*
