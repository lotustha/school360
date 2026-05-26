import { cn } from "@/lib/utils"
import { toBS } from "@/lib/nepali-date"
import { formatMark } from "@/lib/format-marks"
import type { Transcript, TranscriptSubjectRow } from "@/actions/evaluation-results"

/**
 * NEB overall-result cell. FAIL → bold red "NG". INCOMPLETE → "—".
 * PASS → 2-decimal GPA via the shared formatMark helper.
 */
function OverallGpaCell({ t }: { t: Transcript }) {
  if (t.overallGrade === "NG") {
    return <span className="ml-2 text-rose-700 font-extrabold">NG</span>
  }
  return <span className="ml-2">{t.overallGpa !== null ? formatMark(t.overallGpa, "gpa") : "—"}</span>
}

interface Props {
  transcript: Transcript
  /** When true, force a page break after this document (used in batch print) */
  pageBreakAfter?: boolean
}

export function TranscriptDocument({ transcript: t, pageBreakAfter = false }: Props) {
  const isFinal = t.evaluation.isFinal
  const mainSubjects  = t.subjects.filter(s => s.subjectType !== "EXTRA")
  const extraSubjects = t.subjects.filter(s => s.subjectType === "EXTRA")
  return (
    <article
      className={cn(
        "bg-white border-2 border-slate-900 rounded-none p-8 font-serif text-slate-900",
        "print:shadow-none print:border-2 print:rounded-none print:p-6",
        pageBreakAfter && "print:break-after-page",
      )}
      style={{ minHeight: "27cm" }}
    >
      <MarksheetHeader t={t} />
      {isFinal
        ? <FinalGradesheet    t={t} subjects={mainSubjects} />
        : <InternalGradesheet t={t} subjects={mainSubjects} />}
      {extraSubjects.length > 0 && (
        <ExtraSubjectsTable isFinal={isFinal} subjects={extraSubjects} />
      )}
      <SignatureFooter publishAt={t.evaluation.publishAt} />
      <NotesRow />
    </article>
  )
}

// ─── Shared header ─────────────────────────────────────────────────────────

function MarksheetHeader({ t }: { t: Transcript }) {
  const dobBS = t.student.dobBS ?? ""
  const dobAD = t.student.dobBS ? safeBsToAd(t.student.dobBS) : ""
  const yearBS = t.evaluation.yearName
  return (
    <header className="text-center pb-2 mb-3 border-b-4 border-double border-slate-800">
      <div className="flex items-center justify-center gap-4 mb-2">
        {t.school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.school.logoUrl} alt="" className="w-20 h-20 object-contain flex-shrink-0" />
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">{t.school.name}</h1>
          {t.school.address && (
            <p className="text-xs text-slate-700">{t.school.address}</p>
          )}
          {t.school.phone && (
            <p className="text-xs text-slate-600">Tel: {t.school.phone}</p>
          )}
        </div>
      </div>
      <h2 className="text-base font-bold uppercase tracking-widest underline underline-offset-4 mt-3">Grade-sheet</h2>

      <table className="w-full text-sm mt-3">
        <tbody>
          <tr>
            <td className="text-left py-1" style={{ width: "25%" }}>The Grade(s) Secured By:</td>
            <td className="text-left py-1">
              <span className="inline-block min-w-[260px] border-b border-slate-700 px-2 font-bold uppercase">{t.student.fullName}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-sm mt-1">
        <tbody>
          <tr>
            <td className="text-left py-1" style={{ width: "20%" }}>Date Of Birth:</td>
            <td className="text-center py-1" style={{ width: "50%" }}>
              <span className="inline-block border-b border-slate-700 px-2 min-w-[260px]">
                {dobBS} BS{dobAD ? ` (${dobAD} AD)` : ""}
              </span>
            </td>
            <td className="text-left py-1" style={{ width: "10%" }}>Roll No.:</td>
            <td className="text-center py-1" style={{ width: "20%" }}>
              <span className="inline-block border-b border-slate-700 px-2 min-w-[60px]">{t.student.rollNumber ?? "—"}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-sm mt-2">
        <tbody>
          <tr>
            <td className="text-left py-1 leading-relaxed">
              In The <strong>{t.evaluation.name}</strong>,
              Grade- <span className="inline-block border-b border-slate-700 px-2 mx-1 min-w-[60px] font-bold">{t.student.className}</span>
              of <span className="inline-block border-b border-slate-700 px-2 mx-1 min-w-[120px] font-bold">{yearBS} BS</span>
              are given below:
            </td>
          </tr>
        </tbody>
      </table>
    </header>
  )
}

function safeBsToAd(_bsDate: string): string {
  // BS→AD conversion is not currently supported in this codebase; keep BS only.
  return ""
}

// ─── Internal Evaluation gradesheet body ───────────────────────────────────

function InternalGradesheet({ t, subjects }: { t: Transcript; subjects: TranscriptSubjectRow[] }) {
  return (
    <section>
      <table className="w-full text-sm border-collapse border border-slate-800 mt-2">
        <thead>
          <tr className="bg-slate-50 text-center font-bold uppercase tracking-wide text-[10px]">
            <th className="border border-slate-800 py-1.5" style={{ width: "5%" }}>SN</th>
            <th className="border border-slate-800 py-1.5 text-left pl-2" style={{ width: "40%" }}>Subjects</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "14%" }}>Credit<br />Hour<br />(CH)</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "14%" }}>Grade<br />Point<br />(GP)</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "13%" }}>Grade</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "14%" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-slate-800 px-3 py-6 text-center text-xs italic text-slate-500">
                No subjects recorded for this evaluation.
              </td>
            </tr>
          ) : subjects.map((s, i) => (
            <tr key={s.subjectId}>
              <td className="border border-slate-800 text-center py-1">{i + 1}</td>
              <td className="border border-slate-800 px-2 py-1 font-bold">{s.subjectName}</td>
              <td className="border border-slate-800 text-center font-bold">{s.creditHours ?? "—"}</td>
              <td className="border border-slate-800 text-center">{s.gpa?.toFixed(1) ?? "—"}</td>
              <td className="border border-slate-800 text-center font-bold">{s.grade ?? "—"}</td>
              <td className="border border-slate-800 text-center italic">
                {gradeRemark(s)}
              </td>
            </tr>
          ))}
          {/* Trailing blank rows (template aesthetic) */}
          {Array.from({ length: 3 }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-slate-800 py-2.5">&nbsp;</td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
            </tr>
          ))}
          <tr>
            <td colSpan={6} className="border border-slate-800 px-3 py-2 font-bold uppercase tracking-wide text-sm">
              Grade Point Average (GPA): <OverallGpaCell t={t} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

// ─── Final Evaluation gradesheet body ──────────────────────────────────────

function FinalGradesheet({ t, subjects }: { t: Transcript; subjects: TranscriptSubjectRow[] }) {
  return (
    <section>
      <table className="w-full text-sm border-collapse border border-slate-800 mt-2">
        <thead>
          <tr className="bg-slate-50 text-center font-bold uppercase tracking-wide text-[10px]">
            <th className="border border-slate-800 py-1.5" style={{ width: "8%" }}>Subject<br />Code</th>
            <th className="border border-slate-800 py-1.5 text-left pl-2" style={{ width: "30%" }}>Subjects</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "9%" }}>Credit<br />Hour<br />(CH)</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "9%" }}>Grade</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "9%" }}>Grade<br />Point<br />(GP)</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "10%" }}>Final<br />Grade</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "14%" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td colSpan={7} className="border border-slate-800 px-3 py-6 text-center text-xs italic text-slate-500">
                No subjects recorded for this evaluation.
              </td>
            </tr>
          ) : subjects.map(s => (
            <tr key={s.subjectId}>
              <td className="border border-slate-800 text-center font-mono">{s.subjectCode}</td>
              <td className="border border-slate-800 px-2 font-bold">
                <div>{s.subjectName} (TH)</div>
                <div>{s.subjectName} (IN)</div>
              </td>
              <td className="border border-slate-800 text-center font-bold">
                <div>{s.chTh !== null ? s.chTh.toFixed(2).replace(/\.?0+$/, "") : ""}</div>
                <div>{s.chIn !== null ? s.chIn.toFixed(2).replace(/\.?0+$/, "") : ""}</div>
              </td>
              <td className="border border-slate-800 text-center">
                <div>{s.thGrade ?? ""}</div>
                <div>{s.inGrade ?? ""}</div>
              </td>
              <td className="border border-slate-800 text-center">
                <div>{s.thGpa !== null ? s.thGpa.toFixed(1) : ""}</div>
                <div>{s.inGpa !== null ? s.inGpa.toFixed(1) : ""}</div>
              </td>
              <td className="border border-slate-800 text-center font-bold align-middle">
                {s.grade ?? "—"}
              </td>
              <td className="border border-slate-800 text-center italic align-middle">
                {gradeRemark(s)}
              </td>
            </tr>
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <tr key={`blank-${i}`}>
              <td className="border border-slate-800 py-3.5">&nbsp;</td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
              <td className="border border-slate-800"></td>
            </tr>
          ))}
          <tr>
            <td colSpan={7} className="border border-slate-800 px-3 py-2 font-bold uppercase tracking-wide text-sm">
              Grade Point Average (GPA): <OverallGpaCell t={t} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

// ─── Extra Subjects (placeholder template block) ───────────────────────────

function ExtraSubjectsTable({ isFinal, subjects }: { isFinal: boolean; subjects: TranscriptSubjectRow[] }) {
  const colCount = isFinal ? 7 : 6
  // Pad the table with blank rows so it visually matches the template (min 2).
  const blanks = Math.max(0, 2 - subjects.length)
  return (
    <section className="mt-4">
      <p className="font-bold uppercase text-sm">Extra Subjects</p>
      <table className="w-full text-sm border-collapse border border-slate-800 mt-1">
        <thead>
          <tr className="bg-slate-50 text-center font-bold uppercase tracking-wide text-[10px]">
            {isFinal && <th className="border border-slate-800 py-1.5" style={{ width: "8%" }}>Subject<br />Code</th>}
            <th className="border border-slate-800 py-1.5 text-left pl-2" style={{ width: isFinal ? "32%" : "40%" }}>Subjects</th>
            <th className="border border-slate-800 py-1.5" style={{ width: "10%" }}>Credit<br />Hour<br />(CH)</th>
            {isFinal && <th className="border border-slate-800 py-1.5" style={{ width: "10%" }}>Grade</th>}
            <th className="border border-slate-800 py-1.5" style={{ width: "10%" }}>Grade<br />Point<br />(GP)</th>
            {!isFinal && <th className="border border-slate-800 py-1.5" style={{ width: "10%" }}>Grade</th>}
            {isFinal && <th className="border border-slate-800 py-1.5" style={{ width: "12%" }}>Final<br />Grade</th>}
            <th className="border border-slate-800 py-1.5" style={{ width: "14%" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map(s => (
            <tr key={s.subjectId}>
              {isFinal && (
                <td className="border border-slate-800 text-center font-mono">{s.subjectCode}</td>
              )}
              <td className="border border-slate-800 px-2 py-1 font-bold">{s.subjectName}</td>
              <td className="border border-slate-800 text-center font-bold">{s.creditHours ?? "—"}</td>
              {isFinal && (
                <td className="border border-slate-800 text-center">{s.thGrade ?? s.grade ?? "—"}</td>
              )}
              <td className="border border-slate-800 text-center">{s.gpa !== null ? s.gpa.toFixed(1) : "—"}</td>
              {!isFinal && (
                <td className="border border-slate-800 text-center font-bold">{s.grade ?? "—"}</td>
              )}
              {isFinal && (
                <td className="border border-slate-800 text-center font-bold">{s.grade ?? "—"}</td>
              )}
              <td className="border border-slate-800 text-center italic">{gradeRemark(s)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={`blank-${i}`}>
              {Array.from({ length: colCount }).map((__, j) => (
                <td key={j} className="border border-slate-800 py-3.5"></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ─── Signature footer ──────────────────────────────────────────────────────

function SignatureFooter({ publishAt }: { publishAt: Date | null }) {
  // When the evaluation has been Published, print that as the official issue
  // date on the grade sheet. Falls back to today's BS date for drafts.
  const issueBS = publishAt ? bsFromDate(publishAt) : todayBS()
  const label   = publishAt ? "Date of Publication" : "Date of Issue"
  return (
    <footer className="mt-8">
      <div className="grid grid-cols-2 gap-x-12 text-sm">
        <p className="py-1">PREPARED BY: ...........................................</p>
        <p className="py-1 text-right">{label}: {issueBS}</p>
        <p className="py-1">CLASS TEACHER: ........................................</p>
        <p className="py-1 text-right">HEAD TEACHER: ........................................</p>
      </div>
    </footer>
  )
}

function todayBS(): string {
  try { return toBS(new Date()) } catch { return "" }
}

function bsFromDate(d: Date): string {
  try { return toBS(d) } catch { return "" }
}

// ─── Notes row ─────────────────────────────────────────────────────────────

function NotesRow() {
  return (
    <section className="mt-4 border border-slate-800 px-3 py-2 text-[11px]">
      <p>Note: One Credit Hour Equals to 32 WORKING HOURS</p>
      <div className="flex items-center justify-between mt-1">
        <span>ABS = Absent</span>
        <span>W = Withheld</span>
      </div>
    </section>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function gradeRemark(s: TranscriptSubjectRow): string {
  // Use the result row's `remarks` if present, otherwise map the grade letter
  // to a short word (matches the template: "Very Good", "Good", "Satisfactory"…)
  if (s.remarks) return s.remarks
  switch (s.grade) {
    case "A+": return "Outstanding"
    case "A":  return "Excellent"
    case "B+": return "Very Good"
    case "B":  return "Good"
    case "C+": return "Satisfactory"
    case "C":  return "Acceptable"
    case "D":  return "Partially Acceptable"
    case "NG": return "Not Graded"
    default:   return ""
  }
}
