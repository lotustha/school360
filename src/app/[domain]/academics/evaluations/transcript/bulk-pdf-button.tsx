"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  classId:        string
  evaluationId:   string
  studentsCount:  number
}

export function BulkPdfButton({ classId, evaluationId, studentsCount }: Props) {
  const [busy, setBusy] = useState(false)

  async function downloadZip() {
    if (busy) return
    setBusy(true)
    const t = toast.loading(`Generating ${studentsCount} gradesheets…`)
    try {
      const res = await fetch(
        `/api/transcript-pdf?classId=${encodeURIComponent(classId)}&evaluationId=${encodeURIComponent(evaluationId)}`,
        { method: "GET" },
      )
      if (!res.ok) {
        const msg = await res.text().catch(() => "")
        throw new Error(msg || `Server returned ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const cd   = res.headers.get("content-disposition") ?? ""
      const m    = /filename="([^"]+)"/.exec(cd)
      const name = m?.[1] ?? "Gradesheets.zip"

      const a = document.createElement("a")
      a.href     = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${name}`, { id: t })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "PDF generation failed", { id: t })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={downloadZip}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 font-semibold cursor-pointer"
    >
      {busy
        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
        : <><Download className="w-3.5 h-3.5" /> Bulk PDF ({studentsCount})</>}
    </button>
  )
}
