import Image from "next/image"
import { cn } from "@/lib/utils"

interface Props {
  name:    string
  url?:    string | null
  size?:   number      // diameter in px — defaults to 24
  /** Adds a thin ring around the avatar */
  ring?:   boolean
  /** Square-with-rounded-corners instead of full circle (use for hero displays) */
  rounded?: "full" | "lg" | "xl" | "2xl"
  /** Tailwind text-size override; auto-scales by default */
  className?: string
  /** Title attribute (accessible tooltip) */
  title?:  string
}

/**
 * Reusable avatar with initials fallback. Used wherever a person appears.
 * - `url` present → renders the image
 * - `url` null/empty → initials in a soft-primary tint badge
 */
export function Avatar({
  name, url, size = 24, ring = true, rounded = "full", className, title,
}: Props) {
  const radius =
    rounded === "lg"  ? "rounded-lg"  :
    rounded === "xl"  ? "rounded-xl"  :
    rounded === "2xl" ? "rounded-2xl" :
                        "rounded-full"

  // Auto-scaled text size from diameter — clamped to common ranges
  const textCls =
    size <= 18 ? "text-[8px]"  :
    size <= 22 ? "text-[9px]"  :
    size <= 28 ? "text-[10px]" :
    size <= 36 ? "text-xs"     :
    size <= 48 ? "text-sm"     :
    size <= 64 ? "text-base"   :
                  "text-xl"

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        title={title ?? name}
        width={size}
        height={size}
        unoptimized
        className={cn(
          radius, "object-cover flex-shrink-0",
          ring && "ring-1 ring-slate-200",
          className,
        )}
        style={{ width: size, height: size }}
      />
    )
  }

  const initials = name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <span
      title={title ?? name}
      className={cn(
        radius,
        "bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 leading-none",
        textCls,
        ring && "ring-1 ring-slate-200",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {initials || "?"}
    </span>
  )
}
