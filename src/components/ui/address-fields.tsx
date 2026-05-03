"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { PROVINCES, getDistricts, getMunicipalities } from "@/lib/nepal-geography"
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
}

const labelCls = "text-xs font-semibold text-slate-600 uppercase tracking-wider"

const glassSelect = cn(
  "w-full h-11 bg-white/80 border border-slate-200 rounded-xl text-sm font-medium",
  "transition-all outline-none px-4 cursor-pointer appearance-none",
  "focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
)

const glassInput = cn(
  "w-full h-11 bg-white/80 border border-slate-200 rounded-xl text-sm font-medium",
  "transition-all outline-none px-4",
  "placeholder:text-slate-400",
  "focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
)

export function AddressFields({ value, onChange, errors = {}, variant = "glass" }: Props) {
  const districts     = value.province ? getDistricts(value.province) : []
  const municipalities = value.district ? getMunicipalities(value.district) : []

  function set(key: keyof AddressValue, val: string) {
    const next = { ...value, [key]: val }
    // Reset downstream when parent changes
    if (key === "province")  { next.district = ""; next.municipality = "" }
    if (key === "district")  { next.municipality = "" }
    onChange(next)
  }

  const sel = variant === "glass" ? glassSelect : "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
  const inp = variant === "glass" ? glassInput  : "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

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
          <select
            value={value.province}
            onChange={e => set("province", e.target.value)}
            className={cn(sel, errors.province && "border-rose-300 focus:border-rose-400")}
          >
            <option value="">Select province</option>
            {PROVINCES.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.province && <p className="text-[11px] text-rose-500 font-semibold">{errors.province}</p>}
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>District</label>
          <select
            value={value.district}
            onChange={e => set("district", e.target.value)}
            disabled={!value.province}
            className={cn(sel, errors.district && "border-rose-300", !value.province && "opacity-50 cursor-not-allowed")}
          >
            <option value="">Select district</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.district && <p className="text-[11px] text-rose-500 font-semibold">{errors.district}</p>}
        </div>
      </div>

      {/* Municipality */}
      <div className="space-y-1.5">
        <label className={labelCls}>Municipality / City</label>
        <select
          value={value.municipality}
          onChange={e => set("municipality", e.target.value)}
          disabled={!value.district}
          className={cn(sel, errors.municipality && "border-rose-300", !value.district && "opacity-50 cursor-not-allowed")}
        >
          <option value="">Select municipality</option>
          {municipalities.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
          <input
            type="text"
            value={value.street}
            onChange={e => set("street", e.target.value)}
            placeholder="e.g. Madan Bhandari Marg"
            className={cn(inp, errors.street && "border-rose-300 bg-rose-50/40")}
          />
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
