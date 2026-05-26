"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  useEffect(() => {
    // Tiny delay so layout settles before the browser print dialog opens
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    // window.close() silently fails when the tab wasn't opened via window.open()
    // (typical when the user navigates here directly or refreshes). Fall back
    // to navigating back; if that also has no history, send them to /compact.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/academics/routine/compact")
    }
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 8mm 6mm 10mm 6mm;
        }

        /* ─── Print-fit styles applied on BOTH screen preview AND print ───
           The /routine/print route is a WYSIWYG preview — what you see on
           screen is exactly what comes out of the printer. */
        .print-shell .max-w-\\[1400px\\] { max-width: 100% !important; }
        .print-shell .max-h-\\[calc\\(100vh-280px\\)\\] {
          max-height: none !important;
          overflow: visible !important;
        }
        /* Kill ALL inner scroll containers so the whole routine is one
           continuous, scroll-free render. Sticky headers won't survive
           overflow:visible, but a print page doesn't need them anyway. */
        .print-shell .overflow-auto,
        .print-shell .overflow-x-auto,
        .print-shell .overflow-y-auto,
        .print-shell .overflow-scroll {
          overflow: visible !important;
          max-height: none !important;
          max-width: 100% !important;
        }
        .print-shell .sticky {
          position: static !important;
        }
        .print-shell .backdrop-blur-xl { backdrop-filter: none !important; }
        /* Hide the per-schedule "Print" button rendered inside CompactGrid —
           irrelevant on a route that's already the print view. */
        .print-shell button[title^="Print"] {
          display: none !important;
        }
        .print-shell table {
          font-size: 7pt;
          width: 100%;
          table-layout: fixed;
          min-width: 0;
        }
        .print-shell th, .print-shell td {
          min-width: 0;
          padding: 3px 4px;
          word-break: break-word;
          overflow-wrap: break-word;
          border-color: #475569;
        }
        .print-shell th:first-child,
        .print-shell td:first-child {
          width: 12%;
          min-width: 0;
        }
        .print-shell .text-\\[11px\\],
        .print-shell .text-\\[10px\\],
        .print-shell .text-\\[9px\\] {
          font-size: 6.5pt;
          line-height: 1.15;
        }
        .print-shell .text-\\[12px\\] {
          font-size: 7.5pt;
          line-height: 1.15;
        }

        /* Screen preview: paper-like background so users can see the page edge */
        .print-shell {
          background: #f8fafc;
          padding: 16px;
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
          .print-shell {
            background: white !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-shell thead { display: table-header-group; }
          .print-shell tr     { page-break-inside: avoid; }
        }
      `}</style>

      {/* Floating no-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
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
