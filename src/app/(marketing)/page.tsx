"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion"
import {
  ArrowRight, BookOpen, Building2, CheckCircle2, CreditCard,
  GraduationCap, Globe, Layers, Menu, ShieldCheck, Smartphone,
  Star, TrendingUp, Users, Wifi, X, Zap, UtensilsCrossed,
  CalendarDays, BarChart3, MapPin, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PricingCalculator } from "@/components/marketing/pricing-calculator"

// ─── Animation helpers ───────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 28, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
}

const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

function FadeIn({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const reduced = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial={reduced ? "visible" : "hidden"}
      animate={inView ? "visible" : "hidden"}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    if (!inView) return
    if (reduced) { setDisplay(value); return }
    let n = 0
    const step = Math.ceil(value / 40)
    const t = setInterval(() => {
      n = Math.min(n + step, value)
      setDisplay(n)
      if (n >= value) clearInterval(t)
    }, 35)
    return () => clearInterval(t)
  }, [inView, value, reduced])

  return <span ref={ref} className="tabular-nums">{display.toLocaleString()}{suffix}</span>
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  return (
    <motion.nav
      initial={reduced ? {} : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-white/30 dark:border-white/10 shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
          >
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </motion.div>
          <span className="font-bold text-lg tracking-tight">School<span className="text-primary">360</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {[
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "Compliance", href: "#compliance" },
            { label: "How it works", href: "#how-it-works" },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="cursor-pointer font-medium">Log in</Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm" className="cursor-pointer shadow-lg shadow-primary/25 font-semibold gap-1.5">
              Start Free Trial <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-border/40 px-6 pb-5 space-y-1"
        >
          {["Features", "Pricing", "Compliance", "How it works"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer">
              {l}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1">
              <Button variant="outline" size="sm" className="w-full cursor-pointer">Log in</Button>
            </Link>
            <Link href="/onboarding" className="flex-1">
              <Button size="sm" className="w-full cursor-pointer">Start Free Trial</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  )
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection() {
  const reduced = useReducedMotion()

  const heroVariants: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.1 } },
  }
  const heroItem: Variants = {
    hidden:  { opacity: 0, y: 30, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
  }

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-violet-500/8 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-blue-500/8 blur-[90px]" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #10b981 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-6 items-center">

          {/* Left: Copy */}
          <motion.div
            variants={reduced ? {} : heroVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <motion.div variants={heroItem}>
              <Badge className="bg-primary/10 text-primary border-primary/25 text-xs font-semibold px-3 py-1 cursor-default">
                <Zap className="w-3 h-3 mr-1.5" />
                Now with Flexible Grading Engine for Nepal Curriculum
              </Badge>
            </motion.div>

            <motion.h1 variants={heroItem}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]">
              The Operating System
              <br />
              for{" "}
              <span className="relative inline-block">
                <span className="text-primary">Nepal's</span>
              </span>
              <br />
              Modern Schools
            </motion.h1>

            <motion.p variants={heroItem}
              className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              From Kindergarten to Master's — IRD compliant, NEB integrated, offline capable.
              Built for Nepal's unique educational system.
            </motion.p>

            <motion.div variants={heroItem} className="flex flex-wrap gap-3">
              <Link href="/onboarding">
                <Button size="lg" className="h-12 px-8 text-base font-bold cursor-pointer shadow-xl shadow-primary/25 gap-2">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base font-medium cursor-pointer gap-2 hover:bg-primary/5 hover:border-primary/40">
                  Explore Features <ChevronRight className="w-4 h-4" />
                </Button>
              </a>
            </motion.div>

            <motion.div variants={heroItem} className="flex flex-wrap gap-x-6 gap-y-2">
              {["30-day free trial", "No credit card required", "Nepal-built & hosted"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: Glass mockup */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="relative lg:flex lg:justify-end"
          >
            <motion.div
              animate={reduced ? {} : { y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-lg"
            >
              {/* Main dashboard mockup */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-white/10 shadow-2xl shadow-slate-900/15 p-6 space-y-4">
                {/* Header bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold">School360</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>

                {/* Hero card */}
                <div className="bg-gradient-to-br from-primary/90 to-primary rounded-xl p-4 text-white">
                  <p className="text-primary-foreground/70 text-xs font-medium mb-0.5">Academic Year 2081/82</p>
                  <h3 className="text-base font-bold">Shree Gyan Secondary School</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["SSF", "TDS", "NEB", "IRD"].map(t => (
                      <span key={t} className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Students", value: "342", color: "text-blue-600", bg: "bg-blue-500/8" },
                    { label: "Classes",  value: "12",  color: "text-primary",   bg: "bg-primary/8" },
                    { label: "Staff",    value: "28",  color: "text-violet-600", bg: "bg-violet-500/8" },
                    { label: "Subjects", value: "64",  color: "text-amber-600",  bg: "bg-amber-500/8" },
                  ].map(s => (
                    <div key={s.label} className={cn("rounded-xl p-2.5 text-center", s.bg)}>
                      <div className={cn("text-lg font-black", s.color)}>{s.value}</div>
                      <div className="text-[9px] text-muted-foreground font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Setup Progress</span>
                    <span className="font-bold text-primary">80%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-primary/10">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "80%" }}
                      transition={{ duration: 1, delay: 1, ease: EASE }}
                    />
                  </div>
                </div>

                {/* Mini module pills */}
                <div className="flex flex-wrap gap-1.5">
                  {["Finance", "Exam & CAS", "Transport", "LMS", "Canteen"].map(m => (
                    <span key={m} className="text-[10px] font-semibold bg-primary/8 text-primary px-2 py-1 rounded-full border border-primary/15">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Floating badge cards */}
              <motion.div
                animate={reduced ? {} : { y: [0, -6, 0] }}
                transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/15 shadow-xl p-3 flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">IRD Compliant</p>
                  <p className="text-xs font-bold">Nepal Tax Ready</p>
                </div>
              </motion.div>

              <motion.div
                animate={reduced ? {} : { y: [0, -8, 0] }}
                transition={{ duration: 3.5, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-4 -left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/15 shadow-xl p-3 flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">NEB Integrated</p>
                  <p className="text-xs font-bold">CBC → NEB → TU</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────
function StatsStrip() {
  const stats = [
    { value: 500,  suffix: "+", label: "Schools" },
    { value: 120000, suffix: "+", label: "Students" },
    { value: 77, suffix: "", label: "Districts Covered" },
    { value: 30, suffix: "+", label: "Day Free Trial" },
  ]

  return (
    <FadeIn>
      <div className="border-y border-border/40 bg-white/50 dark:bg-slate-900/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={s.label} className="text-center space-y-1">
                <div className="text-3xl lg:text-4xl font-black text-primary">
                  <Counter value={s.value} suffix={s.suffix} />
                </div>
                <div className="text-sm text-muted-foreground font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

// ─── Features Section ─────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: ShieldCheck,
      color: "text-emerald-600", bg: "bg-emerald-500/10",
      title: "Nepal-First Compliance",
      description: "Built around Nepal's tax and education laws — IRD e-billing, SSF contributions, TDS brackets, MoE reports, NEB integration. Never manually calculate again.",
      pills: ["IRD", "SSF", "TDS", "MoE", "NEB", "CDC"],
      large: true,
    },
    {
      icon: BookOpen,
      color: "text-blue-600", bg: "bg-blue-500/10",
      title: "Adaptive Grading Engine",
      description: "CBC competency for Grades 1–3, CDC for 4–8, NEB GPA for 9–12, TU SGPA/CGPA for Bachelor's. When Nepal changes its curriculum — just update the template, no code changes.",
      pills: ["CBC", "CDC", "SEE", "NEB", "TU", "KU"],
    },
    {
      icon: Layers,
      color: "text-violet-600", bg: "bg-violet-500/10",
      title: "Full ERP — One Platform",
      description: "Finance, payroll, HR, transport, canteen, library, hostel, procurement, LMS — all connected, all in one login.",
      pills: ["9 Modules", "Multi-Tenant", "Offline Ready"],
    },
    {
      icon: Wifi,
      color: "text-primary", bg: "bg-primary/10",
      title: "Works Offline",
      description: "Nepal's infrastructure isn't always reliable. School360 keeps working and syncs when connectivity is restored.",
    },
    {
      icon: Globe,
      color: "text-amber-600", bg: "bg-amber-500/10",
      title: "Bikram Sambat Native",
      description: "Every date, calendar, and report uses BS by default with AD conversion built-in.",
    },
  ]

  return (
    <section id="features" className="py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Everything your school needs.
            <br />
            <span className="text-primary">Nothing it doesn't.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Designed ground-up for Nepal's K-12 through Master's educational system.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}
              className={cn(f.large && "md:col-span-2 lg:col-span-1")}>
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-full bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/8 shadow-sm hover:shadow-xl hover:shadow-slate-900/8 transition-shadow p-6 space-y-4 cursor-default"
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", f.bg)}>
                  <f.icon className={cn("w-5 h-5", f.color)} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </div>
                {f.pills && (
                  <div className="flex flex-wrap gap-1.5">
                    {f.pills.map(p => (
                      <span key={p} className="text-[10px] font-bold bg-muted/60 text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Compliance Section ───────────────────────────────────────────────────────
function ComplianceSection() {
  const items = [
    { label: "IRD e-Billing",     desc: "VAT invoices & CBMS",   icon: CreditCard,   color: "text-amber-600",  bg: "bg-amber-500/8" },
    { label: "SSF",               desc: "11% + 20% calculation", icon: ShieldCheck,  color: "text-emerald-600",bg: "bg-emerald-500/8" },
    { label: "TDS",               desc: "FY 2081/82 brackets",   icon: TrendingUp,   color: "text-blue-600",   bg: "bg-blue-500/8" },
    { label: "NEB",               desc: "Grade 9–12 GPA",        icon: Star,         color: "text-primary",    bg: "bg-primary/8" },
    { label: "CDC / CBC",         desc: "Grades 1–8 system",     icon: BookOpen,     color: "text-violet-600", bg: "bg-violet-500/8" },
    { label: "MoE Reports",       desc: "EMIS-compatible export", icon: BarChart3,    color: "text-rose-600",   bg: "bg-rose-500/8" },
    { label: "Bikram Sambat",     desc: "Native BS dates",       icon: CalendarDays, color: "text-indigo-600", bg: "bg-indigo-500/8" },
    { label: "PAN / 9-digit",     desc: "IRD identity validation",icon: CheckCircle2, color: "text-teal-600",   bg: "bg-teal-500/8" },
  ]

  return (
    <section id="compliance" className="py-24 bg-slate-50/60 dark:bg-slate-950/40 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-14">
          <Badge className="mb-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400">Nepal Compliance</Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Built around the laws of Nepal.
            <br />
            Not adapted for them.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every regulation, every report format, every calculation — built-in from day one.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item, i) => (
            <FadeIn key={item.label} delay={i * 0.05}>
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/8 p-5 text-center space-y-3 cursor-default shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto", item.bg)}>
                  <item.icon className={cn("w-5 h-5", item.color)} />
                </div>
                <div>
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Modules Section ──────────────────────────────────────────────────────────
function ModulesSection() {
  const modules = [
    { icon: CreditCard,    label: "Finance & Tax",    price: 2000, desc: "Fees, payroll, IRD billing" },
    { icon: BookOpen,      label: "Exam & CAS",       price: 1500, desc: "Grades 1–12, report cards" },
    { icon: Layers,        label: "Online Learning",  price: 2500, desc: "LMS, live classes, quizzes" },
    { icon: MapPin,        label: "Transport GPS",    price: 500,  desc: "Bus tracking, routes" },
    { icon: Smartphone,    label: "Mobile App",       price: 833,  desc: "Parent & student app" },
    { icon: UtensilsCrossed, label: "Canteen Wallet", price: 800,  desc: "Student wallet & MDM" },
    { icon: Users,         label: "HR & Staff",       price: 0,    desc: "Included in core" },
    { icon: GraduationCap, label: "Higher Education", price: 3000, desc: "Bachelor's & Master's" },
    { icon: BarChart3,     label: "Reports",          price: 0,    desc: "Included in core" },
  ]

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">Modules</Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Pay only for what you use.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start with core, add modules as your school grows.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {modules.map((mod, i) => (
            <FadeIn key={mod.label} delay={i * 0.05}>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.18 }}
                className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/8 p-5 space-y-3 cursor-default shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                  <mod.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">{mod.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                </div>
                <div className="text-xs font-bold">
                  {mod.price === 0
                    ? <span className="text-emerald-600">Included free</span>
                    : <span className="text-muted-foreground">Rs. {mod.price.toLocaleString()}<span className="font-normal">/mo</span></span>
                  }
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Register & Choose Modules",
      desc: "Fill out your school's details, select the modules you need, and start your 30-day free trial — no credit card required.",
      icon: Building2,
    },
    {
      step: "02",
      title: "Set Up Your School",
      desc: "Add your classes, sections, subjects, and staff. Import students via CSV or enroll them one by one.",
      icon: Users,
    },
    {
      step: "03",
      title: "Go Live Instantly",
      desc: "Your school goes live on its own subdomain. Students, parents, and staff access from any device — online or offline.",
      icon: Zap,
    },
  ]

  return (
    <section id="how-it-works" className="py-24 bg-slate-50/60 dark:bg-slate-950/40 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Up and running in minutes.
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {steps.map((step, i) => (
            <FadeIn key={step.step} delay={i * 0.12}>
              <div className="relative text-center space-y-4">
                <div className="relative inline-flex">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25 mx-auto">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-primary text-primary text-[10px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing Section ─────────────────────────────────────────────────────────
function PricingSection() {
  return (
    <section id="pricing" className="py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Pay only for what you use.
            <br />
            <span className="text-primary">Transparent. No surprises.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Rs. 10/student/month core. Add modules as needed. 30 days free.
          </p>
        </FadeIn>
        <FadeIn>
          <PricingCalculator />
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <FadeIn>
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative overflow-hidden rounded-3xl iris-overlay">
            <div className="relative z-10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-3xl p-12 space-y-6 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30 mx-auto">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Nepal's most complete
                <br />
                school management platform.
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Join schools across Nepal who manage academics, finance, HR, and compliance from one place.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/onboarding">
                  <Button size="lg" className="h-12 px-10 text-base font-bold cursor-pointer shadow-xl shadow-primary/25 gap-2">
                    Start Free Trial <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                {["30 days free", "No credit card", "Cancel anytime", "Nepal-hosted"].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border/40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">School<span className="text-primary">360</span></span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nepal's modern school ERP — built for K-12 through Master's.
            </p>
            <p className="text-xs text-muted-foreground">Made with ❤️ in Nepal 🇳🇵</p>
          </div>

          {[
            { title: "Product", links: ["Features", "Pricing", "Modules", "Compliance", "Changelog"] },
            { title: "Education", links: ["K-12 Schools", "Colleges", "Universities", "Government Schools"] },
            { title: "Company", links: ["About", "Privacy Policy", "Terms of Service", "Contact"] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="font-bold text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© 2081 School360. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">IRD Registered · Kathmandu, Nepal</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsStrip />
        <FeaturesSection />
        <ComplianceSection />
        <ModulesSection />
        <HowItWorksSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
