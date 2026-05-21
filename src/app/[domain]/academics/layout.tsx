import { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "Academics", template: "%s | Academics | School360" },
  description: "Manage your school's academic structure.",
}

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl mx-auto">{children}</div>
}
