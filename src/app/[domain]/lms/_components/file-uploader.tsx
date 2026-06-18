"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Upload, File as FileIcon, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FileRef { name: string; url: string; size?: number }

/**
 * Multi-file uploader → POSTs each picked file to /api/upload/{category}
 * (returns { url }) and maintains a FileRef[] via onChange.
 */
export function FileUploader({
  value, onChange, category = "document", maxFiles = 5, accept,
}: {
  value: FileRef[]
  onChange: (files: FileRef[]) => void
  category?: string
  maxFiles?: number
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0) return
    if (value.length + picked.length > maxFiles) {
      toast.error(`At most ${maxFiles} files`)
      return
    }

    setBusy(true)
    const uploaded: FileRef[] = []
    try {
      for (const file of picked) {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch(`/api/upload/${category}`, { method: "POST", body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Upload failed for ${file.name}`)
        }
        const { url } = await res.json()
        uploaded.push({ name: file.name, url, size: file.size })
      }
      onChange([...value, ...uploaded])
    } catch (err) {
      toast.error((err as Error).message || "Upload failed")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function remove(url: string) {
    onChange(value.filter(f => f.url !== url))
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || value.length >= maxFiles}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-500 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {busy ? "Uploading…" : value.length >= maxFiles ? "File limit reached" : "Choose files"}
      </button>
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handlePick} />

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map(f => (
            <li key={f.url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm text-slate-700 truncate hover:text-primary hover:underline">
                {f.name}
              </a>
              {f.size != null && <span className="text-[10px] text-slate-400 tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>}
              <button type="button" onClick={() => remove(f.url)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
