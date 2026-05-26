"use client"

import { useState } from "react"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"

/**
 * Form-friendly BS date field for server-rendered <form> reports.
 *
 * Visually it's the rich NepaliDateInput; under the hood it also writes to a
 * hidden `<input name>` so plain HTML form submission picks it up as a search
 * param (so the surrounding server pages keep working without a client wrapper).
 */
export function ReportDateField({
  name, defaultValue = "", placeholder, className,
}: {
  name: string
  defaultValue?: string
  placeholder?: string
  className?: string
}) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div className={className}>
      <NepaliDateInput value={value} onChange={setValue} placeholder={placeholder} />
      <input type="hidden" name={name} value={value} />
    </div>
  )
}
