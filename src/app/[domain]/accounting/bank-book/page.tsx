import Link from "next/link"
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { getBankBook, listBankAccounts } from "@/actions/accounting/reports"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { formatBS } from "@/lib/nepali-date"
import { ReportExportButton } from "@/components/accounting/report-export-button"

export const metadata: Metadata = { title: "Bank Book" }

export default async function BankBookPage({
  params, searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ fy?: string; account?: string; from?: string; to?: string }>
}) {
  const { domain } = await params
  const sp = await searchParams
  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { name: true } })
  if (!school) notFound()

  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const banks = await listBankAccounts()

  let book
  try {
    book = await getBankBook(fyId!, sp.from, sp.to, sp.account)
  } catch (e) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-amber-200/60 shadow-sm p-8 text-center">
        <p className="text-sm text-amber-700 font-semibold">{(e as Error).message}</p>
        <p className="text-xs text-muted-foreground mt-2">Add a BANK-subtype account in your Chart of Accounts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Bank Book</h1>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 text-xs">
            <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
              {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
            </select>
            {banks.length > 1 && (
              <select name="account" defaultValue={book.accountId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white min-w-[200px]">
                {banks.map(b => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
              </select>
            )}
            <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
          </form>
          <ReportExportButton kind="bank-book" data={book} schoolName={school.name} />
          <Link href={`/accounting/bank-book/print?fy=${fyId}&account=${book.accountId}`} target="_blank">
            <Button size="sm" variant="outline" className="cursor-pointer gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60">
          <p className="text-sm">
            <span className="font-mono text-xs text-slate-500">{book.accountCode}</span>{" "}
            <strong>{book.accountName}</strong>
            <span className="text-xs text-muted-foreground ml-2">
              · {formatBS(book.fromBS)} – {formatBS(book.toBS)}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Opening: <strong className="font-mono text-slate-700">{book.openingBalance}</strong></span>
            <span>Receipts: <strong className="font-mono text-emerald-700">{book.totalReceipts}</strong></span>
            <span>Payments: <strong className="font-mono text-rose-700">{book.totalPayments}</strong></span>
            <span>Closing: <strong className="font-mono text-slate-700">{book.closingBalance}</strong></span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
            <tr>
              <th className="px-4 py-3 text-left w-32">Date (BS)</th>
              <th className="px-4 py-3 text-left w-36">Voucher</th>
              <th className="px-4 py-3 text-left">Narration</th>
              <th className="px-4 py-3 text-right w-28">Deposit (Dr)</th>
              <th className="px-4 py-3 text-right w-28">Withdrawal (Cr)</th>
              <th className="px-4 py-3 text-right w-32">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            <tr className="bg-slate-50/40 font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right text-xs uppercase tracking-widest text-slate-500">Opening balance</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{book.openingBalance}</td>
            </tr>
            {book.rows.map((r, i) => (
              <tr key={i} className="hover:bg-primary/4">
                <td className="px-4 py-2 text-xs">{formatBS(r.dateBS)}</td>
                <td className="px-4 py-2 text-xs">
                  <Link href={`/accounting/vouchers/${r.voucherId}`} className="font-mono font-bold text-primary hover:underline">
                    {r.voucherNumber ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{r.narration}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700">{parseFloat(r.receipt) > 0 ? r.receipt : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{parseFloat(r.payment) > 0 ? r.payment : ""}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">{r.balance}</td>
              </tr>
            ))}
            {book.rows.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No bank activity in this period.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50/60 font-bold">
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-widest text-slate-500">Totals</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{book.totalReceipts}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-700">{book.totalPayments}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{book.closingBalance}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
