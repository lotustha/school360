import { Metadata } from "next"
import { SettingsNav } from "./settings-nav"

export const metadata: Metadata = {
  title: "Settings | School360",
  description: "Manage your school settings and preferences.",
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your tenant settings, access control, and configurations.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-52 flex-shrink-0">
          <SettingsNav />
        </aside>

        {/* Content Panel */}
        <div className="flex-1 min-w-0 rounded-xl border border-border/60 bg-card shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
