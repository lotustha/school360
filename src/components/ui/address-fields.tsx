"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { PROVINCES, getDistricts, getMunicipalities } from "@/lib/nepal-geography"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { cn } from "@/lib/utils"

export interface AddressValue {
  province:     string
  district:     string
  municipality: string
  wardNo:       string
  street:       string
}

interface Props {
  value:    AddressValue
  onChange: (val: AddressValue) => void
  errors?:  Partial<Record<keyof AddressValue, string>>
  /** "glass" = for glass card forms (onboarding), "plain" = for shadcn form (dashboard) */
  variant?: "glass" | "plain"
  required?: boolean
  /** Optional autocomplete pool for the Street/Tole field. When non-empty,
   *  Street becomes a searchable combobox that still accepts free text. */
  streetSuggestions?: string[]
}

const labelCls = "text-xs font-semibold text-slate-600 uppercase tracking-wider"

const glassInput = cn(
  "w-full h-11 bg-white/80 border border-slate-200 rounded-xl text-sm font-medium",
  "transition-all outline-none px-4",
  "placeholder:text-slate-400",
  "focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white",
)

const plainInput = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function AddressFields({
  value, onChange, errors = {}, variant = "glass", streetSuggestions,
}: Props) {
  function set(key: keyof AddressValue, val: string) {
    const next = { ...value, [key]: val }
    if (key === "province") { next.district = ""; next.municipality = "" }
    if (key === "district") { next.municipality = "" }
    onChange(next)
  }

  const inp = variant === "glass" ? glassInput : plainInput

  const provinceOptions = React.useMemo(
    () => PROVINCES.map(p => ({ value: p.id, label: p.name })),
    [],
  )
  const districtOptions = React.useMemo(
    () => (value.province ? getDistricts(value.province) : []).map(d => ({ value: d, label: d })),
    [value.province],
  )
  const municipalityOptions = React.useMemo(
    () => (value.district ? getMunicipalities(value.district) : []).map(m => ({ value: m, label: m })),
    [value.district],
  )
  const streetOptions = React.useMemo(
    () => (streetSuggestions ?? []).map(s => ({ value: s, label: s })),
    [streetSuggestions],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Address</span>
      </div>

      {/* Province + District */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Province</label>
          <SearchableSelect
            value={value.province}
            onChange={v => set("province", v)}
            options={provinceOptions}
            placeholder="Select province"
            searchPlaceholder="Search provinces…"
            error={!!errors.province}
            variant={variant}
          />
          {errors.province && <p className="text-[11px] text-rose-500 font-semibold">{errors.province}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>District</label>
          <SearchableSelect
            value={value.district}
            onChange={v => set("district", v)}
            options={districtOptions}
            placeholder={value.province ? "Select district" : "Select a province first"}
            searchPlaceholder="Search districts…"
            emptyText={value.province ? "No districts found." : "Select a province first."}
            disabled={!value.province}
            error={!!errors.district}
            variant={variant}
          />
          {errors.district && <p className="text-[11px] text-rose-500 font-semibold">{errors.district}</p>}
        </div>
      </div>

      {/* Municipality */}
      <div className="space-y-1.5">
        <label className={labelCls}>Municipality / City</label>
        <SearchableSelect
          value={value.municipality}
          onChange={v => set("municipality", v)}
          options={municipalityOptions}
          placeholder={value.district ? "Select municipality" : "Select a district first"}
          searchPlaceholder="Search municipalities…"
          emptyText={value.district ? "No municipalities found." : "Select a district first."}
          disabled={!value.district}
          error={!!errors.municipality}
          variant={variant}
        />
        {errors.municipality && <p className="text-[11px] text-rose-500 font-semibold">{errors.municipality}</p>}
      </div>

      {/* Ward + Street */}
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-2 space-y-1.5">
          <label className={labelCls}>Ward No</label>
          <input
            type="number"
            min={1}
            max={33}
            value={value.wardNo}
            onChange={e => set("wardNo", e.target.value)}
            placeholder="e.g. 5"
            className={cn(inp, errors.wardNo && "border-rose-300 bg-rose-50/40")}
          />
          {errors.wardNo && <p className="text-[11px] text-rose-500 font-semibold">{errors.wardNo}</p>}
        </div>

        <div className="col-span-3 space-y-1.5">
          <label className={labelCls}>Street / Tole</label>
          {streetOptions.length > 0 ? (
            <SearchableSelect
              value={value.street}
              onChange={v => set("street", v)}
              options={streetOptions}
              placeholder="e.g. Madan Bhandari Marg"
              searchPlaceholder="Search or type a new street…"
              emptyText="No saved streets."
              allowFreeText
              error={!!errors.street}
              variant={variant}
            />
          ) : (
            <input
              type="text"
              value={value.street}
              onChange={e => set("street", e.target.value)}
              placeholder="e.g. Madan Bhandari Marg"
              className={cn(inp, errors.street && "border-rose-300 bg-rose-50/40")}
            />
          )}
          {errors.street && <p className="text-[11px] text-rose-500 font-semibold">{errors.street}</p>}
        </div>
      </div>

      {/* Preview */}
      {(value.municipality || value.district) && (
        <p className="text-xs text-slate-500 bg-slate-50/80 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">
          {[
            value.wardNo && `Ward ${value.wardNo}`,
            value.street,
            value.municipality,
            value.district,
            PROVINCES.find(p => p.id === value.province)?.name,
          ].filter(Boolean).join(", ")}
        </p>
      )}
    </div>
  )
}
