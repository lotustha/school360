"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import Cropper, { type Area } from "react-easy-crop"
import { toast } from "sonner"
import { Camera, Upload, X, Check, Loader2, Trash2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  value:    string | null
  onChange: (url: string | null) => void
  size?:    number   // Rendered avatar diameter (px)
  className?: string
}

/**
 * Avatar picker with crop. Opens a file picker → crop modal → uploads the
 * cropped JPEG to /api/upload/avatar → returns the saved public URL via onChange.
 */
export function AvatarUploader({ value, onChange, size = 80, className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageSrc,   setImageSrc]   = useState<string | null>(null)
  const [crop,       setCrop]       = useState({ x: 0, y: 0 })
  const [zoom,       setZoom]       = useState(1)
  const [cropArea,   setCropArea]   = useState<Area | null>(null)
  const [uploading,  setUploading]  = useState(false)

  function openFilePicker() {
    fileRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) {
      toast.error("Pick an image file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(f)
    // Reset the input so picking the same file again still fires onChange
    e.target.value = ""
  }

  const onCropComplete = useCallback((_: Area, areaPx: Area) => {
    setCropArea(areaPx)
  }, [])

  async function handleConfirmCrop() {
    if (!imageSrc || !cropArea) return
    setUploading(true)
    try {
      const blob = await cropToBlob(imageSrc, cropArea)
      const form = new FormData()
      form.append("file", blob, "avatar.jpg")
      const res = await fetch("/api/upload/avatar", { method: "POST", body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed (${res.status})`)
      }
      const { url } = await res.json()
      onChange(url)
      toast.success("Photo uploaded")
      setImageSrc(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        onClick={openFilePicker}
        title="Click to choose a photo"
        className={cn(
          "rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-slate-200 transition-colors relative",
        )}
        style={{ width: size, height: size }}
      >
        {value ? (
          <Image src={value} alt="" width={size} height={size}
            className="object-cover" unoptimized />
        ) : (
          <Camera className="w-5 h-5 text-slate-400" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" size="sm" variant="outline" onClick={openFilePicker}
          className="gap-1.5 cursor-pointer text-xs h-7 bg-white">
          <Upload className="w-3 h-3" /> {value ? "Change" : "Upload photo"}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}
            className="gap-1.5 cursor-pointer text-[11px] h-6 text-rose-600 hover:bg-rose-50">
            <Trash2 className="w-2.5 h-2.5" /> Remove
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dialog open={!!imageSrc} onOpenChange={(o) => { if (!o && !uploading) setImageSrc(null) }}>
        <DialogContent className="bg-white/95 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle>Crop photo</DialogTitle>
            <DialogDescription>Pinch / drag to position, scroll to zoom.</DialogDescription>
          </DialogHeader>

          {imageSrc && (
            <div className="relative w-full h-72 bg-slate-100 rounded-lg overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zoom</label>
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="flex-1 cursor-pointer" />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImageSrc(null)} disabled={uploading}
              className="gap-1.5 cursor-pointer text-xs h-8">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmCrop} disabled={uploading || !cropArea}
              className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {uploading ? "Uploading…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Helper: render the cropped area to a JPEG blob ──────────────────────────

async function cropToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  const size   = Math.min(Math.max(area.width, area.height), 1024)  // Cap output at 1024px
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D unsupported")
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, size, size,
  )
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error("Canvas toBlob failed"))
    }, "image/jpeg", 0.9)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
