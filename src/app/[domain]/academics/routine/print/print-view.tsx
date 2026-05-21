"use client"

import { useEffect } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompactGrid } from "../compact/compact-grid"
import type { CompactClassColumn } from "@/actions/routine"

interface Props {
  schoolName:   string
  scheduleName: string | null
  columns:      CompactClassColumn[]
  title:        string | null
}

export function RoutinePrintView({ schoolName, scheduleName, columns, title }: Props) {
  useEffect(() => {
    // Tiny delay so layout settles before the browser print dialog opens
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm 8mm 12mm 8mm;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          /* Hide global app chrome: sidebar + page header (tabs/breadcrumb). */
          aside,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"],
          header { display: none !important; }
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          main { padding: 0 !important; background: white !important; }
          .print-shell { background: white !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
          /* Strip glass effects on the grid */
          .print-shell table { font-size: 8.5pt !important; }
          .print-shell thead { display: table-header-group; }
          .print-shell tr     { page-break-inside: avoid; }
          .print-shell .max-h-\\[calc\\(100vh-280px\\)\\] { max-height: none !important; overflow: visible !important; }
          .print-shell .backdrop-blur-xl { backdrop-filter: none !important; }
          .print-shell th, .print-shell td { border-color: #475569 !important; }
        }
        /* On screen: keep readable */
        .print-shell { background: #f8fafc; padding: 16px; }
      `}</style>

      {/* Floating no-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.close()}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {columns.length} class{columns.length === 1 ? "" : "es"}
              {scheduleName && <span className="ml-2 text-slate-600 normal-case font-semibold">· {scheduleName}</span>}
            </span>
          </div>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="print-shell">
        {/* Print-friendly header — visible both on screen and on paper */}
        <div className="max-w-[1400px] mx-auto mb-4">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-slate-800 pb-2">
            <div>
              <h1 className="text-base font-black text-slate-900">{schoolName}</h1>
              <p className="text-[11px] text-slate-600 font-semibold">
                {title ?? "Class Routine"}
                {scheduleName && <span className="ml-2 text-slate-500">— {scheduleName}</span>}
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tabular-nums">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto">
          <CompactGrid columns={columns} />
        </div>
      </div>
    </>
  )
}
