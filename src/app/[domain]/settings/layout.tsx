import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings | School360",
  description: "Manage your school settings and preferences.",
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-6">
        {children}
      </div>
    </div>
  )
}
