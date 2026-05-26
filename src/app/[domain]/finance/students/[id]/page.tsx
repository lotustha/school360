import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { ArrowLeft, Receipt, Printer } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { getStudentLedger } from "@/actions/billing/ledger"
import { getStudentSchedule } from "@/actions/billing/student-fees"
import { listFeePayments } from "@/actions/accounting/fee-payments"
import { ReverseReceiptButton } from "./reverse-receipt-button"
import { monthsInFiscalYear, fiscalYearOf, generatePlanPeriods } from "@/lib/nepali-date"
import { ScheduleClient } from "./schedule-client"

export const metadata: Metadata = { title: "Student schedule · Fees" }

export default async function StudentSchedulePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fy?: string }>
}) {
  const session = await requirePermission("finance:billing:view")
  const schoolId = session.user.schoolId!
  const { id } = await params
  const sp = await searchParams

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user:    { select: { fullName: true, avatarUrl: true } },
      class:   { select: { name: true, id: true } },
      section: { select: { name: true } },
    },
  })
  if (!student || student.schoolId !== schoolId) notFound()

  // Resolve current FY (or the one passed in ?fy=)
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { schoolId },
    orderBy: [{ isCurrent: "desc" }, { startBS: "desc" }],
    select: { id: true, name: true, startBS: true, isCurrent: true },
    take: 5,
  })
  const activeFY = sp.fy
    ? fiscalYears.find(f => f.id === sp.fy) ?? fiscalYears[0]
    : fiscalYears.find(f => f.isCurrent) ?? fiscalYears[0]

  if (!activeFY) {
    return (
      <div className="space-y-4">
        <Link href="/finance/students" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Students
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          No fiscal year configured. <Link href="/accounting/fiscal-years" className="font-bold underline">Set one up →</Link>
        </div>
      </div>
    )
  }

  // Fetch schedule + heads (for adding ad-hoc rows) + ledger summary + payment history
  const [schedule, heads, ledger, payments] = await Promise.all([
    getStudentSchedule({ studentId: id, fiscalYearId: activeFY.id }),
    prisma.feeHead.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, frequency: true, defaultAmount: true, defaultDueDay: true },
      orderBy: [{ name: "asc" }],
    }),
    getStudentLedger(id),
    listFeePayments({ studentId: id }),
  ])

  // Always render the full 12-column grid so users can see future/empty periods.
  // Column labels come from the plan that generated this student's rows (BS Baisakh→Chaitra,
  // AD Jan→Dec, BS Shrawan→Asar, …). Fall back to the FY's 12 BS months when there are no
  // rows yet (e.g. a freshly-added student with no plan applied).
  let months: Array<{ monthIndex: number; label: string }>
  const sourcePlanIds = Array.from(new Set(schedule.map(r => r.sourcePlanId).filter((id): id is string => !!id)))
  const sourcePlan = sourcePlanIds.length > 0
    ? await prisma.feePlan.findUnique({
        where: { id: sourcePlanIds[0] },
        select: { calendarSystem: true, startMonth: true, startYear: true },
      })
    : null

  if (sourcePlan) {
    months = generatePlanPeriods({
      calendar:   sourcePlan.calendarSystem as "BS" | "AD",
      startMonth: sourcePlan.startMonth,
      startYear:  sourcePlan.startYear,
      dueDay:     1,
    }).map(p => ({ monthIndex: p.periodIndex, label: p.label }))
  } else {
    const fyInfo = fiscalYearOf(activeFY.startBS)
    months = monthsInFiscalYear(fyInfo).map(m => ({ monthIndex: m.monthIndex, label: m.label }))
  }

  const className = student.class ? `${student.class.name}${student.section ? "-" + student.section.name : ""}` : null
  const initials = student.user.fullName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/finance/students" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Students
        </Link>
        <Link
          href={`/finance/collect?studentId=${id}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer hover:opacity-90 transition shadow-md shadow-primary/20"
        >
          <Receipt className="w-3.5 h-3.5" />Collect Fee
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 flex flex-wrap items-center gap-4">
        {student.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.user.avatarUrl} alt={student.user.fullName} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white shadow-md" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-md">
            <span className="text-xl font-bold text-emerald-700">{initials}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight truncate">{student.user.fullName}</h1>
          <p className="text-xs text-slate-500 font-mono">{student.admissionNo}{className && ` · ${className}`}</p>
        </div>
        {ledger && (
          <div className="flex gap-6 ml-auto">
            <KPI label="Billed"      value={`Rs. ${ledger.totalBilled}`} tone="slate" />
            <KPI label="Paid"        value={`Rs. ${ledger.totalPaid}`}   tone="emerald" />
            <KPI label="Outstanding" value={`Rs. ${ledger.balance}`}     tone={parseFloat(ledger.balance) > 0 ? "rose" : "emerald"} />
          </div>
        )}
      </div>

      <ScheduleClient
        studentId={id}
        rows={schedule}
        heads={heads.map(h => ({
          id:            h.id,
          name:          h.name,
          frequency:     h.frequency,
          defaultAmount: h.defaultAmount.toFixed(2),
          defaultDueDay: h.defaultDueDay,
        }))}
        months={months}
        fiscalYears={fiscalYears.map(f => ({ id: f.id, name: f.name }))}
        activeFiscalYearId={activeFY.id}
      />

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Receipts &amp; Payments</h2>
            <p className="text-[11px] text-slate-500">All money collected from this student. Click a row to view or reprint the receipt.</p>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">{payments.length} receipt{payments.length === 1 ? "" : "s"}</span>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No payments collected yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-50/60 border-b border-slate-100">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Receipt #</th>
                <th className="px-4 py-2 text-left">For</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-left">Voucher #</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => {
                const headSummary = p.lines.length === 0
                  ? p.feeAccountName
                  : p.lines.length === 1
                  ? p.lines[0].feeAccountName
                  : `${p.lines[0].feeAccountName} +${p.lines.length - 1} more`
                const isReversed = p.voucherStatus === "REVERSED"
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${isReversed ? "opacity-60" : ""}`}>
                    <td className={`px-4 py-2.5 font-mono text-xs tabular-nums text-slate-700 ${isReversed ? "line-through" : ""}`}>{p.dateBS}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/finance/receipts/${p.id}/print`}
                        className={`font-mono text-xs font-bold text-slate-900 hover:text-primary hover:underline cursor-pointer ${isReversed ? "line-through" : ""}`}
                      >
                        {p.receiptNumber}
                      </Link>
                      {isReversed && (
                        <span className="ml-2 inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">VOIDED</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-slate-700 ${isReversed ? "line-through" : ""}`}>{headSummary}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums ${isReversed ? "line-through text-slate-400" : "text-emerald-700"}`}>Rs. {p.amount}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {p.method}
                        {p.bankName && ` · ${p.bankName}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {p.voucherNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          href={`/finance/receipts/${p.id}/print`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          title="View / reprint receipt"
                        >
                          <Printer className="w-3 h-3" /> Print
                        </Link>
                        {!isReversed && p.voucherId && (
                          <ReverseReceiptButton voucherId={p.voucherId} receiptNumber={p.receiptNumber} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, tone }: { label: string; value: string; tone: "slate" | "emerald" | "rose" }) {
  const colors = {
    slate:   "text-slate-700",
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
  }[tone]
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
      <p className={`text-base font-bold font-mono tabular-nums ${colors}`}>{value}</p>
    </div>
  )
}
