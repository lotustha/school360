import * as XLSX from "xlsx"
import type { ClassLedger, LedgerStudent, LedgerSubject } from "@/actions/evaluation-results"
import { formatMark } from "@/lib/format-marks"

type Mode = "grade" | "mark" | "both"

/**
 * Per-subject column count — mirrors `partsForSubject` in class-ledger-table.tsx
 * so the Excel sheet keeps perfect alignment with the on-screen layout.
 */
function partsForSubject(s: LedgerSubject, mode: Mode): number {
  const hasExternal = s.externalMax > 0
  if (mode === "both") return hasExternal ? 6 : 4
  return hasExternal ? 3 : 2
}

function pushPartLabels(row: (string | number)[], mode: Mode, hasExternal: boolean) {
  if (mode === "both") {
    row.push("IN-G", "IN-M")
    if (hasExternal) row.push("EX-G", "EX-M")
    row.push("FGL-G", "FGL-M")
  } else {
    row.push("IN")
    if (hasExternal) row.push("EX")
    row.push("FGL")
  }
}

/**
 * Build a workbook with one sheet per evaluation. Each sheet mirrors the on-screen
 * three-row header (Student identity + per-subject IN[/EX]/FGL or 4/6 sub-cols
 * for Grade-and-Mark mode) and renders cell values according to `mode`.
 */
export function exportLedgerToXlsx(
  ledger:   ClassLedger,
  mode:     Mode,
  students: LedgerStudent[],
) {
  const wb = XLSX.utils.book_new()

  for (const ev of ledger.evaluations) {
    const beforeGpa = ev.subjects.filter(s => s.subjectType !== "EXTRA")
    const afterGpa  = ev.subjects.filter(s => s.subjectType === "EXTRA")

    // Header rows — per-subject column count, no fixed `parts`
    const topHeader: (string | number)[] = ["SN", "Symbol", "Roll", "Student Name"]
    const subHeader: (string | number)[] = ["", "", "", ""]
    for (const s of beforeGpa) {
      const parts = partsForSubject(s, mode)
      topHeader.push(short(s.subjectName, s.subjectType), ...new Array(parts - 1).fill(""))
      pushPartLabels(subHeader, mode, s.externalMax > 0)
    }
    topHeader.push("GPA"); subHeader.push("")
    for (const s of afterGpa) {
      const parts = partsForSubject(s, mode)
      topHeader.push(short(s.subjectName, s.subjectType), ...new Array(parts - 1).fill(""))
      pushPartLabels(subHeader, mode, s.externalMax > 0)
    }

    const aoa: (string | number)[][] = [topHeader, subHeader]

    students.forEach((stu, i) => {
      const row: (string | number)[] = [
        i + 1,
        stu.symbolNumber ?? "",
        stu.rollNumber ?? "",
        stu.fullName,
      ]

      function emitSubject(s: typeof ev.subjects[number]) {
        const parts = partsForSubject(s, mode)
        const hasExternal = s.externalMax > 0
        const cell = ledger.cells[`${stu.id}::${s.subjectEvaluationId}`]
        const optedOut = s.subjectType === "OPTIONAL" && !!ledger.optedOut[`${stu.id}::${s.subjectId}`]
        if (optedOut) {
          for (let j = 0; j < parts; j++) row.push("N/A")
          return
        }
        if (!cell) {
          for (let j = 0; j < parts; j++) row.push("")
          return
        }
        if (mode === "grade") {
          row.push(cell.internalGrade ?? "")
          if (hasExternal) row.push(cell.externalGrade ?? "")
          row.push(cell.grade ?? "")
        } else if (mode === "mark") {
          row.push(cell.internalMax > 0 ? `${formatMark(cell.internalObtained, "integer")}/${cell.internalMax}` : "")
          if (hasExternal) row.push(cell.externalMax > 0 ? `${formatMark(cell.externalObtained, "integer")}/${cell.externalMax}` : "")
          row.push(cell.totalFull > 0 ? `${formatMark(cell.totalObtained, "integer")}/${cell.totalFull}` : "")
        } else {
          // both
          row.push(
            cell.internalGrade ?? "",
            cell.internalMax > 0 ? `${formatMark(cell.internalObtained, "integer")}/${cell.internalMax}` : "",
          )
          if (hasExternal) {
            row.push(
              cell.externalGrade ?? "",
              cell.externalMax > 0 ? `${formatMark(cell.externalObtained, "integer")}/${cell.externalMax}` : "",
            )
          }
          row.push(
            cell.grade ?? "",
            cell.totalFull > 0 ? `${formatMark(cell.totalObtained, "integer")}/${cell.totalFull}` : "",
          )
        }
      }

      for (const s of beforeGpa) emitSubject(s)
      // GPA cell: render "NG" when the student is flagged as failed in scope.
      row.push(
        ledger.anyFail[stu.id]
          ? "NG"
          : stu.gpa !== null
            ? formatMark(stu.gpa, "gpa")
            : "",
      )
      for (const s of afterGpa) emitSubject(s)

      aoa.push(row)
    })

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    if (!ws["!merges"]) ws["!merges"] = []
    // Merge the per-subject group cells in the header row — cursor advances by
    // each subject's own column count, not a fixed `parts` value.
    let cursor = 4
    for (const s of beforeGpa) {
      const parts = partsForSubject(s, mode)
      ws["!merges"].push({ s: { r: 0, c: cursor }, e: { r: 0, c: cursor + parts - 1 } })
      cursor += parts
    }
    cursor += 1 // GPA column
    for (const s of afterGpa) {
      const parts = partsForSubject(s, mode)
      ws["!merges"].push({ s: { r: 0, c: cursor }, e: { r: 0, c: cursor + parts - 1 } })
      cursor += parts
    }

    const sheetName = sanitize(`${ev.name} - ${ledger.className}`).slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const fname = `Ledger-${sanitize(ledger.className)}-${sanitize(ledger.yearName)}-${mode}.xlsx`
  XLSX.writeFile(wb, fname)
}

function sanitize(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, "-").trim()
}

function short(name: string, type: "REGULAR" | "OPTIONAL" | "EXTRA"): string {
  const upper = name.trim().toUpperCase()
  const tag = type === "EXTRA" ? " (X)" : type === "OPTIONAL" ? " (O)" : ""
  if (upper.length <= 10) return upper + tag
  return upper.slice(0, 9) + "…" + tag
}
