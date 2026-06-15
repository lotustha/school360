import { Metadata } from "next"
import { getInstitutionSettings } from "@/actions/settings/institution"
import { InstitutionClient } from "./institution-client"

export const metadata: Metadata = {
  title: "Institution · Settings",
}

export default async function InstitutionSettingsPage() {
  const settings = await getInstitutionSettings()

  return <InstitutionClient initial={settings} />
}
