import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { CommandMenu } from "@/components/command-menu"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* bg-transparent overrides the hardcoded bg-background on SidebarInset */}
      <SidebarInset className="bg-transparent">
        {/* Glass Header */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 px-4
          border-b border-white/30 bg-white/75 backdrop-blur-xl backdrop-saturate-180
          shadow-sm shadow-slate-900/4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
          <Separator orientation="vertical" className="mr-1 h-4 opacity-30" />

          <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                <Badge
                  variant="secondary"
                  className="text-[11px] font-medium capitalize px-2 py-0 h-5
                    bg-primary/8 text-primary border-primary/20 hover:bg-primary/12"
                >
                  {domain}
                </Badge>
              </div>
            </div>

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
        </header>

        <main className="flex-1 overflow-auto [background:radial-gradient(ellipse_80%_60%_at_10%_20%,oklch(0.82_0.15_150_/_0.20),transparent),radial-gradient(ellipse_70%_65%_at_90%_5%,oklch(0.78_0.16_260_/_0.16),transparent),radial-gradient(ellipse_60%_55%_at_55%_90%,oklch(0.78_0.13_310_/_0.14),transparent),oklch(0.98_0.01_240)]">
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
