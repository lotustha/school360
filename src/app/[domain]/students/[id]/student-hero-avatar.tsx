"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { AvatarUploader } from "@/components/ui/avatar-uploader"
import { useEditMode } from "./edit-mode-context"
import { updateStudentField } from "@/actions/students"

interface Props {
  schoolId:    string
  studentId:   string
  initialUrl:  string | null
  initials:    string
}

/**
 * Hero avatar on the student profile page.
 * - Read-only by default: shows the photo or initials fallback.
 * - In global edit mode: surfaces the AvatarUploader with crop + upload.
 */
export function StudentHeroAvatar({ schoolId, studentId, initialUrl, initials }: Props) {
  const { editing } = useEditMode()
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [, startT] = useTransition()

  function persist(next: string | null) {
    setUrl(next)
    startT(async () => {
      try {
        await updateStudentField(schoolId, studentId, "avatarUrl", next)
        toast.success(next ? "Photo updated" : "Photo removed")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update photo")
        setUrl(initialUrl)
      }
    })
  }

  if (editing) {
    return (
      <div className="flex-shrink-0">
        <AvatarUploader value={url} onChange={persist} size={64} />
      </div>
    )
  }

  if (url) {
    return (
      <Image src={url} alt="" width={64} height={64} unoptimized
        className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 ring-1 ring-slate-200" />
    )
  }

  return (
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <span className="text-xl font-black text-primary">{initials || "?"}</span>
    </div>
  )
}
