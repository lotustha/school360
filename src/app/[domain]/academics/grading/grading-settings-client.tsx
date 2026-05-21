"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Award, RotateCcw, Save, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { saveGradingSettings } from "@/actions/grading"
import {
  DEFAULT_GRADING_SETTINGS,
  type ResolvedGradingSettings,
  type GradeRow,
} from "@/lib/grading-config"

// Grade colour map
const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  "A":  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  "B+": { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-300" },
  "B":  { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  "C+": { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300" },
  "C":  { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200" },
  "D":  { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-300" },
  "NG": { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-300" },
}

interface Props {
  schoolId:        string
  initialSettings: ResolvedGradingSettings
}

export function GradingSettingsClient({ schoolId, initialSettings }: Props) {
  const [settings, setSettings] = useState<ResolvedGradingSettings>(initialSettings)
  const [pending,  startT]      = useTransition()

  function updateScale(index: number, field: keyof GradeRow, value: string | number) {
    setSettings(prev => ({
      ...prev,
      scale: prev.scale.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }))
  }

  function handleSave() {
    startT(async () => {
      try {
        await saveGradingSettings(schoolId, settings)
        toast.success("Grading settings saved")
      } catch {
        toast.error("Failed to save grading settings")
      }
    })
  }

  function handleReset() {
    setSettings(DEFAULT_GRADING_SETTINGS)
    toast.info("Reset to NEB defaults (not yet saved)")
  }

  const passGrade = settings.scale.find(r => r.minPercent <= settings.passPercent)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Award className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Grading Settings</h2>
            <p className="text-sm text-muted-foreground">NEB grade scale and pass mark configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <RotateCcw className="w-3.5 h-3.5" /> Reset to NEB
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Pass marks setting */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-sm">Pass Percentage</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Minimum overall percentage required to pass a subject
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.passPercent}
                onChange={e => setSettings(prev => ({ ...prev, passPercent: Number(e.target.value) }))}
                className="h-10 w-24 text-center font-bold text-lg bg-white border-slate-200 rounded-xl pr-7"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
            </div>
            {passGrade && (
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold border",
                GRADE_COLORS[passGrade.grade]?.bg,
                GRADE_COLORS[passGrade.grade]?.text,
                GRADE_COLORS[passGrade.grade]?.border,
              )}>
                Grade {passGrade.grade}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* NEB info */}
      <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4">
        <div className="flex gap-2.5">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>NEB Standard:</strong> Nepal Examination Board uses a GPA system for grades 11–12.
            The minimum pass is <strong>35%</strong> per subject with a combined pass mark requirement.
            Grades are calculated on final external + internal marks combined.
          </p>
        </div>
      </div>

      {/* Grade scale table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Grade Scale</p>
            <p className="text-xs text-muted-foreground">Minimum percentage thresholds for each grade</p>
          </div>
          <span className="text-xs text-muted-foreground">{settings.scale.length} grades</span>
        </div>

        <div className="divide-y divide-slate-100/60">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/60">
            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Grade</div>
            <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">GPA</div>
            <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Min %</div>
            <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</div>
          </div>

          {settings.scale.map((row, i) => {
            const colors = GRADE_COLORS[row.grade] ?? { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" }
            const isPassThreshold = row.minPercent === settings.passPercent ||
              (i > 0 && settings.scale[i - 1].minPercent > settings.passPercent && row.minPercent <= settings.passPercent)

            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-12 gap-3 px-5 py-3 items-center",
                  isPassThreshold && "bg-amber-50/40 border-l-2 border-amber-400",
                )}
              >
                <div className="col-span-2">
                  <span className={cn(
                    "inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-black border",
                    colors.bg, colors.text, colors.border
                  )}>
                    {row.grade}
                  </span>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    max="4"
                    step="0.1"
                    value={row.gpa}
                    onChange={e => updateScale(i, "gpa", parseFloat(e.target.value) || 0)}
                    className="h-8 text-center text-xs font-semibold bg-white border-slate-200 rounded-lg"
                  />
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={row.minPercent}
                      onChange={e => updateScale(i, "minPercent", parseInt(e.target.value) || 0)}
                      className="h-8 text-center text-xs font-semibold bg-white border-slate-200 rounded-lg flex-1"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="col-span-5">
                  <Input
                    value={row.description}
                    onChange={e => updateScale(i, "description", e.target.value)}
                    className="h-8 text-xs bg-white border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Visual grade bar */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-600 mb-3">Grade Distribution Preview</p>
        <div className="flex rounded-xl overflow-hidden h-8 gap-px">
          {settings.scale.map((row, i) => {
            const next        = settings.scale[i + 1]
            const width       = next ? row.minPercent - next.minPercent : row.minPercent
            const colors      = GRADE_COLORS[row.grade]
            return (
              <div
                key={row.grade}
                className={cn("flex items-center justify-center text-[10px] font-black transition-all", colors?.bg, colors?.text)}
                style={{ flex: width }}
                title={`${row.grade}: ${next ? `${next.minPercent}–${row.minPercent}%` : `0–${row.minPercent}%`}`}
              >
                {width >= 8 ? row.grade : ""}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-400">0%</span>
          <span className="text-[10px] text-slate-400">100%</span>
        </div>
      </div>
    </div>
  )
}
