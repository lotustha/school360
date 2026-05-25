"use client"

import { useEffect } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatBS } from "@/lib/nepali-date"
import type { FeePaymentReceipt } from "@/actions/accounting/fee-payments"

interface Props {
  school: { name: string; address: string | null; panNumber: string | null; phone: string | null }
  receipt: FeePaymentReceipt
}

// "Rs. 1,234.56" → "One Thousand Two Hundred Thirty Four and 56/100"
function rupeesInWords(n: number): string {
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "]
  const b = ["", "", "Twenty ", "Thirty ", "Forty ", "Fifty ", "Sixty ", "Seventy ", "Eighty ", "Ninety "]
  function inWords(num: number): string {
    if (num === 0) return ""
    if (num < 20) return a[num]
    if (num < 100) return b[Math.floor(num / 10)] + a[num % 10]
    if (num < 1000) return a[Math.floor(num / 100)] + "Hundred " + inWords(num % 100)
    if (num < 100000) return inWords(Math.floor(num / 1000)) + "Thousand " + inWords(num % 1000)
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + "Lakh " + inWords(num % 100000)
    return inWords(Math.floor(num / 10000000)) + "Crore " + inWords(num % 10000000)
  }
  const rupees = Math.floor(n)
  const paise  = Math.round((n - rupees) * 100)
  let words = inWords(rupees).trim() || "Zero"
  if (paise > 0) words += ` and ${inWords(paise).trim()} Paise`
  return words + " only"
}

export function ReceiptPrintView({ school, receipt }: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  const amount = parseFloat(receipt.amount)

  return (
    <>
      <style jsx global>{`
        @page { size: A5 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          aside, [data-slot="sidebar"], [data-slot="sidebar-container"], [data-slot="sidebar-gap"], header { display: none !important; }
          [data-slot="sidebar-inset"] { margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          main { padding: 0 !important; background: white !important; }
          .print-shell { background: white !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1.5 text-xs cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </Button>
          <span className="text-[11px] font-bold text-slate-500">Receipt {receipt.receiptNumber}</span>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        <div className="max-w-4xl mx-auto bg-white p-6 border-2 border-slate-800 print:border-2">
          {/* School header */}
          <div className="text-center border-b-2 border-slate-800 pb-2 mb-3">
            <h1 className="text-2xl font-black tracking-tight">{school.name}</h1>
            {school.address && <p className="text-[11px] text-slate-600">{school.address}</p>}
            <div className="text-[11px] text-slate-600 flex items-center justify-center gap-3 mt-0.5">
              {school.phone && <span>Tel: {school.phone}</span>}
              {school.panNumber && <span>PAN: {school.panNumber}</span>}
            </div>
            <h2 className="text-sm font-bold uppercase tracking-widest mt-2 bg-slate-100 inline-block px-4 py-0.5 rounded">Fee Receipt</h2>
          </div>

          {/* Receipt meta */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Receipt No: </span>
              <strong className="font-mono">{receipt.receiptNumber}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-xs">Date (BS): </span>
              <strong>{formatBS(receipt.dateBS)}</strong>
            </div>
          </div>

          {/* Student */}
          <div className="border border-slate-300 rounded-lg p-3 mb-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Student</p>
              <p className="font-bold">{receipt.studentName}</p>
            </div>
            {receipt.admissionNo && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Admission No.</p>
                <p className="font-mono">{receipt.admissionNo}</p>
              </div>
            )}
            {receipt.className && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Class</p>
                <p className="font-bold">{receipt.className}</p>
              </div>
            )}
          </div>

          {/* Particulars */}
          <table className="w-full text-sm border border-slate-400 mb-3">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold w-12">#</th>
                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold">Particulars</th>
                <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wider font-bold w-28">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs align-top">{i + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <p>{line.feeAccountName}</p>
                    {line.remarks && <p className="text-[11px] text-slate-500 mt-0.5">{line.remarks}</p>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold align-top">{line.amount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                <td colSpan={2} className="px-3 py-1.5 text-right">Total</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{receipt.amount}</td>
              </tr>
            </tfoot>
          </table>

          {receipt.remarks && (
            <p className="text-[11px] text-slate-600 italic mb-3">
              <strong className="not-italic text-slate-500">Note: </strong>
              {receipt.remarks}
            </p>
          )}

          {/* In words */}
          <p className="text-xs mb-3 italic">
            <strong>In words: </strong>
            {rupeesInWords(amount)}
          </p>

          {/* Method + Voucher ref + Signatures */}
          <div className="grid grid-cols-3 gap-3 text-xs mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment Mode</p>
              <p className="font-bold">{receipt.method}{receipt.bankName ? ` · ${receipt.bankName}` : ""}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">GL Voucher</p>
              <p className="font-mono">{receipt.voucherNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Received By</p>
              <p className="font-bold">{receipt.collectedBy ?? "—"}</p>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-6 text-center text-xs">
            <div>
              <div className="border-t border-slate-400 pt-1">Cashier Signature</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
