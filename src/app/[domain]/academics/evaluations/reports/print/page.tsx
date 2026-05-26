import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getEvaluationReport } from "@/actions/evaluation-report"
import { ReportPrintView } from "./report-print-view"

export const metadata: Metadata = { title: "Print evaluation report" }

interface SP {
  eval?:    string
  classes?: string
}

export default async function EvaluationReportPrintPage({
  params,
  searchParams,
}: {
  params:       Promise<{ domain: string }>
  searchParams: Promise<SP>
}) {
  const { domain } = await params
  const sp = await searchParams
  if (!sp.eval) notFound()

  const school = await prisma.school.findUnique({ where: { slug: domain }, select: { id: true } })
  if (!school) notFound()

  const classIds = sp.classes ? sp.classes.split(",").filter(Boolean) : undefined
  const report = await getEvaluationReport({
    schoolId:     school.id,
    evaluationId: sp.eval,
    classIds,
  })
  if (!report) notFound()

  return <ReportPrintView report={report} />
}
