"use client"

import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

const ADD_ONS = [
  { id: "finance",   label: "Finance & Tax (IRD)",  price: 2000 },
  { id: "exam",      label: "Exam & CAS System",    price: 1500 },
  { id: "lms",       label: "Online Learning (LMS)", price: 2500 },
  { id: "transport", label: "Transport GPS",         price: 500  },
  { id: "app",       label: "Mobile App",            price: 833  },
  { id: "canteen",   label: "Canteen + Wallet",      price: 800  },
]

export function PricingCalculator() {
  const [students, setStudents] = React.useState([100])
  const [selected, setSelected] = React.useState<string[]>([])

  const total =
    students[0] * 10 +
    selected.reduce((acc, id) => acc + (ADD_ONS.find(a => a.id === id)?.price ?? 0), 0)

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Config */}
        <div className="lg:col-span-3 space-y-8 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl border border-white/40 dark:border-white/10 shadow-xl">
          <div className="space-y-5">
            <div className="flex justify-between items-end">
              <Label className="text-base font-bold">Number of Students</Label>
              <span className="text-3xl font-extrabold text-primary">{students[0]}</span>
            </div>
            <Slider defaultValue={[100]} max={2000} step={10} onValueChange={setStudents} className="py-2" />
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>0 students</span><span>1000</span><span>2000+ students</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-bold block">Select Modules</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {ADD_ONS.map(addon => (
                <div
                  key={addon.id}
                  onClick={() => toggle(addon.id)}
                  role="checkbox"
                  aria-checked={selected.includes(addon.id)}
                  tabIndex={0}
                  onKeyDown={e => (e.key === " " || e.key === "Enter") && toggle(addon.id)}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer w-full select-none",
                    selected.includes(addon.id)
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                  )}
                >
                  <Checkbox checked={selected.includes(addon.id)} className="mt-0.5 data-[state=checked]:bg-primary pointer-events-none" />
                  <div>
                    <p className="font-bold text-sm">{addon.label}</p>
                    <p className="text-xs text-muted-foreground">Rs. {addon.price.toLocaleString()}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-primary/20 shadow-2xl shadow-primary/10">
          <div className="bg-primary p-8">
            <p className="text-primary-foreground/80 text-xs font-bold uppercase tracking-widest mb-2">Monthly Investment</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-white">Rs. {total.toLocaleString()}</span>
              <span className="text-primary-foreground/70 text-sm">/mo</span>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Core (Rs. 10/student)</span>
                <span className="font-bold">Rs. {(students[0] * 10).toLocaleString()}</span>
              </div>
              {selected.map(id => {
                const a = ADD_ONS.find(a => a.id === id)
                return (
                  <div key={id} className="flex justify-between">
                    <span className="text-muted-foreground">{a?.label}</span>
                    <span className="font-bold">Rs. {a?.price.toLocaleString()}</span>
                  </div>
                )
              })}
              <div className="pt-3 border-t flex justify-between font-bold">
                <span>Total / month</span>
                <span className="text-primary">Rs. {total.toLocaleString()}</span>
              </div>
            </div>
            <Link href="/onboarding" className="block">
              <Button className="w-full h-12 text-base font-bold cursor-pointer shadow-lg shadow-primary/20">
                Start Free Trial
              </Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground italic">* Excl. 13% VAT · 30-day free trial</p>
          </div>
        </div>
      </div>
    </div>
  )
}
