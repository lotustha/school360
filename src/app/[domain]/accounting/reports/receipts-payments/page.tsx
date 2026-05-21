import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { getReceiptsPayments } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"
import { ReportExportButton } from "@/components/accounting/report-export-button"

export const metadata: Metadata = { title: "Receipts & Payments" }

export default async function ReceiptsPaymentsPage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; from?: string; to?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const rp = await getReceiptsPayments(fyId!, sp.from, sp.to)
  const balanced = Math.abs(parseFloat(rp.totalReceiptsSide) - parseFloat(rp.totalPaymentsSide)) < 0.005

  const maxLen = Math.max(rp.receipts.length, rp.payments.length)
  const padR = [...rp.receipts, ...Array.from({ length: maxLen - rp.receipts.length }, () => null)]
  const padP = [...rp.payments, ...Array.from({ length: maxLen - rp.payments.length }, () => null)]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Receipts &amp; Payments Account</h1>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 text-xs">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
          </form>
          <ReportExportButton kind="receipts-payments" data={rp} schoolName={school.name} />
          <Link href={`/accounting/reports/receipts-payments/print?fy=${fyId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/60 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm">{formatBS(rp.fromBS)} – <strong className="font-mono">{formatBS(rp.toBS)}</strong></p>
          <span className={cn(
            "text-[10px] font-bold px-2 py-1 rounded",
            balanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
          )}>
            {balanced ? "Balanced" : "Off"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* RECEIPTS (Dr — left) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Receipts</p>
            <Row item={{ name: "Opening balance — Cash in Hand", amount: rp.openingCash, code: "" }} muted />
            <Row item={{ name: "Opening balance — Bank Accounts", amount: rp.openingBank, code: "" }} muted />
            {padR.map((l, i) => <Row key={i} item={l} />)}
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {rp.totalReceiptsSide}</span>
            </div>
          </div>

          {/* PAYMENTS (Cr — right) */}
          <div>
            <p className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50/60 border-b border-slate-200">Payments</p>
            {padP.map((l, i) => <Row key={i} item={l} />)}
            <Row item={{ name: "Closing balance — Cash in Hand", amount: rp.closingCash, code: "" }} muted />
            <Row item={{ name: "Closing balance — Bank Accounts", amount: rp.closingBank, code: "" }} muted />
            <div className="px-5 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between font-bold">
              <span className="text-xs uppercase tracking-widest text-slate-700">Total</span>
              <span className="font-mono tabular-nums text-sm">Rs. {rp.totalPaymentsSide}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ item, muted }: { item: { code: string; name: string; amount: string } | null; muted?: boolean }) {
  if (!item) return <div className="px-5 py-2 text-sm border-b border-slate-100 h-9">&nbsp;</div>
  return (
    <div className={cn("px-5 py-2 flex items-center justify-between text-sm border-b border-slate-100 hover:bg-primary/4", muted && "bg-slate-50/40 italic")}>
      <span>
        {item.code && <span className="font-mono text-xs text-slate-400 mr-2">{item.code}</span>}
        {item.name}
      </span>
      <span className="font-mono tabular-nums">{item.amount}</span>
    </div>
  )
}
