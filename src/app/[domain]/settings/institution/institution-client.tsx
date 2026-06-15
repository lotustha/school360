"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Landmark, Library, School as SchoolIcon, GraduationCap, Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  updateInstitutionSettings,
  type InstitutionSettings,
} from "@/actions/settings/institution"

const TYPE_OPTIONS = [
  {
    value: "SCHOOL" as const,
    label: "School",
    icon: SchoolIcon,
    badge: "K-12",
    description: "Grades 1–12 only. Class/Section structure, CAS & NEB evaluation.",
  },
  {
    value: "COLLEGE" as const,
    label: "College",
    icon: Library,
    badge: "K-12 + Bachelor's",
    description: "Adds Departments, Programmes, Semesters and credit-based GPA.",
  },
  {
    value: "UNIVERSITY" as const,
    label: "University",
    icon: GraduationCap,
    badge: "Full HE",
    description: "Bachelor's, Master's & PhD — including Thesis and Research modules.",
  },
]

const AFFILIATIONS = [
  { code: "TU", name: "Tribhuvan University" },
  { code: "KU", name: "Kathmandu University" },
  { code: "PU", name: "Pokhara University" },
  { code: "PUF", name: "Purbanchal University" },
  { code: "FWU", name: "Far Western University" },
  { code: "MU", name: "Mid-West University" },
]

export function InstitutionClient({ initial }: { initial: InstitutionSettings }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [institutionType, setInstitutionType] = React.useState(initial.institutionType)
  const [affiliatedTo, setAffiliatedTo] = React.useState(initial.affiliatedTo ?? "")
  const [affiliationCode, setAffiliationCode] = React.useState(initial.affiliationCode ?? "")
  const [moeRegNo, setMoeRegNo] = React.useState(initial.moeRegNo ?? "")

  const isHE = institutionType === "COLLEGE" || institutionType === "UNIVERSITY"

  const dirty =
    institutionType !== initial.institutionType ||
    (affiliatedTo || null) !== initial.affiliatedTo ||
    (affiliationCode.trim() || null) !== initial.affiliationCode ||
    (moeRegNo.trim() || null) !== initial.moeRegNo

  function save() {
    start(async () => {
      try {
        await updateInstitutionSettings({
          institutionType,
          affiliatedTo: isHE ? affiliatedTo : "",
          affiliationCode: isHE ? affiliationCode : "",
          moeRegNo,
        })
        router.refresh()
        toast.success("Institution settings saved")
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" /> Institution
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          What kind of institution is this? The type controls which academic
          structures and modules are available across the platform.
        </p>
      </div>

      <Separator />

      {/* Type selector */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
          Institution Type
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPE_OPTIONS.map((opt) => {
            const active = institutionType === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                onClick={() => setInstitutionType(opt.value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all cursor-pointer",
                  active
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-slate-100 bg-white/60 hover:border-slate-200 hover:bg-white/80"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      active ? "bg-primary text-white shadow-md shadow-primary/25" : "bg-slate-100 text-slate-400"
                    )}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  {active ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider">
                      {opt.badge}
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-sm text-slate-900">{opt.label}</span>
                <p className="text-[11px] text-slate-500 leading-snug">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Affiliation — HE only */}
      {isHE && (
        <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/3 p-4">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
            Affiliation
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="affiliatedTo" className="text-xs font-semibold text-slate-600">
                Affiliated To
              </label>
              <select
                id="affiliatedTo"
                value={affiliatedTo}
                disabled={pending}
                onChange={(e) => setAffiliatedTo(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-white/80 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="">Not affiliated / self-governing</option>
                {AFFILIATIONS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                For affiliated colleges — leave empty if the institution awards its own degrees.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="affiliationCode" className="text-xs font-semibold text-slate-600">
                Affiliation Code
              </label>
              <Input
                id="affiliationCode"
                value={affiliationCode}
                disabled={pending}
                onChange={(e) => setAffiliationCode(e.target.value)}
                placeholder="University-assigned college code"
                className="bg-white/80"
              />
            </div>
          </div>
        </div>
      )}

      {/* MoE registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="moeRegNo" className="text-xs font-semibold text-slate-600">
            MoE Registration No.
          </label>
          <Input
            id="moeRegNo"
            value={moeRegNo}
            disabled={pending}
            onChange={(e) => setMoeRegNo(e.target.value)}
            placeholder="Ministry of Education registration number"
            className="bg-white/80"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
        <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 font-medium leading-relaxed">
          Switching to College or University unlocks higher-education sections
          (Programmes, Semesters, LMS{institutionType === "UNIVERSITY" ? ", Thesis & Research" : ""})
          as those modules roll out. Existing K-12 data is never affected.
        </p>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty}>
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
