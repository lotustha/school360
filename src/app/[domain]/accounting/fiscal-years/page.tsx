import { Metadata } from "next"
import { listFiscalYears } from "@/actions/accounting/fiscal-years"
import { FiscalYearsClient } from "./fiscal-years-client"

export const metadata: Metadata = { title: "Fiscal Years" }

export default async function FiscalYearsPage() {
  const years = await listFiscalYears()
  return (
    <FiscalYearsClient
      years={years.map(y => ({
        id: y.id, name: y.name, startBS: y.startBS, endBS: y.endBS,
        status: y.status, isCurrent: y.isCurrent,
      }))}
    />
  )
}
