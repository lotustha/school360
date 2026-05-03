import { prisma } from "@/lib/prisma"
import { School, Globe, Phone, MapPin, Palette } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  const school = await prisma.school.findUnique({
    where: { slug: domain },
  })

  if (!school) return <div>School not found</div>

  const fields = [
    { label: "School Name", value: school.name, icon: School },
    { label: "Domain (Slug)", value: school.slug, icon: Globe },
    { label: "PAN Number", value: school.panNumber || "Not set", icon: null },
    { label: "Phone", value: school.phone || "Not set", icon: Phone },
    { label: "Address", value: school.address || "Not set", icon: MapPin },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">General Information</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Basic details about your school. Contact support to make changes.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="w-36 text-sm font-medium text-muted-foreground flex-shrink-0">
              {field.label}
            </span>
            <span className="text-sm font-medium">{field.value}</span>
          </div>
        ))}

        {/* Theme color */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <span className="w-36 text-sm font-medium text-muted-foreground flex-shrink-0 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Theme Color
          </span>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: school.themeColor || "#10b981" }}
            />
            <span className="text-sm font-mono">{school.themeColor || "#10b981"}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <p className="text-xs text-muted-foreground">
          School ID: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{school.id}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Created:{" "}
          {new Date(school.createdAt).toLocaleDateString("en-NP", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  )
}
