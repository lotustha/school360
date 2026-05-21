# Full-Marks Unification Plan

Drafted 2026-05-19. Resolves the two-source-of-truth problem the user surfaced:

- **Today**: `ExamPaper.fullMarks` and `ExamPaper.passMarks` are entered manually in the paper drawer at `/academics/exams/[id]/routine`. `EvaluationComponent.sourceMaxMarks` is entered separately in Evaluation Configure (e.g. "50 → 6" means raw exam scale 50, weighted contribution 6). These never sync — they can drift.
- **Decision locked**: Evaluation Configure is the source. Once a subject's marks are set there, the routine and reports inherit it. Pass/fail uses **grading bands** (school's `gradingSettings.passPercent` / NG band), not a fixed `passMarks` column.

This plan gates Phase 5 (mark-entry integration) of [[Optional_Extra_Subjects_Plan]] — `exam-reports.ts` pass/fail logic touches both areas.

---

## 1. Goals

| # | Goal |
|---|---|
| G1 | Eliminate manual entry of per-paper `fullMarks`/`passMarks` whenever the exam is linked to an evaluation |
| G2 | Pass/fail in exam reports uses grading bands (NG + `passPercent`), not `paper.passMarks` |
| G3 | Make the linkage between an `Exam` and its `EvaluationComponent`s discoverable, so admins know when a paper's marks are "owned" elsewhere |
| G4 | Reduce paper-drawer fields from 5 to 1 (duration) for the common case |

## 2. Non-goals

- Renaming or restructuring `EvaluationComponent`. The "50 → 6" mapping (raw → weighted) stays as-is.
- Forcing every exam to be wired to an evaluation. Standalone exams remain valid but use legacy `ExamPaper.fullMarks` as fallback (with a banner suggesting linkage).

---

## 3. Resolution rule (one place, one function)

New helper: `src/lib/exam-marks.ts`

```ts
export interface ResolvedExamMarks {
  fullMarks:        number       // for the report's denominator
  source:           "EVALUATION" | "PAPER_OVERRIDE" | "DEFAULT"
  passPercent:      number       // from school.gradingSettings; same for every paper
  passMarks:        number       // derived: Math.ceil(fullMarks * passPercent / 100)
}

export async function resolveExamMarks(
  examId:    string,
  subjectId: string,
  schoolId:  string,
): Promise<ResolvedExamMarks>
```

### Algorithm

```
1. Look up EvaluationComponent where
     source         = DERIVED_FROM_EXAM
     sourceExamId   = examId
     subjectEvaluation.subjectId = subjectId
   If found (take the most recent by createdAt):
     fullMarks   = component.sourceMaxMarks
     source      = "EVALUATION"

2. Else look up ExamPaperTarget → ExamPaper for (examId, subjectId).
   If paper.fullMarks is set:
     fullMarks   = paper.fullMarks
     source      = "PAPER_OVERRIDE"

3. Else:
     fullMarks   = 100
     source      = "DEFAULT"

passPercent = resolveGradingSettings(school.gradingSettings).passPercent
passMarks   = Math.ceil(fullMarks * passPercent / 100)
```

### Conflict handling

If step 1 finds **multiple** components with **different** `sourceMaxMarks` for the same `(examId, subjectId)`:
- Reads take the maximum `sourceMaxMarks` (a paper can't be smaller than what any evaluation thinks it is).
- The Configure UI warns "you've set raw scale X here but Y elsewhere — these should match."
- Validation in `evaluations.ts` action: when saving a `DERIVED_FROM_EXAM` component, refuse if another component for `(sourceExamId, subjectId)` has a different `sourceMaxMarks`.

---

## 4. Pass/fail rule

Replace `if (sc.raw < subj.passMarks) papersFailing++` at `exam-reports.ts:183` with:

```
percent = (obtained / fullMarks) * 100
grade   = bandFor(percent, school.gradingSettings.scale)   // already exists in src/lib/grade-compute.ts

failed  = absent
       || percent < passPercent
       || grade === "NG"
```

Notes:
- NG is treated as fail (matches the user's "below 35% or NG its fail").
- For schools with grade-only assessment (no marks), `passPercent` may be unused — the band itself decides. The helper handles both since `bandFor` returns NG for unmappable scores.

---

## 5. Schema impact

**No new columns.** Two deprecations:

- `ExamPaper.fullMarks` — marked `@deprecated` in schema comment. Kept for one release as fallback (`PAPER_OVERRIDE`). Removed in a follow-up migration.
- `ExamPaper.passMarks` — same treatment. Pass/fail never reads it again; safe to drop sooner if we're confident no consumers remain.

No data migration needed — the function-based resolver makes existing rows work as-is via the fallback path.

---

## 6. UI changes

### 6.1 Paper drawer (`paper-drawer.tsx`)

Today's fields: subjectName · code · fullMarks · passMarks · durationMin · targets.

After:
- **Drop** `subjectName` and `code` as free-text inputs. These are already auto-filled from the first selected target's subject (`paper-drawer.tsx:88-97`). Make them always-derived; remove the inputs entirely. Display read-only chips so the admin sees what they'll be.
- **Hide** `fullMarks` and `passMarks` by default. Show an "Override marks" link that exposes them. When `resolveExamMarks().source === "EVALUATION"`, show the resolved value as a read-only badge: "Full marks: 50 (from Evaluation: First Internal)".
- **Keep** `durationMin` and targets. Duration is exam-day metadata; not in evaluation.

This reduces paper creation to: pick class + subject(s), set duration → done.

### 6.2 Exam reports

- `getExamSummary` uses `resolveExamMarks` per paper instead of `t.paper.fullMarks ?? 100`.
- Pass/fail uses the rule from §4.
- Summary header shows a chip: "Marks source: Evaluation Configure" or "Paper override" when applicable, so admins know where the numbers come from.

### 6.3 Evaluation Configure (subject component dialog)

When saving a `DERIVED_FROM_EXAM` component, validate that `sourceMaxMarks` matches any other component for the same `(sourceExamId, subjectId)`. If a paper with manually-set `fullMarks` exists for this subject in the linked exam, surface a confirmation: "this overrides the paper's manual full marks of X — proceed?"

---

## 7. Phase breakdown

| # | Phase | Deliverable |
|---|---|---|
| 1 | Resolver | `src/lib/exam-marks.ts` with `resolveExamMarks` + tests via tsx script |
| 2 | Validation | Refuse conflicting `sourceMaxMarks` in `saveEvaluationComponent` action |
| 3 | Reports rewrite | `exam-reports.ts` uses resolver + grading-band pass/fail; drop `paper.passMarks` reads |
| 4 | Paper drawer simplification | Drop free-text subjectName/code; hide fullMarks/passMarks behind "Override" toggle |
| 5 | Configure UI conflict warning | Banner in component edit dialog when paper override would be shadowed |
| 6 | Schema cleanup (follow-up release) | Drop `ExamPaper.fullMarks` and `passMarks` columns + drawer override |

Phases 1-3 unblock the optional/extra Phase 5 (mark-entry integration). Phases 4-6 are pure UX/cleanup and can ship independently.

---

## 8. Decisions locked

- **Evaluation Configure is authoritative** for full marks when the link exists.
- **Pass/fail is grading-band-based**: percent < `passPercent` OR grade == NG OR absent.
- **No new tables, no migration.** Resolver function does all the work; deprecated columns kept one release as fallback.
- **Auto-derive subjectName/code** in paper drawer — drop the manual inputs.

## 9. Open questions

- **What if a school has no `gradingSettings.passPercent` set?** Default to 35 (matches the current `passMarks ?? 35` heuristic). Surface a "configure grading bands" prompt in the report header.
- **What about exams with `targets` that map one paper to multiple subjects** (e.g. combined-class paper "Math" → Class 11 Sci + Class 11 Mgmt — different subjectIds)? Resolver runs per `(examId, subjectId)`, so each target gets its own resolved full marks. They should match unless the two subjects have different evaluation configs — which is valid (e.g. Optional Math in Sci is graded out of 100, in Mgmt out of 75).
- **Backwards-compat for in-flight reports**: if a school is mid-term with `paper.fullMarks` already set and `EvaluationComponent.sourceMaxMarks` different, the new resolver picks Evaluation. This is a behavior change. Should we gate the new resolver behind a school-level toggle for one release? *Recommendation: no — divergence is bad data, fix it now and surface in the warning banner.*
