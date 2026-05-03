import NepaliDate from "nepali-date-converter"

const BS_MONTHS = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra",
]

export function todayBS(): string {
  const d = new NepaliDate()
  return `${d.getYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toBS(date: Date): string {
  const d = new NepaliDate(date)
  return `${d.getYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toAD(bsStr: string): Date {
  const [y, m, day] = bsStr.split("-").map(Number)
  return new NepaliDate(y, m - 1, day).toJsDate()
}

export function formatBS(bsStr: string): string {
  const [y, m, d] = bsStr.split("-").map(Number)
  return `${BS_MONTHS[m - 1]} ${d}, ${y}`
}

export function bsMonthName(month: number): string {
  return BS_MONTHS[month - 1] ?? ""
}

export function currentBSYear(): number {
  return new NepaliDate().getYear()
}

export function currentAcademicYear(): { start: string; end: string; name: string } {
  const y = currentBSYear()
  return { start: `${y}-04-01`, end: `${y + 1}-03-30`, name: `${y}-${y + 1}` }
}

export function bsDiff(from: string, to: string): number {
  return Math.round((toAD(to).getTime() - toAD(from).getTime()) / 86_400_000)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
