import Link from "next/link"
import { ArrowLeft, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  title:       string
  description: string
}

export function UnderConstruction({ title, description }: Props) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link href="/students/bulk">
        <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Bulk operations
        </Button>
      </Link>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
          <Wrench className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        <p className="text-xs text-slate-400 mt-4">Coming in a follow-up phase. Stay tuned.</p>
      </div>
    </div>
  )
}
