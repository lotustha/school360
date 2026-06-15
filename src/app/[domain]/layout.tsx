import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { CommandMenu } from "@/components/command-menu"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderTabs } from "@/components/header-tabs"
import { HeaderBreadcrumb } from "@/components/header-breadcrumb"
import { InstitutionProvider } from "@/components/institution-provider"
import { getInstitutionTypeBySlug } from "@/lib/institution"

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  // Phase 12 — institution type gates which nav sections / routes activate.
  // SCHOOL (default) keeps the current K-12 experience unchanged; COLLEGE /
  // UNIVERSITY unlock the higher-education sections as they ship (Phases 24+).
  const institutionType = await getInstitutionTypeBySlug(domain)

  return (
    <InstitutionProvider institutionType={institutionType}>
    <SidebarProvider>
      <AppSidebar />
      {/* bg-transparent overrides the hardcoded bg-background on SidebarInset */}
      <SidebarInset className="bg-transparent">
        {/* Glass Header — expands to two rows when a module with tabs is active */}
        <header className="sticky top-0 z-40 shrink-0
          bg-white/75 backdrop-blur-xl backdrop-saturate-180
          border-b border-white/30 shadow-sm shadow-slate-900/4">
          {/* Row 1: navigation controls */}
          <div className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
            <Separator orientation="vertical" className="mr-1 h-4 opacity-30" />

            <div className="flex-1 flex items-center justify-between min-w-0">
              <HeaderBreadcrumb domain={domain} />

              <div className="flex items-center gap-1">
                <CommandMenu />
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground hover:text-foreground
                    hover:bg-primary/8 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                </Button>
              </div>
            </div>
          </div>

          {/* Row 2: module tab strip (only renders when in a tabbed module) */}
          <HeaderTabs />
        </header>

        <main className="flex-1 overflow-auto [background:radial-gradient(ellipse_80%_60%_at_10%_20%,oklch(0.82_0.15_150_/_0.20),transparent),radial-gradient(ellipse_70%_65%_at_90%_5%,oklch(0.78_0.16_260_/_0.16),transparent),radial-gradient(ellipse_60%_55%_at_55%_90%,oklch(0.78_0.13_310_/_0.14),transparent),oklch(0.98_0.01_240)]">
          <div className="p-5">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </InstitutionProvider>
  )
}
