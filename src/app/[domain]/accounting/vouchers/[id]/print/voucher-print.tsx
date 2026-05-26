"use client"

import { useEffect } from "react"
import { ArrowLeft, Printer, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VOUCHER_TYPE_LABEL, type VoucherType } from "@/lib/accounting"
import { formatBS } from "@/lib/nepali-date"

interface Props {
  schoolName:    string
  schoolAddress: string | null
  schoolPan:     string | null
  voucher: {
    id:        string
    type:      string
    number:    string | null
    dateBS:    string
    narration: string
    partyName: string | null
    panNumber: string | null
    status:    string
    fiscalYearName: string
    totalAmount:    string
    lines: Array<{ code: string; name: string; narration: string | null; debit: string; credit: string }>
  }
}

export function VoucherPrintView({ schoolName, schoolAddress, schoolPan, voucher }: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 14mm 14mm 16mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          aside,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"],
          header { display: none !important; }
          [data-slot="sidebar-inset"] { margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          main { padding: 0 !important; background: white !important; }
          .print-shell { background: white !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
          .print-shell table { font-size: 10pt !important; }
          .print-shell tr { page-break-inside: avoid; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1.5 text-xs cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        <div className="max-w-3xl mx-auto bg-white p-8 border border-slate-300 print:border-0">
          {/* School header */}
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-2xl font-black tracking-tight">{schoolName}</h1>
            {schoolAddress && <p className="text-xs text-slate-600 mt-0.5">{schoolAddress}</p>}
            {schoolPan && <p className="text-xs text-slate-600 mt-0.5">PAN: {schoolPan}</p>}
          </div>

          {/* Voucher title */}
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold uppercase tracking-wider">{VOUCHER_TYPE_LABEL[voucher.type as VoucherType] ?? voucher.type}</h2>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">No.</p>
              <p className="font-mono font-bold">{voucher.number ?? "—"}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-5 text-sm">
            <div><span className="text-slate-500">Date (BS): </span><strong>{formatBS(voucher.dateBS)}</strong></div>
            <div><span className="text-slate-500">FY: </span><strong>{voucher.fiscalYearName}</strong></div>
            {voucher.partyName && <div><span className="text-slate-500">Party: </span><strong>{voucher.partyName}</strong></div>}
            {voucher.panNumber && <div><span className="text-slate-500">PAN: </span><strong className="font-mono">{voucher.panNumber}</strong></div>}
          </div>

          {/* Lines */}
          <table className="w-full text-sm border border-slate-400 mb-4">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Account</th>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Narration</th>
                <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Debit (Rs.)</th>
                <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-24">Credit (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="px-2 py-1.5"><span className="font-mono text-xs text-slate-500">{l.code}</span> · {l.name}</td>
                  <td className="px-2 py-1.5 text-xs text-slate-600">{l.narration ?? ""}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.debit) > 0 ? l.debit : ""}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{parseFloat(l.credit) > 0 ? l.credit : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                <td colSpan={2} className="px-2 py-1.5 text-right">Totals</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{voucher.totalAmount}</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{voucher.totalAmount}</td>
              </tr>
            </tfoot>
          </table>

          {/* Narration */}
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Narration</p>
            <p className="text-sm">{voucher.narration}</p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
            <div>
              <div className="border-t border-slate-400 pt-1">Received / Paid by</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Prepared by</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Approved by</div>
            </div>
          </div>

          {voucher.status === "REVERSED" && (
            <div className="mt-6 text-center text-rose-700 font-black uppercase tracking-widest text-xs inline-flex items-center justify-center gap-1.5 w-full">
              <AlertTriangle className="w-3.5 h-3.5" /> This voucher has been reversed
            </div>
          )}
        </div>
      </div>
    </>
  )
}
