"use client"

import { useEffect } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  schoolName:    string
  schoolAddress: string | null
  schoolPan:     string | null
  title:         string
  subtitle?:     string
  landscape?:    boolean
  children:      React.ReactNode
}

/**
 * Shared A4 print shell for all accounting reports. Hides app chrome in print
 * mode, renders the school header, and auto-triggers window.print() on mount.
 */
export function ReportPrintShell({
  schoolName, schoolAddress, schoolPan,
  title, subtitle, landscape, children,
}: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style jsx global>{`
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 14mm 14mm 16mm 14mm; }
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
          .print-shell table { font-size: 9pt !important; }
          .print-shell tr { page-break-inside: avoid; }
          .print-shell thead { display: table-header-group; }
        }
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      {/* Floating toolbar (hidden in print) */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1.5 text-xs cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </Button>
          <span className="text-[11px] font-bold text-slate-500">{title}</span>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        <div className="max-w-6xl mx-auto bg-white p-8 border border-slate-300 print:border-0">
          <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
            <h1 className="text-2xl font-black tracking-tight">{schoolName}</h1>
            {schoolAddress && <p className="text-xs text-slate-600 mt-0.5">{schoolAddress}</p>}
            {schoolPan && <p className="text-xs text-slate-600 mt-0.5">PAN: {schoolPan}</p>}
            <h2 className="text-base font-bold uppercase tracking-wider mt-3">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
