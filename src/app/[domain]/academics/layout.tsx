import { Metadata } from "next"
import { AcademicsNav } from "./academics-nav"

export const metadata: Metadata = {
  title: { default: "Academics", template: "%s | Academics | School360" },
  description: "Manage your school's academic structure.",
}

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Academics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Faculties, classes, sections, and subjects
        </p>
      </div>

      {/* Glass pill navigation */}
      <AcademicsNav />

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}
