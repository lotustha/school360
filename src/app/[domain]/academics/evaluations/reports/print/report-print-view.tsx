"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { EvaluationReport } from "@/actions/evaluation-report"
import {
  HeaderCard, KpiBand, FailDistributionChart, GradeDistributionChart,
  SubjectPassRateChart, GpaHistogramChart, SubjectTable,
  ClassBlock, RollOfHonour, FailerLists, SignoffBlock,
} from "../reports-client"

interface Props {
  report: EvaluationReport
}

export function ReportPrintView({ report }: Props) {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push("/academics/evaluations/reports")
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm 8mm 12mm 8mm;
        }

        .report-print {
          background: #f8fafc;
          padding: 16px;
        }

        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; }
          aside, header,
          [data-slot="sidebar"],
          [data-slot="sidebar-container"],
          [data-slot="sidebar-gap"] { display: none !important; }
          [data-slot="sidebar-inset"] {
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          main { padding: 0 !important; background: white !important; }
          .report-print { background: white !important; padding: 0 !important; }
          .report-section { page-break-inside: avoid; }
          .page-break { page-break-before: always; }
          .class-block { page-break-inside: auto; }
          /* Charts render via SVG — opacity + colors print fine.
             Strip the glass backdrop so colors aren't washed out on paper. */
          .report-print .backdrop-blur-xl { backdrop-filter: none !important; }
        }

        /* Print legibility — push tiny labels up to readable point sizes. */
        @media print {
          .report-print h1 { font-size: 14pt; }
          .report-print h2 { font-size: 12pt; }
          .report-print h3 { font-size: 11pt; }
          .report-print .text-\\[10px\\] { font-size: 8.5pt !important; }
          .report-print .text-\\[11px\\] { font-size: 9.5pt !important; }
          .report-print .text-xs        { font-size: 10pt  !important; }
          .report-print .text-sm        { font-size: 11pt  !important; }
        }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} className="gap-1.5 text-xs cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </Button>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Evaluation report · {report.scope.classes.length} class{report.scope.classes.length === 1 ? "" : "es"}
            </span>
          </div>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      <div className="report-print">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <div className="report-section">
            <HeaderCard report={report} />
          </div>

          <div className="report-section">
            <KpiBand report={report} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="report-section">
              <FailDistributionChart buckets={report.failBuckets} animate={false} />
            </div>
            <div className="report-section">
              <GradeDistributionChart rows={report.gradeDist} animate={false} />
            </div>
          </div>

          <div className="report-section">
            <SubjectTable rows={report.subjects} />
          </div>

          {/* Phase 2 charts — start their own page so the executive summary
              fits the first sheet cleanly. */}
          <div className="page-break grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="report-section">
              <SubjectPassRateChart rows={report.subjects} animate={false} />
            </div>
            <div className="report-section">
              <GpaHistogramChart rows={report.gpaHistogram} animate={false} />
            </div>
          </div>

          {/* Per-class blocks — each gets its own page in print. */}
          {report.byClass.map((c, i) => (
            <div key={c.classId} className={cn("class-block", i > 0 && "page-break")}>
              <ClassBlock block={c} />
            </div>
          ))}

          {/* Phase 3 — actionable lists + sign-off, fresh page. */}
          <div className="page-break report-section">
            <RollOfHonour rows={report.rollOfHonour} />
          </div>
          <div className="report-section">
            <FailerLists single={report.singleFailers} two={report.twoFailers} />
          </div>
          <div className="report-section">
            <SignoffBlock />
          </div>

          <div className="report-section text-[11px] text-slate-500 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono tabular-nums">
              Generated {report.generatedAt.toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="font-bold text-slate-700">Exam Department report</span>
          </div>
        </div>
      </div>
    </>
  )
}
