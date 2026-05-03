"use client"

import * as React from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Check, ChevronRight, ChevronLeft, School, Globe, Palette,
  UserPlus, Upload, ShieldCheck, Loader2, ExternalLink,
  PartyPopper, AlertCircle, Building2, Fingerprint, Sparkles,
  Terminal, Layers, CreditCard, GraduationCap, MapPin,
  Smartphone, Clock, ArrowRight, Wifi,
} from "lucide-react"
import { registerSchoolAction } from "./actions"
import { cn } from "@/lib/utils"
import { AddressFields, type AddressValue } from "@/components/ui/address-fields"
import { PROVINCES } from "@/lib/nepal-geography"

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: "Identity",   icon: Building2,   desc: "School details" },
  { id: 2, title: "Modules",    icon: Layers,       desc: "Features & pricing" },
  { id: 3, title: "Address",    icon: Globe,        desc: "Your subdomain" },
  { id: 4, title: "Aesthetics", icon: Palette,      desc: "Branding" },
  { id: 5, title: "Access",     icon: Fingerprint,  desc: "Admin account" },
]

const THEME_COLORS = [
  { name: "Emerald", hex: "#10b981", tw: "bg-emerald-500" },
  { name: "Sky",     hex: "#0ea5e9", tw: "bg-sky-500" },
  { name: "Indigo",  hex: "#6366f1", tw: "bg-indigo-500" },
  { name: "Violet",  hex: "#8b5cf6", tw: "bg-violet-500" },
  { name: "Rose",    hex: "#f43f5e", tw: "bg-rose-500" },
  { name: "Amber",   hex: "#f59e0b", tw: "bg-amber-500" },
  { name: "Slate",   hex: "#475569", tw: "bg-slate-500" },
  { name: "Red",     hex: "#dc2626", tw: "bg-red-600" },
]

const MODULES = [
  { key: "FINANCE_TAX",   label: "Finance & Tax",   desc: "IRD, fees, payroll, TDS & SSF",       price: 2000, icon: CreditCard,    badge: "IRD" },
  { key: "EXAM_CAS",      label: "Exam & CAS",      desc: "Grades 1–12, NEB GPA, report cards",  price: 1500, icon: GraduationCap, badge: "NEB" },
  { key: "TRANSPORT_GPS", label: "Transport GPS",   desc: "Bus tracking, route management",       price: 500,  icon: MapPin,        badge: "GPS" },
  { key: "MOBILE_APP",    label: "Mobile App",      desc: "Parent & student app",                 price: 833,  icon: Smartphone,    badge: "App" },
]

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

// ─── Input Field ─────────────────────────────────────────────────────────────

function Field({
  label, id, error, icon: Icon, hint, ...props
}: {
  label: string; id: string; error?: string; icon?: React.ElementType; hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {label}
        </label>
        {error && (
          <motion.span
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[11px] font-semibold text-rose-500 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" /> {error}
          </motion.span>
        )}
      </div>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          autoComplete="off"
          className={cn(
            "w-full h-11 bg-white/80 border rounded-xl text-sm font-medium transition-all outline-none",
            "placeholder:text-slate-400",
            Icon ? "pl-10 pr-4" : "px-4",
            error
              ? "border-rose-300 bg-rose-50/60 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function SelectField({
  label, id, error, options, ...props
}: {
  label: string; id: string; error?: string
  options: { value: string; label: string }[]
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "w-full h-11 bg-white/80 border rounded-xl text-sm font-medium transition-all outline-none px-4 cursor-pointer",
          error
            ? "border-rose-300 focus:border-rose-400"
            : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
        )}
        {...props}
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-[11px] font-semibold text-rose-500">{error}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const reduced = useReducedMotion()
  const [step, setStep] = React.useState(1)
  const [direction, setDirection] = React.useState(1)
  const [pending, setPending] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [provMsg, setProvMsg] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "school360.com.np"

  const [form, setForm] = React.useState({
    schoolName: "", panNumber: "", phone: "",
    address: { province: "", district: "", municipality: "", wardNo: "", street: "" } as AddressValue,
    selectedModules: [] as string[], studentCount: 100,
    slug: "", themeColor: "#10b981",
    adminName: "", adminEmail: "", adminPassword: "",
  })

  const totalCost = form.studentCount * 10 +
    form.selectedModules.reduce((a, k) => a + (MODULES.find(m => m.key === k)?.price ?? 0), 0)

  function set(key: string, value: unknown) {
    setForm(p => ({ ...p, [key]: value }))
    setErrors(p => { const e = { ...p }; delete e[key]; return e })
  }

  function toggleModule(key: string) {
    setForm(p => ({
      ...p,
      selectedModules: p.selectedModules.includes(key)
        ? p.selectedModules.filter(k => k !== key)
        : [...p.selectedModules, key],
    }))
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (form.schoolName.trim().length < 3) e.schoolName = "Min 3 chars"
      if (!/^\d{9}$/.test(form.panNumber)) e.panNumber = "9 digits required"
      if (form.phone.trim().length < 7) e.phone = "Invalid"
      if (!form.address.province)     e["address.province"]     = "Required"
      if (!form.address.district)     e["address.district"]     = "Required"
      if (!form.address.municipality) e["address.municipality"] = "Required"
      if (!form.address.wardNo)       e["address.wardNo"]       = "Required"
    }
    if (s === 3) {
      if (form.slug.trim().length < 3) e.slug = "Min 3 chars"
      else if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Lowercase & hyphens only"
    }
    if (s === 5) {
      if (form.adminName.trim().length < 3) e.adminName = "Required"
      if (!/\S+@\S+\.\S+/.test(form.adminEmail)) e.adminEmail = "Invalid email"
      if (form.adminPassword.length < 6) e.adminPassword = "Min 6 chars"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate(step)) return
    setDirection(1)
    setStep(s => Math.min(s + 1, 5))
  }

  function back() {
    setErrors({})
    setDirection(-1)
    setStep(s => Math.max(s - 1, 1))
  }

  async function deploy() {
    if (!validate(5)) return
    setPending(true)
    try {
      const logs = [
        "Validating registry…", "Uploading assets…",
        "Initializing tenant…", "Creating school record…",
        "Provisioning admin account…", "Activating modules…",
        "Setting up 30-day trial…", "Deploying…",
      ]
      for (const msg of logs) {
        setProvMsg(msg)
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400))
      }
      const formattedAddress = [
        form.address.street && `${form.address.street},`,
        form.address.wardNo && `Ward ${form.address.wardNo},`,
        form.address.municipality,
        form.address.district,
        PROVINCES.find(p => p.id === form.address.province)?.name,
      ].filter(Boolean).join(" ")

      const payload = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (k === "selectedModules" || k === "address") return
        payload.append(k, String(v))
      })
      payload.append("address", formattedAddress)
      payload.append("selectedModules", JSON.stringify(form.selectedModules))
      if (logoFile) payload.append("logo", logoFile)

      const res = await registerSchoolAction(payload)
      if (res.success) setSuccess(true)
      else setErrors({ global: res.error ?? "Registration failed." })
    } catch {
      setErrors({ global: "Deployment failed. Please try again." })
    } finally {
      setPending(false)
    }
  }

  // ─── Step variants ──────────────────────────────────────────────────────────
  const variants = {
    enter:   (d: number) => ({ opacity: 0, x: d * (reduced ? 0 : 24), filter: "blur(4px)" }),
    center:  { opacity: 1, x: 0, filter: "blur(0px)" },
    exit:    (d: number) => ({ opacity: 0, x: d * (reduced ? 0 : -24), filter: "blur(4px)" }),
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-md"
        >
          <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/50 shadow-2xl shadow-slate-900/10 p-10 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
              className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto shadow-xl shadow-primary/30"
            >
              <PartyPopper className="w-10 h-10 text-white" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-black tracking-tight">You're live!</h2>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                <strong>{form.schoolName}</strong> is deployed with a 30-day free trial.
              </p>
            </div>

            {form.selectedModules.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {form.selectedModules.map(k => {
                  const m = MODULES.find(m => m.key === k)
                  return (
                    <span key={k} className="text-[10px] font-bold bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {m?.label}
                    </span>
                  )
                })}
              </div>
            )}

            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Your Login URL</p>
              <div className="flex items-center justify-center gap-1.5 font-bold text-lg">
                <Globe className="w-5 h-5 text-primary" />
                <span className="text-primary">{form.slug}</span>
                <span className="text-slate-400">.{rootDomain}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 justify-center">
              <Clock className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
              <span className="font-semibold">30-day trial · Rs. {totalCost.toLocaleString()}/mo after</span>
            </div>

            <button
              onClick={() => {
                const h = window.location.host.replace("www.", "")
                window.location.href = `${window.location.protocol}//${form.slug}.${h}/login?msg=onboarded`
              }}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/25 transition-all cursor-pointer active:scale-[0.98]"
            >
              Go to Dashboard <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Extra ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-primary/12 blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-violet-500/8 blur-[80px]" />
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative w-full max-w-4xl bg-white/75 backdrop-blur-2xl rounded-3xl border border-white/50 shadow-2xl shadow-slate-900/12 overflow-hidden flex"
        style={{ minHeight: "620px" }}
      >

        {/* ── Left sidebar ── */}
        <div className="hidden lg:flex w-72 flex-col bg-gradient-to-b from-primary/6 to-primary/3 border-r border-white/50 p-8">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <School className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">School<span className="text-primary">360</span></span>
          </div>

          {/* Steps */}
          <div className="flex-1 relative">
            {/* Connecting line */}
            <div className="absolute left-4 top-4 bottom-4 w-px bg-slate-200" />
            {/* Progress fill */}
            <motion.div
              className="absolute left-4 top-4 w-px bg-primary origin-top"
              animate={{ height: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />

            <div className="space-y-7 relative">
              {STEPS.map((s, i) => {
                const isActive = step === s.id
                const isDone   = step > s.id
                const Icon = s.icon

                return (
                  <div key={s.id} className="flex items-start gap-3 pl-0">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        backgroundColor: isDone ? "#10b981" : isActive ? "#10b981" : "#fff",
                        borderColor: isDone || isActive ? "#10b981" : "#e2e8f0",
                      }}
                      transition={{ duration: 0.25 }}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 shadow-sm bg-white z-10 relative"
                    >
                      {isDone
                        ? <Check className="w-4 h-4 text-white" />
                        : isActive
                        ? <Icon className="w-3.5 h-3.5 text-white" />
                        : <span className="text-[11px] font-black text-slate-400">{s.id}</span>
                      }
                    </motion.div>
                    <motion.div
                      animate={{ opacity: isActive || isDone ? 1 : 0.45 }}
                      transition={{ duration: 0.25 }}
                      className="pt-1"
                    >
                      <p className={cn("text-sm font-bold leading-none", isActive ? "text-slate-900" : "text-slate-600")}>
                        {s.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
                    </motion.div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom trust */}
          <div className="mt-8 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/80 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Nepal-compliant ERP
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <Wifi className="w-3.5 h-3.5 text-primary" /> Works offline
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <Clock className="w-3.5 h-3.5 text-primary" /> 30 days free trial
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Terminal className="w-3 h-3" /> Nepal Central-01
            </div>
          </div>
        </div>

        {/* ── Right form area ── */}
        <div className="flex-1 flex flex-col min-h-0 relative">

          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between p-5 border-b border-white/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <School className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-base">School<span className="text-primary">360</span></span>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-full border border-primary/20">
              {step} / {STEPS.length}
            </span>
          </div>

          {/* Progress bar (mobile) */}
          <div className="lg:hidden h-0.5 bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${(step / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </div>

          {/* Deploying overlay */}
          <AnimatePresence>
            {pending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-white/96 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
              >
                <motion.div
                  className="w-20 h-20 relative mb-8"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent" />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-black mb-2">Deploying Your School</h3>
                <motion.p
                  key={provMsg}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <Loader2 className="w-3 h-3 animate-spin" /> {provMsg}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto px-8 py-8 lg:px-10 lg:py-10 custom-scrollbar">
            {/* Step heading */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black text-primary bg-primary/8 px-2.5 py-1 rounded-full border border-primary/20 uppercase tracking-widest">
                  Step {step} of {STEPS.length}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">{STEPS[step - 1].desc}</h2>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: EASE }}
              >
                {/* ─ Step 1: Identity ─ */}
                {step === 1 && (
                  <div className="space-y-5">
                    <Field label="School Name" id="schoolName" icon={Building2}
                      value={form.schoolName} onChange={e => set("schoolName", e.target.value)}
                      error={errors.schoolName} placeholder="e.g. Modern Gyan Academy" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="PAN Number" id="panNumber" maxLength={9}
                        value={form.panNumber} onChange={e => set("panNumber", e.target.value)}
                        error={errors.panNumber} placeholder="9 digits" />
                      <Field label="Phone" id="phone"
                        value={form.phone} onChange={e => set("phone", e.target.value)}
                        error={errors.phone} placeholder="+977-..." />
                    </div>
                    <AddressFields
                      value={form.address}
                      onChange={addr => set("address", addr)}
                      errors={{
                        province:     errors["address.province"],
                        district:     errors["address.district"],
                        municipality: errors["address.municipality"],
                        wardNo:       errors["address.wardNo"],
                      }}
                    />
                  </div>
                )}

                {/* ─ Step 2: Modules ─ */}
                {step === 2 && (
                  <div className="space-y-6">
                    {/* Trial banner */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-white">
                      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="relative">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="bg-white/20 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                            30 days free
                          </span>
                          <span className="bg-white/10 text-white/70 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                            No card required
                          </span>
                        </div>
                        <p className="font-black text-base">Full Access Trial</p>
                        <p className="text-primary-foreground/70 text-xs mt-0.5">All selected modules are free for 30 days.</p>
                      </div>
                    </div>

                    {/* Student count */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Students</label>
                        <span className="text-2xl font-black text-primary">{form.studentCount}</span>
                      </div>
                      <input type="range" min={10} max={2000} step={10}
                        value={form.studentCount}
                        onChange={e => set("studentCount", parseInt(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-primary/10" />
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>10</span><span>1000</span><span>2000+</span>
                      </div>
                    </div>

                    {/* Module cards */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {MODULES.map(mod => {
                        const active = form.selectedModules.includes(mod.key)
                        const Icon   = mod.icon
                        return (
                          <motion.button
                            key={mod.key}
                            type="button"
                            onClick={() => toggleModule(mod.key)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={cn(
                              "flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer w-full",
                              active
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                : "border-slate-100 bg-white/60 hover:border-slate-200 hover:bg-white/80"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                              active ? "bg-primary text-white shadow-md shadow-primary/25" : "bg-slate-100 text-slate-400"
                            )}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-sm text-slate-900">{mod.label}</span>
                                {active
                                  ? <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                  : <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{mod.badge}</span>
                                }
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{mod.desc}</p>
                              <p className="text-xs font-black text-primary mt-1.5">Rs. {mod.price.toLocaleString()}/mo</p>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* Cost preview */}
                    <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                      <div className="flex justify-between items-center text-sm font-medium text-slate-500 mb-1.5">
                        <span>Core ({form.studentCount} × Rs. 10)</span>
                        <span className="font-bold text-slate-900">Rs. {(form.studentCount * 10).toLocaleString()}</span>
                      </div>
                      {form.selectedModules.map(k => {
                        const m = MODULES.find(m => m.key === k)
                        return (
                          <div key={k} className="flex justify-between text-sm font-medium text-slate-500 mb-1.5">
                            <span>{m?.label}</span>
                            <span className="font-bold text-slate-900">Rs. {m?.price.toLocaleString()}</span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between pt-2 border-t border-slate-200 font-black">
                        <span>Total after trial</span>
                        <span className="text-primary">Rs. {totalCost.toLocaleString()}/mo</span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic mt-1.5">* Excluding 13% VAT</p>
                    </div>
                  </div>
                )}

                {/* ─ Step 3: Address ─ */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 text-sm text-primary font-medium leading-relaxed">
                      This identifier claims your dedicated infrastructure. Staff and students log in via this unique subdomain.
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Subdomain</label>
                      <div className={cn(
                        "flex rounded-2xl overflow-hidden border-2 transition-all focus-within:shadow-lg",
                        errors.slug ? "border-rose-300 focus-within:border-rose-400" : "border-slate-200 focus-within:border-primary"
                      )}>
                        <input
                          id="slug"
                          value={form.slug}
                          onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          placeholder="your-school"
                          className="flex-1 h-14 bg-white/60 px-5 text-xl font-black text-primary outline-none focus:bg-white"
                        />
                        <div className="px-4 bg-slate-50 border-l border-slate-100 flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          .{rootDomain}
                        </div>
                      </div>
                      {errors.slug && <p className="text-[11px] text-rose-500 font-bold">{errors.slug}</p>}
                      {!errors.slug && form.slug.length > 2 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Endpoint available
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─ Step 4: Aesthetics ─ */}
                {step === 4 && (
                  <div className="space-y-8">
                    <div className="grid sm:grid-cols-2 gap-8">
                      {/* Logo upload */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">School Logo</label>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setLogoFile(file)
                              const r = new FileReader()
                              r.onloadend = () => setLogoPreview(r.result as string)
                              r.readAsDataURL(file)
                            }
                          }}
                        />
                        <div
                          onClick={() => fileRef.current?.click()}
                          className="h-44 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/40 hover:bg-primary/2 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group relative overflow-hidden bg-white/50"
                        >
                          {logoPreview ? (
                            <>
                              <img src={logoPreview} className="h-full w-full object-contain p-4" alt="Logo preview" />
                              <div className="absolute inset-0 bg-primary/70 opacity-0 group-hover:opacity-100 flex items-center justify-center backdrop-blur-sm transition-all duration-300 rounded-2xl">
                                <Upload className="w-8 h-8 text-white" />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                              </div>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Logo</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Theme color */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Brand Color</label>
                        <div className="grid grid-cols-4 gap-3">
                          {THEME_COLORS.map(color => (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={() => set("themeColor", color.hex)}
                              className={cn(
                                "aspect-square rounded-xl border-4 transition-all cursor-pointer relative",
                                color.tw,
                                form.themeColor === color.hex
                                  ? "border-white scale-110 shadow-xl ring-2 ring-slate-300"
                                  : "border-transparent opacity-50 hover:opacity-80"
                              )}
                            >
                              {form.themeColor === color.hex && (
                                <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
                              )}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
                          Used in invoices, report cards, and your dashboard.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─ Step 5: Access ─ */}
                {step === 5 && (
                  <div className="space-y-5">
                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 flex gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        The Root Admin has full authority over finances, personnel, and configuration.
                      </p>
                    </div>

                    <Field label="Full Name" id="adminName" icon={UserPlus}
                      value={form.adminName} onChange={e => set("adminName", e.target.value)}
                      error={errors.adminName} placeholder="Principal or Director" />
                    <Field label="Email" id="adminEmail" type="email" icon={Globe}
                      value={form.adminEmail} onChange={e => set("adminEmail", e.target.value)}
                      error={errors.adminEmail} placeholder="admin@school.edu.np" />
                    <Field label="Password" id="adminPassword" type="password"
                      value={form.adminPassword} onChange={e => set("adminPassword", e.target.value)}
                      error={errors.adminPassword} placeholder="Minimum 6 characters" hint="Choose a strong password — this is the root account." />

                    {/* Summary */}
                    <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Activation Summary</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] font-black bg-slate-200/80 text-slate-600 px-2.5 py-1 rounded-full">Core Platform</span>
                        {form.selectedModules.map(k => {
                          const m = MODULES.find(m => m.key === k)
                          return (
                            <span key={k} className="text-[10px] font-black bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full">
                              {m?.label}
                            </span>
                          )
                        })}
                      </div>
                      <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        30-day free trial · Rs. {totalCost.toLocaleString()}/mo after
                      </p>
                    </div>

                    {errors.global && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-rose-700 font-medium"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {errors.global}
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer navigation ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-5 lg:px-10 border-t border-white/60 bg-white/40 backdrop-blur-sm">
            <button
              onClick={back}
              disabled={step === 1 || pending}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-0 h-10 px-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <motion.button
              onClick={step < 5 ? next : deploy}
              disabled={pending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 px-8 h-11 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/25 transition-colors cursor-pointer disabled:opacity-60"
            >
              {step < 5 ? (
                <>Next <ChevronRight className="w-4 h-4" /></>
              ) : (
                <><Sparkles className="w-4 h-4" /> Initialize School</>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}</style>
    </div>
  )
}
