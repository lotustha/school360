import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Printer, ReceiptText, User, Hash, Calendar, Banknote, Building2, FileText, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/permissions"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { ReverseReceiptButton } from "../../students/[id]/reverse-receipt-button"

export const metadata: Metadata = { title: "Receipt · Fees" }

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requirePermission("finance:view")
  const schoolId = session.user.schoolId!
  const { id } = await params

  const payment = await prisma.feePayment.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user:    { select: { fullName: true, avatarUrl: true } },
          class:   { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      lines:        { include: { feeAccount: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
      bankAccount:  { select: { bankName: true, account: { select: { code: true } } } },
      voucher:      { select: { id: true, number: true, status: true, dateBS: true, narration: true } },
      allocations:  {
        include: {
          studentFee: {
            include: {
              feeHead:    { select: { name: true } },
              fiscalYear: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!payment || payment.schoolId !== schoolId) notFound()

  const collector = payment.collectedById
    ? await prisma.user.findUnique({ where: { id: payment.collectedById }, select: { fullName: true } })
    : null

  const isReversed = payment.voucher?.status === "REVERSED"
  const className = payment.student.class
    ? `${payment.student.class.name}${payment.student.section ? "-" + payment.student.section.name : ""}`
    : null

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/finance/history" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />Back to History
        </Link>
        <div className="flex items-center gap-2">
          {!isReversed && payment.voucher?.id && (
            <ReverseReceiptButton voucherId={payment.voucher.id} receiptNumber={payment.receiptNumber} />
          )}
          <Link
            href={`/finance/receipts/${payment.id}/print`}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer hover:opacity-90 transition shadow-md shadow-primary/20"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Link>
        </div>
      </div>

      {/* Receipt header */}
      <div className={cn(
        "bg-white/70 backdrop-blur-xl rounded-2xl border shadow-sm p-6",
        isReversed ? "border-rose-200 ring-2 ring-rose-100" : "border-white/40",
      )}>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              isReversed ? "bg-rose-50" : "bg-primary/10",
            )}>
              <ReceiptText className={cn("w-6 h-6", isReversed ? "text-rose-600" : "text-primary")} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono">{payment.receiptNumber}</h1>
              <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatBS(payment.dateBS)}
              </p>
            </div>
          </div>
          {isReversed && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-black uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5" /> Voided
            </div>
          )}
        </div>

        {/* Student panel */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-200 mb-4">
          {payment.student.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.student.user.avatarUrl} alt={payment.student.user.fullName} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0">
              <User className="w-4 h-4 text-emerald-700" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link href={`/finance/students/${payment.studentId}`} className="font-bold text-sm hover:text-primary hover:underline cursor-pointer">{payment.student.user.fullName}</Link>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />{payment.student.admissionNo}</span>
              {className && <><span className="text-slate-300">·</span><span>{className}</span></>}
            </div>
          </div>
        </div>

        {/* Money + payment info grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Info label="Amount" icon={Banknote} highlight>
            <p className={cn(
              "text-2xl font-bold font-mono tabular-nums",
              isReversed ? "text-slate-400 line-through" : "text-emerald-700",
            )}>Rs. {payment.amount.toFixed(2)}</p>
          </Info>
          <Info label="Method" icon={Building2}>
            <p className="text-sm font-bold text-slate-700">
              {payment.method}
              {payment.bankAccount && <span className="text-xs text-slate-500 ml-1">· {payment.bankAccount.account.code} {payment.bankAccount.bankName}</span>}
            </p>
          </Info>
        </div>

        {/* Voucher link */}
        {payment.voucher && (
          <div className="rounded-xl border border-slate-200 bg-white/40 p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs">
              <span className="text-slate-500">Posted GL voucher: </span>
              <Link href={`/accounting/vouchers/${payment.voucher.id}`} className="font-mono font-bold text-primary hover:underline cursor-pointer">
                {payment.voucher.number}
              </Link>
              <span className={cn(
                "ml-2 inline-block text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                payment.voucher.status === "POSTED" && "bg-emerald-100 text-emerald-700",
                payment.voucher.status === "REVERSED" && "bg-rose-100 text-rose-700",
              )}>{payment.voucher.status}</span>
            </div>
          </div>
        )}

        {/* Remarks */}
        {payment.remarks && (
          <div className="rounded-xl border border-slate-200 bg-amber-50/40 p-3 mb-4">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Remarks</p>
            <p className="text-xs text-slate-700">{payment.remarks}</p>
          </div>
        )}

        {/* Collected by */}
        {collector && (
          <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
            <User className="w-3 h-3" /> Collected by {collector.fullName}
            <span className="text-slate-300 mx-1">·</span>
            {new Date(payment.createdAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Lines (per fee head breakdown) */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" /> Lines
          </h2>
          <p className="text-[11px] text-slate-500">Per fee head breakdown</p>
        </div>
        {payment.lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No lines recorded for this receipt.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-50/60 border-b border-slate-100">
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Fee head</th>
                <th className="px-4 py-2 text-left">Note</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payment.lines.map(l => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{l.lineNo}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[10px] text-slate-400 mr-1.5">{l.feeAccount.code}</span>
                    <span className="font-semibold text-slate-700">{l.feeAccount.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{l.remarks ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums">Rs. {l.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/60 border-t border-slate-100">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[10px] uppercase tracking-widest font-black text-slate-500">Total</td>
                <td className="px-4 py-2 text-right font-mono font-black tabular-nums text-base">Rs. {payment.amount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Allocations (bills settled) */}
      {payment.allocations.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold tracking-tight">Bills settled</h2>
            <p className="text-[11px] text-slate-500">Allocations against outstanding StudentFee rows</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-50/60 border-b border-slate-100">
                <th className="px-4 py-2 text-left">FY</th>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-left">Fee head</th>
                <th className="px-4 py-2 text-right">Allocated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payment.allocations.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{a.studentFee.fiscalYear.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{a.studentFee.periodLabel}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">{a.studentFee.feeHead.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums">Rs. {a.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isReversed && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 inline-flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          This receipt has been reversed. The GL entry and student bill state have been rolled back. The original record is kept for audit.
        </div>
      )}
    </div>
  )
}

function Info({
  label, icon: Icon, highlight, children,
}: {
  label: string; icon: React.ElementType; highlight?: boolean; children: React.ReactNode
}) {
  return (
    <div className={cn(
      "rounded-xl p-4 border",
      highlight ? "bg-emerald-50/40 border-emerald-200" : "bg-slate-50/60 border-slate-200",
    )}>
      <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1 inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />{label}
      </p>
      {children}
    </div>
  )
}
