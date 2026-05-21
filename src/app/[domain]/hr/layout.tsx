import { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "HR & Staff", template: "%s | HR | School360" },
  description: "Manage your school's staff and payroll.",
}

export default function HRLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl mx-auto">{children}</div>
}
