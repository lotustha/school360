"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Check, ChevronRight, ChevronLeft, User, MapPin, BookOpen, Users, Shield, LogIn, GraduationCap, Save } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AddressFields, type AddressValue } from "@/components/ui/address-fields"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { NepaliTextInput } from "@/components/ui/nepali-text-input"
import { AvatarUploader } from "@/components/ui/avatar-uploader"
import { enrollStudent, getNextRollNumber, getNextSymbolNumber } from "@/actions/students"
import {
  GENDER_OPTIONS, BLOOD_GROUPS, NEPAL_RELIGIONS, EMIS_ETHNICITY_GROUPS,
  MOTHER_TONGUE_OPTIONS, NATIONALITY_OPTIONS, DISABILITY_OPTIONS,
  SCHOLARSHIP_TYPES, EDUCATION_LEVELS, GUARDIAN_RELATIONS,
} from "@/lib/nepal-data"

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  // Step 1: Personal
  avatarUrl:         z.string().optional(),
  fullName:          z.string().min(2, "Full name required"),
  fullNameNepali:    z.string().optional(),
  dobBS:             z.string().optional(),
  gender:            z.string().optional(),
  bloodGroup:        z.string().optional(),
  nationality:       z.string().optional(),
  // Step 2: Identity
  birthCertNo:       z.string().optional(),
  nationalIdNo:      z.string().optional(),
  emisNumber:        z.string().optional(),
  religion:          z.string().optional(),
  ethnicity:         z.string().optional(),
  motherTongue:      z.string().optional(),
  // Step 3: Address — handled separately via AddressValue state
  temporaryAddress:  z.string().optional(),
  // Step 4: Academic
  classId:           z.string().min(1, "Select a class"),
  sectionId:         z.string().optional(),
  academicYearId:    z.string().min(1, "Select a session"),
  rollNumber:        z.string().optional(),
  nebRegistrationNo: z.string().optional(),
  symbolNumber:      z.string().optional(),
  previousSchool:    z.string().optional(),
  transferCertNo:    z.string().optional(),
  // Step 5: Parents
  fatherName:        z.string().optional(),
  fatherPhone:       z.string().optional(),
  fatherOccupation:  z.string().optional(),
  fatherEducation:   z.string().optional(),
  motherName:        z.string().optional(),
  motherPhone:       z.string().optional(),
  motherOccupation:  z.string().optional(),
  motherEducation:   z.string().optional(),
  guardianName:      z.string().optional(),
  guardianPhone:     z.string().optional(),
  guardianRelation:  z.string().optional(),
  // Step 6: EMIS + Login
  disabilityStatus:  z.string().optional(),
  isResidential:     z.boolean().optional(),
  scholarshipType:   z.string().optional(),
  distanceKm:        z.string().optional(),
  freeTextbook:      z.boolean().optional(),
  email:             z.string().email("Enter a valid email").optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

// Shared cross-page memory (faculty / session / class / section).
import { loadGlobalCtx, saveGlobalCtx } from "@/lib/global-context"

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  schoolId:       string
  slug:           string
  faculties:      { id: string; name: string }[]
  classes:        { id: string; name: string; facultyId: string | null; facultyName?: string | null; sections: { id: string; name: string }[] }[]
  academicYears?: { id: string; name: string; isCurrent: boolean; facultyId?: string | null }[]
}

// ─── Step config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Essentials", icon: GraduationCap },
  { id: 2, label: "Personal",   icon: User },
  { id: 3, label: "Identity",   icon: Shield },
  { id: 4, label: "Address",    icon: MapPin },
  { id: 5, label: "Parents",    icon: Users },
  { id: 6, label: "EMIS",      icon: LogIn },
]

// ─── Field section header ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1 pb-2">
      {children}
    </p>
  )
}

// ─── Shared input classes ─────────────────────────────────────────────────────

const inputCls  = "h-11 bg-white border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
const selectCls = "h-11 bg-white border-slate-200 rounded-xl text-sm cursor-pointer text-slate-900 data-[placeholder]:text-slate-400"

// ─── Individual step forms ────────────────────────────────────────────────────

function Step2Personal({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const avatarUrl = form.watch("avatarUrl")
  return (
    <div className="space-y-4">
      <SectionLabel>Photo</SectionLabel>
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <AvatarUploader
          value={avatarUrl || null}
          onChange={(url) => form.setValue("avatarUrl", url ?? "")}
          size={64}
        />
      </div>

      <SectionLabel>Personal Information</SectionLabel>

      <FormField control={form.control} name="fullNameNepali" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name (Nepali)</FormLabel>
          <FormControl>
            <NepaliTextInput
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="राम बहादुर थापा"
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )} />

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="dobBS" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Date of Birth (BS)</FormLabel>
            <FormControl>
              <NepaliDateInput
                value={field.value ?? ""}
                onChange={field.onChange}
                maxYear={2090}
                minYear={2040}
              />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )} />
        <FormField control={form.control} name="gender" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Gender</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage className="text-xs" />
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="bloodGroup" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Blood Group</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="nationality" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Nationality</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? "Nepali"}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{NATIONALITY_OPTIONS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>
    </div>
  )
}

function Step3Identity({ form, schoolId, formResetKey }: {
  form:         ReturnType<typeof useForm<FormValues>>
  schoolId:     string
  formResetKey: number
}) {
  // Symbol Number auto-suggestion — class is picked in Step 1; suggestion runs here on mount + when class changes.
  const classId = form.watch("classId")
  const [autoSymbol,   setAutoSymbol]   = React.useState<string | null>(null)
  const [symbolLoading,setSymbolLoading]= React.useState(false)
  const [symbolDirty,  setSymbolDirty]  = React.useState(false)

  // Reset dirty flag whenever a save occurs so the auto-suggest takes over again.
  React.useEffect(() => { setSymbolDirty(false) }, [formResetKey])

  React.useEffect(() => {
    if (!classId) { setAutoSymbol(null); return }
    setSymbolLoading(true)
    getNextSymbolNumber(schoolId, classId)
      .then(sym => {
        setAutoSymbol(sym || null)
        if (!symbolDirty && sym && !form.getValues("symbolNumber")) {
          form.setValue("symbolNumber", sym)
        }
      })
      .finally(() => setSymbolLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, schoolId, formResetKey])

  return (
    <div className="space-y-4">
      <SectionLabel>Identity Documents & Demographics</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="birthCertNo" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Birth Cert. No</FormLabel>
            <FormControl><Input placeholder="e.g. 2068-001234" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="nationalIdNo" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">National ID / Citizenship</FormLabel>
            <FormControl><Input placeholder="For students 16+" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="emisNumber" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">EMIS Number</FormLabel>
          <FormControl><Input placeholder="Nepal DoE EMIS student ID" className={inputCls} {...field} /></FormControl>
        </FormItem>
      )} />

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="religion" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Religion</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{NEPAL_RELIGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="ethnicity" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Ethnicity (EMIS)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{EMIS_ETHNICITY_GROUPS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="motherTongue" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Mother Tongue</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select language" /></SelectTrigger></FormControl>
            <SelectContent>{MOTHER_TONGUE_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </FormItem>
      )} />

      <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>EMIS Note:</strong> Ethnicity and mother tongue are required by DoE for national education statistics reporting.
        </p>
      </div>

      <SectionLabel>Exam Identifiers</SectionLabel>

      <FormField control={form.control} name="nebRegistrationNo" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">NEB Reg. No</FormLabel>
          <FormControl><Input placeholder="Grade 11–12 only" className={`${inputCls} font-mono`} {...field} /></FormControl>
        </FormItem>
      )} />

      <FormField control={form.control} name="symbolNumber" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1.5">
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0">
              Symbol Number
            </FormLabel>
            {autoSymbol && symbolDirty && (
              <button
                type="button"
                onClick={() => { form.setValue("symbolNumber", autoSymbol); setSymbolDirty(false) }}
                className="text-[10px] text-primary hover:underline cursor-pointer font-semibold"
              >
                ↺ Use suggested ({autoSymbol})
              </button>
            )}
          </div>
          <FormControl>
            <Input
              placeholder={symbolLoading
                ? "Loading…"
                : autoSymbol
                  ? `Suggested: ${autoSymbol}`
                  : "e.g. 4340201 — assigned for board exams (SEE / NEB)"}
              className={`${inputCls} font-mono`}
              {...field}
              onChange={(e) => { field.onChange(e); setSymbolDirty(true) }}
            />
          </FormControl>
          <p className="text-[11px] text-slate-400 mt-1">
            {autoSymbol && !symbolDirty
              ? <>Auto-suggested from class. Edit to override.</>
              : <>Used for SEE (Grade 10) and NEB (Grade 11–12) board examinations.</>}
          </p>
        </FormItem>
      )} />

      <SectionLabel>Transfer Details (if applicable)</SectionLabel>
      <FormField control={form.control} name="previousSchool" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Previous School</FormLabel>
          <FormControl><Input placeholder="School name before transfer" className={inputCls} {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="transferCertNo" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Transfer Certificate No</FormLabel>
          <FormControl><Input placeholder="TC number" className={inputCls} {...field} /></FormControl>
        </FormItem>
      )} />
    </div>
  )
}

function Step4Address({
  address, setAddress, form,
}: {
  address: AddressValue
  setAddress: (v: AddressValue) => void
  form: ReturnType<typeof useForm<FormValues>>
}) {
  return (
    <div className="space-y-4">
      <SectionLabel>Permanent Address</SectionLabel>
      <AddressFields value={address} onChange={setAddress} variant="plain" />

      <SectionLabel>Temporary Address (if different)</SectionLabel>
      <FormField control={form.control} name="temporaryAddress" render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input placeholder="e.g. Kathmandu-10, Baneshwor" className={inputCls} {...field} />
          </FormControl>
        </FormItem>
      )} />
    </div>
  )
}

function Step1Essentials({
  form, faculties, classes, academicYears, schoolId, formResetKey,
}: {
  form:           ReturnType<typeof useForm<FormValues>>
  faculties:      Props["faculties"]
  classes:        Props["classes"]
  academicYears?: Props["academicYears"]
  schoolId:       string
  formResetKey:   number
}) {
  const NONE_FACULTY = "__none__"

  const classId   = form.watch("classId")
  const sectionId = form.watch("sectionId")
  const sections  = classes.find(c => c.id === classId)?.sections ?? []

  // Faculty cascade. Priority: explicit class (edit mode) → localStorage memory → General.
  // Never default to faculties[0] — user said "always pick General if nothing in memory".
  const [facultyKey, setFacultyKeyState] = React.useState<string>(() => {
    if (classId) {
      const cls = classes.find(c => c.id === classId)
      if (cls) return cls.facultyId ?? NONE_FACULTY
    }
    return loadGlobalCtx().facultyKey ?? NONE_FACULTY
  })
  const setFacultyKey = React.useCallback((v: string) => {
    setFacultyKeyState(v)
    saveGlobalCtx({ facultyKey: v })
  }, [])
  const facultyValue: string | null = facultyKey === NONE_FACULTY ? null : facultyKey

  const filteredYears = React.useMemo(() => {
    if (!academicYears) return []
    return academicYears.filter(y =>
      facultyValue === null ? (y.facultyId ?? null) === null : y.facultyId === facultyValue,
    )
  }, [academicYears, facultyValue])

  const filteredClasses = React.useMemo(() => {
    return classes.filter(c =>
      facultyValue === null ? c.facultyId === null : c.facultyId === facultyValue,
    )
  }, [classes, facultyValue])

  // When faculty changes: clear class+section, preselect latest session.
  const firstFacultyEffect = React.useRef(true)
  React.useEffect(() => {
    if (firstFacultyEffect.current) { firstFacultyEffect.current = false; return }
    form.setValue("classId", "")
    form.setValue("sectionId", "")
    const latest = filteredYears.find(y => y.isCurrent) ?? filteredYears[0]
    form.setValue("academicYearId", latest?.id ?? "")
    setOverriding(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyKey])

  // On first mount: resolve session. Preference:
  //   1. Memory's saved session — but only if it belongs to the resolved faculty.
  //   2. Latest (current) session for that faculty.
  React.useEffect(() => {
    if (form.getValues("academicYearId")) return
    if (filteredYears.length === 0) return
    const savedId = loadGlobalCtx().academicYearId
    const savedMatches = savedId ? filteredYears.some(y => y.id === savedId) : false
    if (savedMatches && savedId) {
      form.setValue("academicYearId", savedId)
    } else {
      const latest = filteredYears.find(y => y.isCurrent) ?? filteredYears[0]
      if (latest) form.setValue("academicYearId", latest.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [autoRoll,     setAutoRoll]     = React.useState<string | null>(null)
  const [overriding,   setOverriding]   = React.useState(false)
  const [loading,      setLoading]      = React.useState(false)

  // Auto-fetch roll number whenever class or section changes (or after a save resets the form).
  React.useEffect(() => {
    if (!classId) { setAutoRoll(null); return }
    setLoading(true)
    getNextRollNumber(schoolId, classId, sectionId || undefined)
      .then(roll => {
        setAutoRoll(roll)
        if (!overriding) form.setValue("rollNumber", roll)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId, schoolId, formResetKey])

  function startOverride() {
    setOverriding(true)
    form.setFocus("rollNumber")
  }

  function resetToAuto() {
    setOverriding(false)
    if (autoRoll) form.setValue("rollNumber", autoRoll)
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Essentials</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Faculty</FormLabel>
          <Select value={facultyKey} onValueChange={setFacultyKey}>
            <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Pick faculty" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value={NONE_FACULTY}>General (no faculty)</SelectItem>
              {faculties.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>

        <FormField control={form.control} name="academicYearId" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Session</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Pick session" /></SelectTrigger></FormControl>
              <SelectContent>
                {filteredYears.length === 0
                  ? <div className="px-2 py-1.5 text-xs italic text-slate-400">No sessions for this faculty</div>
                  : filteredYears.map(y => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                        {y.isCurrent && <span className="ml-2 text-[10px] text-emerald-600 font-bold">CURRENT</span>}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="classId" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Class *</FormLabel>
            <Select onValueChange={v => { field.onChange(v); setOverriding(false) }} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
              <SelectContent>
                {filteredClasses.length === 0
                  ? <div className="px-2 py-1.5 text-xs italic text-slate-400">No classes in this faculty</div>
                  : filteredClasses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
            <FormMessage className="text-xs" />
          </FormItem>
        )} />
        {sections.length > 0 && (
          <FormField control={form.control} name="sectionId" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Section</FormLabel>
              <Select onValueChange={v => { field.onChange(v); setOverriding(false) }} value={field.value}>
                <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormItem>
          )} />
        )}
      </div>

      {/* Roll Number — auto-generated, with override option */}
      <FormField control={form.control} name="rollNumber" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1.5">
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0">
              Roll Number
            </FormLabel>
            {!classId ? null : overriding ? (
              <button type="button" onClick={resetToAuto}
                className="text-[10px] text-primary hover:underline cursor-pointer font-semibold">
                ↺ Use auto
              </button>
            ) : (
              <button type="button" onClick={startOverride}
                className="text-[10px] text-slate-400 hover:text-primary cursor-pointer hover:underline">
                Override
              </button>
            )}
          </div>
          {overriding ? (
            <FormControl>
              <Input
                placeholder="Enter roll no."
                className={cn(inputCls, "border-amber-300 focus:ring-amber-400/20 focus:border-amber-400")}
                {...field}
              />
            </FormControl>
          ) : (
            <div className={cn(
              "h-11 flex items-center gap-2 px-3 rounded-xl border text-sm font-mono font-bold",
              loading
                ? "bg-slate-50 border-slate-200 text-slate-400 animate-pulse"
                : classId
                ? "bg-primary/6 border-primary/25 text-primary"
                : "bg-slate-50 border-slate-200 text-slate-400"
            )}>
              {loading ? "Loading…" : classId ? (
                <>
                  <span className="text-xs text-primary/60 font-normal">Auto</span>
                  <span>{field.value || "—"}</span>
                </>
              ) : "Select class first"}
            </div>
          )}
        </FormItem>
      )} />

      <FormField control={form.control} name="fullName" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name (English) *</FormLabel>
          <FormControl><Input placeholder="Ram Bahadur Thapa" className={inputCls} {...field} /></FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )} />

      <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Tip:</strong> These four fields are required. You can save now to enroll with admission no. only, or continue to fill personal / identity / address / parents on the next steps.
        </p>
      </div>
    </div>
  )
}

function Step5Parents({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Father</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="fatherName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Father&apos;s Name</FormLabel>
            <FormControl><Input placeholder="Full name" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="fatherPhone" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone</FormLabel>
            <FormControl><Input placeholder="+977-98..." className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="fatherOccupation" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Occupation</FormLabel>
            <FormControl><Input placeholder="e.g. Farmer" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="fatherEducation" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Education</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{EDUCATION_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <SectionLabel>Mother</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="motherName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Mother&apos;s Name</FormLabel>
            <FormControl><Input placeholder="Full name" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="motherPhone" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone</FormLabel>
            <FormControl><Input placeholder="+977-98..." className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="motherOccupation" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Occupation</FormLabel>
            <FormControl><Input placeholder="e.g. Homemaker" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="motherEducation" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Education</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{EDUCATION_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <SectionLabel>Other Guardian (if different)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="guardianName" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Guardian Name</FormLabel>
            <FormControl><Input placeholder="If not father/mother" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="guardianRelation" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Relation</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
              <SelectContent>{GUARDIAN_RELATIONS.filter(r => r !== "Father" && r !== "Mother").map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="guardianPhone" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Guardian Phone</FormLabel>
          <FormControl><Input placeholder="+977-98..." className={inputCls} {...field} /></FormControl>
        </FormItem>
      )} />
    </div>
  )
}

function Step6Emis({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  const isResidential = form.watch("isResidential")
  const freeTextbook  = form.watch("freeTextbook")

  return (
    <div className="space-y-4">
      <SectionLabel>EMIS Indicators</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="disabilityStatus" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Disability Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? "NONE"}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {DISABILITY_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="scholarshipType" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Scholarship</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? "NONE"}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {SCHOLARSHIP_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Residential</p>
          <button
            type="button"
            onClick={() => form.setValue("isResidential", !isResidential)}
            className={cn(
              "w-full h-11 rounded-xl border text-sm font-medium transition-all cursor-pointer",
              isResidential
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
            )}
          >
            {isResidential ? "Boarding Student" : "Day Scholar"}
          </button>
        </div>
        <FormField control={form.control} name="distanceKm" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Distance (km)</FormLabel>
            <FormControl><Input type="number" step="0.1" min="0" placeholder="0.5" className={inputCls} {...field} /></FormControl>
          </FormItem>
        )} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => form.setValue("freeTextbook", !freeTextbook)}
          className={cn(
            "h-6 w-10 rounded-full border transition-all cursor-pointer relative",
            freeTextbook ? "bg-primary border-primary" : "bg-white border-slate-300"
          )}
        >
          <div className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all",
            freeTextbook ? "left-[calc(100%-22px)]" : "left-0.5"
          )} />
        </button>
        <span className="text-sm text-slate-600">Free Textbook Received</span>
      </div>

      <SectionLabel>Login Account</SectionLabel>
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-slate-500">Email Address</FormLabel>
          <FormControl><Input type="email" placeholder="student@school.edu.np (optional)" className={inputCls} {...field} /></FormControl>
          <FormMessage className="text-xs" />
          <p className="text-[11px] text-slate-400 mt-1">
            Leave blank to auto-generate a placeholder. Default password: <code className="font-mono">student123</code>
          </p>
        </FormItem>
      )} />
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function StudentDrawer({ schoolId, slug, faculties, classes, academicYears }: Props) {
  const [open, setOpen]       = React.useState(false)
  const [step, setStep]       = React.useState(1)
  const [address, setAddress] = React.useState<AddressValue>({
    province: "", district: "", municipality: "", wardNo: "", street: "",
  })
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      avatarUrl: "",
      fullName: "", fullNameNepali: "", dobBS: "", gender: "",
      bloodGroup: "", nationality: "Nepali",
      birthCertNo: "", nationalIdNo: "", emisNumber: "", religion: "", ethnicity: "", motherTongue: "",
      temporaryAddress: "",
      classId: "", sectionId: "", academicYearId: "", rollNumber: "",
      nebRegistrationNo: "", symbolNumber: "", previousSchool: "", transferCertNo: "",
      fatherName: "", fatherPhone: "", fatherOccupation: "", fatherEducation: "",
      motherName: "", motherPhone: "", motherOccupation: "", motherEducation: "",
      guardianName: "", guardianPhone: "", guardianRelation: "",
      disabilityStatus: "NONE", isResidential: false,
      scholarshipType: "NONE", distanceKm: "", freeTextbook: false,
      email: "",
    },
  })

  const [formResetKey, setFormResetKey] = React.useState(0)

  function handleOpen(v: boolean) {
    setOpen(v)
    if (!v) {
      setStep(1)
      form.reset()
      setAddress({ province: "", district: "", municipality: "", wardNo: "", street: "" })
    }
  }

  // On open: restore Class/Section from local memory. Faculty + Session are
  // resolved inside Step1Essentials based on its (memory-backed) facultyKey, so
  // the session always matches the faculty's available sessions.
  React.useEffect(() => {
    if (!open) return
    const ctx = loadGlobalCtx()
    if (ctx.classId   && !form.getValues("classId"))   form.setValue("classId",   ctx.classId)
    if (ctx.sectionId && !form.getValues("sectionId")) form.setValue("sectionId", ctx.sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Persist cascade choices whenever the form's session/class/section change.
  const watchedAcademicYearId = form.watch("academicYearId")
  const watchedClassId        = form.watch("classId")
  const watchedSectionId      = form.watch("sectionId")
  React.useEffect(() => {
    if (!open) return
    saveGlobalCtx({
      academicYearId: watchedAcademicYearId || undefined,
      classId:        watchedClassId        || undefined,
      sectionId:      watchedSectionId      || undefined,
    })
  }, [open, watchedAcademicYearId, watchedClassId, watchedSectionId])

  async function handleNext() {
    // Validate required fields for current step
    const stepFields: Record<number, (keyof FormValues)[]> = {
      1: ["fullName", "academicYearId", "classId"],
    }
    const fields = stepFields[step]
    if (fields) {
      const ok = await form.trigger(fields)
      if (!ok) return
    }
    if (step < STEPS.length) setStep(s => s + 1)
  }

  async function onSubmit(values: FormValues) {
    const result = await enrollStudent(schoolId, slug, {
      ...values,
      province:     address.province,
      district:     address.district,
      municipality: address.municipality,
      wardNo:       address.wardNo,
      street:       address.street,
      distanceKm:   values.distanceKm ? Number(values.distanceKm) : undefined,
    })
    if (result.success) {
      toast.success(`Student enrolled — ${result.admissionNo}. Ready for the next one.`)
      // Keep the drawer open. Reset to a fresh form but preserve Faculty/Session/Class/Section
      // so the teacher can add the next student in the same context immediately.
      const keepCascade = {
        academicYearId: form.getValues("academicYearId"),
        classId:        form.getValues("classId"),
        sectionId:      form.getValues("sectionId"),
      }
      form.reset({
        avatarUrl: "",
        fullName: "", fullNameNepali: "", dobBS: "", gender: "",
        bloodGroup: "", nationality: "Nepali",
        birthCertNo: "", nationalIdNo: "", emisNumber: "", religion: "", ethnicity: "", motherTongue: "",
        temporaryAddress: "",
        rollNumber: "",
        nebRegistrationNo: "", symbolNumber: "", previousSchool: "", transferCertNo: "",
        fatherName: "", fatherPhone: "", fatherOccupation: "", fatherEducation: "",
        motherName: "", motherPhone: "", motherOccupation: "", motherEducation: "",
        guardianName: "", guardianPhone: "", guardianRelation: "",
        disabilityStatus: "NONE", isResidential: false,
        scholarshipType: "NONE", distanceKm: "", freeTextbook: false,
        email: "",
        ...keepCascade,
      })
      setAddress({ province: "", district: "", municipality: "", wardNo: "", street: "" })
      setStep(1)
      setFormResetKey(k => k + 1)
      router.refresh()
    } else {
      toast.error(result.error ?? "Enrollment failed")
    }
  }

  const totalSteps = STEPS.length

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}
        className="gap-1.5 cursor-pointer shadow-lg shadow-primary/20">
        <Plus className="w-4 h-4" /> Enroll Student
      </Button>

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent className="bg-white/92 backdrop-blur-2xl border-l border-slate-200/70 shadow-2xl w-full sm:max-w-xl p-0 flex flex-col">
          {/* Header */}
          <div className="px-7 pt-7 pb-4 border-b border-slate-100">
            <SheetTitle className="text-base font-bold text-slate-900">Enroll New Student</SheetTitle>
            <SheetDescription className="text-xs text-slate-500 mt-0.5">
              EMIS-compatible student registration — Step {step} of {totalSteps}
            </SheetDescription>

            {/* Stepper */}
            <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon   = s.icon
                const done   = step > s.id
                const active = step === s.id
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                        done   ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" :
                        active ? "bg-primary/10 text-primary ring-2 ring-primary/30" :
                                 "bg-slate-100 text-slate-400"
                      )}>
                        {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wide whitespace-nowrap",
                        active ? "text-primary" : done ? "text-slate-500" : "text-slate-300"
                      )}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={cn(
                        "h-px flex-1 min-w-[12px] mt-[-12px] transition-colors",
                        done ? "bg-primary/40" : "bg-slate-100"
                      )} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-7 py-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                  >
                    {step === 1 && <Step1Essentials form={form} faculties={faculties} classes={classes} academicYears={academicYears} schoolId={schoolId} formResetKey={formResetKey} />}
                    {step === 2 && <Step2Personal form={form} />}
                    {step === 3 && <Step3Identity form={form} schoolId={schoolId} formResetKey={formResetKey} />}
                    {step === 4 && <Step4Address address={address} setAddress={setAddress} form={form} />}
                    {step === 5 && <Step5Parents form={form} />}
                    {step === 6 && <Step6Emis form={form} />}
                  </motion.div>
                </AnimatePresence>
              </form>
            </Form>
          </div>

          {/* Footer nav */}
          <div className="px-7 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}
                className="gap-1.5 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            <div className="flex-1" />
            {step < totalSteps ? (
              <>
                <Button
                  variant="outline"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={form.formState.isSubmitting}
                  className="gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> {form.formState.isSubmitting ? "Saving…" : "Save now"}
                </Button>
                <Button onClick={handleNext} className="gap-1.5 cursor-pointer shadow-md shadow-primary/20">
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={form.formState.isSubmitting}
                className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 font-bold"
              >
                {form.formState.isSubmitting ? "Enrolling…" : "Enroll Student"}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
