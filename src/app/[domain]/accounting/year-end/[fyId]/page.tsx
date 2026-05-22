import { Metadata } from "next"
import { notFound } from "next/navigation"
import { previewYearEndClose } from "@/actions/accounting/year-end"
import { listFiscalYears } from "@/actions/accounting/fiscal-years"
import { YearEndWizard } from "./wizard-client"

export const metadata: Metadata = { title: "Year-End Close" }

export default async function YearEndPage({
  params,
}: {
  params: Promise<{ fyId: string }>
}) {
  const { fyId } = await params
  try {
    const [preview, fys] = await Promise.all([previewYearEndClose(fyId), listFiscalYears()])
    return (
      <YearEndWizard
        preview={preview}
        allFiscalYears={fys.map(f => ({
          id: f.id, name: f.name, startBS: f.startBS, endBS: f.endBS, status: f.status, isCurrent: f.isCurrent,
        }))}
      />
    )
  } catch {
    notFound()
  }
}
