import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getReceiptsPayments } from "@/actions/accounting/reports"
import { getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { ReportPrintShell } from "@/components/accounting/report-print-shell"
import { formatBS } from "@/lib/nepali-date"

export const dynamic = "force-dynamic"

export default async function Print({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({
    where: { slug: domain },
    select: { name: true, address: true, panNumber: true },
  })
  if (!school) notFound()
  const fyId = sp.fy ?? (await getCurrentFiscalYear())?.id
  if (!fyId) notFound()
  const rp = await getReceiptsPayments(fyId, sp.from, sp.to)

  const maxLen = Math.max(rp.receipts.length, rp.payments.length)
  const padR = [...rp.receipts, ...Array.from({ length: maxLen - rp.receipts.length }, () => null)]
  const padP = [...rp.payments, ...Array.from({ length: maxLen - rp.payments.length }, () => null)]

  return (
    <ReportPrintShell
      schoolName={school.name}
      schoolAddress={school.address}
      schoolPan={school.panNumber}
      title="Receipts & Payments Account"
      subtitle={`${formatBS(rp.fromBS)} to ${formatBS(rp.toBS)}`}
    >
      <div className="grid grid-cols-2 gap-0 border border-slate-400">
        <div className="border-r border-slate-400">
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Receipts</p>
          <PrintRow item={{ code: "", name: "Opening balance — Cash", amount: rp.openingCash }} italic />
          <PrintRow item={{ code: "", name: "Opening balance — Bank", amount: rp.openingBank }} italic />
          {padR.map((l, i) => <PrintRow key={i} item={l} />)}
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{rp.totalReceiptsSide}</span>
          </div>
        </div>
        <div>
          <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-b border-slate-400">Payments</p>
          {padP.map((l, i) => <PrintRow key={i} item={l} />)}
          <PrintRow item={{ code: "", name: "Closing balance — Cash", amount: rp.closingCash }} italic />
          <PrintRow item={{ code: "", name: "Closing balance — Bank", amount: rp.closingBank }} italic />
          <div className="px-2 py-1.5 border-t-2 border-slate-700 bg-slate-100 flex items-center justify-between font-bold">
            <span className="text-[10px] uppercase tracking-wider">Total</span>
            <span className="font-mono tabular-nums">{rp.totalPaymentsSide}</span>
          </div>
        </div>
      </div>
    </ReportPrintShell>
  )
}

function PrintRow({ item, italic }: { item: { code: string; name: string; amount: string } | null; italic?: boolean }) {
  if (!item) return <div className="px-2 py-1 text-sm border-b border-slate-200 h-7">&nbsp;</div>
  return (
    <div className={"px-2 py-1 flex items-center justify-between text-sm border-b border-slate-200 " + (italic ? "italic bg-slate-50/50" : "")}>
      <span>
        {item.code && <span className="font-mono text-xs text-slate-500 mr-2">{item.code}</span>}
        {item.name}
      </span>
      <span className="font-mono tabular-nums">{item.amount}</span>
    </div>
  )
}
