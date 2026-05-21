import { Metadata } from "next"
import { listVendors } from "@/actions/accounting/vendors"
import { VendorsClient } from "./vendors-client"

export const metadata: Metadata = { title: "Vendors" }

export default async function VendorsPage() {
  const vendors = await listVendors()
  return <VendorsClient vendors={vendors} />
}
