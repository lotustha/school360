"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-primary/30 hover:bg-primary/5 rounded-md h-8 px-3 text-xs font-bold cursor-pointer transition-colors"
    >
      <Printer className="w-3.5 h-3.5" /> Print
    </button>
  )
}
