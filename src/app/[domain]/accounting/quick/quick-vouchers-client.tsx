"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  GraduationCap, Heart, Wallet, Building2, Receipt,
  ArrowDownToLine, ArrowUpFromLine, Loader2, Zap, Settings2,
  Coins, CalendarDays,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NepaliDateInput } from "@/components/ui/nepali-date-input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { NarrationAutocomplete } from "@/components/accounting/narration-autocomplete"
import { PartyAutocomplete } from "@/components/accounting/party-autocomplete"
import { AddFeeHeadDialog } from "@/components/accounting/add-fee-head-dialog"
import { AccountPicker } from "@/components/accounting/account-picker"
import { cn } from "@/lib/utils"
import { todayBS } from "@/lib/nepali-date"
import { createAndPostQuickVoucher } from "@/actions/accounting/vouchers"
import {
  QUICK_TEMPLATES, type QuickTemplate, type QuickTemplateId,
  buildFeeReceipt, buildDonation, buildPaySalary, buildPayRent,
  buildPayExpense, buildDepositCash, buildWithdrawCash,
  buildDayFeeCollection, buildSalaryPayroll,
} from "@/lib/accounting-templates"

interface Account { id: string; code: string; name: string; type: string; subType: string | null; parentId: string | null }

interface Props {
  fiscalYearId:   string
  fiscalYearName: string
  presets:        Record<string, string>   // common account IDs by short key
  cashBalances:   Record<string, string>   // accountId → current cash balance (CASH accounts)
  accounts:       Account[]
}

// Group accounts (those that have children — e.g. the "1120 Bank Accounts" parent)
// are not postable; entries belong on the leaf cash/bank sub-accounts. This filters
// them out so selectors only offer real, postable accounts.
function leafAccounts(accounts: Account[]) {
  const groupIds = new Set(accounts.map(a => a.parentId).filter((p): p is string => !!p))
  const isLeaf = (a: Account) => !groupIds.has(a.id)
  return {
    cashOrBank:   accounts.filter(a => (a.subType === "CASH" || a.subType === "BANK") && isLeaf(a)),
    cashAccounts: accounts.filter(a => a.subType === "CASH" && isLeaf(a)),
    bankAccounts: accounts.filter(a => a.subType === "BANK" && isLeaf(a)),
  }
}

const ICON_MAP: Record<QuickTemplateId, React.ElementType> = {
  "day-fee-collection": Coins,
  "salary-payroll":     CalendarDays,
  "fee-receipt":        GraduationCap,
  "donation":           Heart,
  "pay-salary":         Wallet,
  "pay-rent":           Building2,
  "pay-expense":        Receipt,
  "deposit-cash":       ArrowDownToLine,
  "withdraw-cash":      ArrowUpFromLine,
}


const COLOR_MAP = {
  emerald: { bg: "bg-emerald-50",  text: "text-emerald-700",  ring: "ring-emerald-200/60", hover: "hover:border-emerald-300", icon: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  violet:  { bg: "bg-violet-50",   text: "text-violet-700",   ring: "ring-violet-200/60",  hover: "hover:border-violet-300",  icon: "text-violet-600",  iconBg: "bg-violet-500/10" },
  amber:   { bg: "bg-amber-50",    text: "text-amber-700",    ring: "ring-amber-200/60",   hover: "hover:border-amber-300",   icon: "text-amber-600",   iconBg: "bg-amber-500/10" },
  rose:    { bg: "bg-rose-50",     text: "text-rose-700",     ring: "ring-rose-200/60",    hover: "hover:border-rose-300",    icon: "text-rose-600",    iconBg: "bg-rose-500/10" },
  sky:     { bg: "bg-sky-50",      text: "text-sky-700",      ring: "ring-sky-200/60",     hover: "hover:border-sky-300",     icon: "text-sky-600",     iconBg: "bg-sky-500/10" },
  slate:   { bg: "bg-slate-50",    text: "text-slate-700",    ring: "ring-slate-200/60",   hover: "hover:border-slate-300",   icon: "text-slate-600",   iconBg: "bg-slate-500/10" },
} as const

export function QuickVouchersClient({ fiscalYearId, fiscalYearName, presets, accounts, cashBalances }: Props) {
  const [selected, setSelected] = useState<QuickTemplateId | null>(null)
  const tpl = selected ? QUICK_TEMPLATES.find(t => t.id === selected) ?? null : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quick Entry</h1>
          <p className="text-sm text-muted-foreground">Pick a voucher pattern — the form opens on the right.</p>
        </div>
        <Link href="/accounting/vouchers/new/RV">
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" /> Advanced (manual entry)
          </Button>
        </Link>
      </div>

      <TemplateGrid selected={selected ?? ""} onPick={setSelected} />

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent
          side="right"
          className="w-full sm:w-[60vw] sm:max-w-[60vw] overflow-y-auto p-0 bg-gradient-to-br from-slate-50 via-white to-slate-50"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{tpl?.title ?? "Quick voucher"}</SheetTitle>
            <SheetDescription>{tpl?.description}</SheetDescription>
          </SheetHeader>
          {tpl && (
            <div className="p-5">
              {/* key forces a fresh form state every time the user picks a different template */}
              <TemplateForm
                key={tpl.id}
                template={tpl}
                presets={presets}
                accounts={accounts}
                cashBalances={cashBalances}
                fiscalYearId={fiscalYearId}
                fiscalYearName={fiscalYearName}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Template grid ──────────────────────────────────────────────────────────

function TemplateGrid({ selected, onPick }: { selected: QuickTemplateId | ""; onPick: (id: QuickTemplateId) => void }) {
  const recommended = QUICK_TEMPLATES.filter(t => t.recommended)
  const standard    = QUICK_TEMPLATES.filter(t => !t.recommended)

  return (
    <div className="space-y-5">
      {recommended.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Recommended · Daily / Monthly Summary</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recommended.map(t => <TemplateTile key={t.id} t={t} onPick={onPick} recommended active={selected === t.id} />)}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Per-Party / Other</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {standard.map(t => <TemplateTile key={t.id} t={t} onPick={onPick} active={selected === t.id} />)}
        </div>
      </div>
    </div>
  )
}

function TemplateTile({ t, onPick, recommended, active }: { t: QuickTemplate; onPick: (id: QuickTemplateId) => void; recommended?: boolean; active?: boolean }) {
  const Icon = ICON_MAP[t.id]
  const c = COLOR_MAP[t.color]
  return (
    <button
      onClick={() => onPick(t.id)}
      className={cn(
        "text-left bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm relative",
        "p-5 transition-all duration-200 cursor-pointer",
        active
          ? "border-2 border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/15 -translate-y-0.5"
          : cn(
              "hover:-translate-y-1 hover:shadow-lg",
              recommended ? "border-2 border-primary/30" : "border border-white/40",
              c.hover,
            ),
      )}
    >
      {recommended && !active && (
        <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">★ Recommended</span>
      )}
      {active && (
        <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest text-primary-foreground bg-primary px-1.5 py-0.5 rounded shadow-sm">● Selected</span>
      )}
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", c.iconBg)}>
        <Icon className={cn("w-5 h-5", c.icon)} />
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="font-bold text-sm tracking-tight">{t.title}</p>
        <span className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", c.bg, c.text)}>{t.type}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
    </button>
  )
}

// ─── Template form ──────────────────────────────────────────────────────────

interface TemplateFormProps {
  template:       QuickTemplate
  presets:        Record<string, string>
  accounts:       Account[]
  cashBalances:   Record<string, string>
  fiscalYearId:   string
  fiscalYearName: string
}

function TemplateForm(props: TemplateFormProps) {
  // Lump-sum templates have substantially different field shapes, so they get
  // their own self-contained forms. Simple per-party templates fall through.
  if (props.template.id === "day-fee-collection") return <DayFeeCollectionForm {...props} />
  if (props.template.id === "salary-payroll")     return <SalaryPayrollForm {...props} />
  return <SimpleTemplateForm {...props} />
}

function SimpleTemplateForm({ template, presets, accounts, cashBalances, fiscalYearId, fiscalYearName }: TemplateFormProps) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // Common state
  const [dateBS,    setDateBS]    = useState(todayBS())
  const [amount,    setAmount]    = useState("")
  const [partyName, setPartyName] = useState("")
  const [panNumber, setPanNumber] = useState("")
  const [narration, setNarration] = useState("")
  const [source,    setSource]    = useState(presets.cash || presets.bank || "")  // Cash by default

  // Template-specific state
  const [feeAccountId, setFeeAccountId] = useState(presets.tuition || "")
  const [expenseId,    setExpenseId]    = useState(presets.utilities || presets.other_expense || "")
  const [tdsPercent,   setTdsPercent]   = useState("10")
  const [tdsAmount,    setTdsAmount]    = useState("")
  const [ssfAmount,    setSsfAmount]    = useState("")
  const [pfAmount,          setPfAmount]          = useState("")
  const [pfEmployerAmount,  setPfEmployerAmount]  = useState("")
  const [citAmount,         setCitAmount]         = useState("")
  const [citEmployerAmount, setCitEmployerAmount] = useState("")

  const { cashOrBank, cashAccounts, bankAccounts } = useMemo(() => leafAccounts(accounts), [accounts])
  const incomeAccounts  = useMemo(() => accounts.filter(a => a.type === "INCOME"),  [accounts])
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === "EXPENSE"), [accounts])

  // Contra (deposit/withdraw) lets the user pick the exact cash + bank accounts.
  // Cash defaults to the single cash account; bank is left empty to force an
  // explicit choice — never default to the 1120 group or an arbitrary bank.
  const [contraCashId, setContraCashId] = useState(presets.cash || "")
  const [contraBankId, setContraBankId] = useState("")

  // Deposit Cash to Bank: prefill the amount with the selected cash account's
  // current balance (cash on hand). Re-fills when the cash account changes, but
  // not after the user edits the amount, so a manual entry is never clobbered.
  const [autoFilledFor, setAutoFilledFor] = useState("")
  useEffect(() => {
    if (template.id !== "deposit-cash") return
    if (!contraCashId || autoFilledFor === contraCashId) return
    setAmount(cashBalances[contraCashId] ?? "")
    setAutoFilledFor(contraCashId)
  }, [template.id, contraCashId, cashBalances, autoFilledFor])

  function compute(): { input: ReturnType<typeof buildFeeReceipt> | null; net: string | null } {
    const amt = parseFloat(amount || "0") || 0
    if (amt <= 0) return { input: null, net: null }
    const common = { fiscalYearId, dateBS, narration }

    switch (template.id) {
      case "fee-receipt":
        if (!feeAccountId || !source) return { input: null, net: null }
        return {
          input: buildFeeReceipt({
            ...common, amount, studentName: partyName,
            feeAccountId, sourceAccountId: source,
          }),
          net: amount,
        }
      case "donation":
        if (!source || !presets.donation) return { input: null, net: null }
        return {
          input: buildDonation({
            ...common, amount, donorName: partyName,
            donationAccountId: presets.donation, sourceAccountId: source,
          }),
          net: amount,
        }
      case "pay-expense":
        if (!expenseId || !source) return { input: null, net: null }
        return {
          input: buildPayExpense({
            ...common, amount, payeeName: partyName,
            expenseAccountId: expenseId, sourceAccountId: source,
          }),
          net: amount,
        }
      case "pay-rent": {
        if (!presets.rent || !presets.tdsPayable || !source) return { input: null, net: null }
        const pct = parseFloat(tdsPercent || "0") || 0
        const tds = (amt * pct) / 100
        const net = (amt - tds).toFixed(2)
        return {
          input: buildPayRent({
            ...common, gross: amount, landlordName: partyName, panNumber,
            tdsPercent, rentAccountId: presets.rent,
            tdsPayableAccountId: presets.tdsPayable, sourceAccountId: source,
          }),
          net,
        }
      }
      case "pay-salary": {
        if (!presets.salary || !presets.tdsPayable || !presets.ssfPayable || !source) return { input: null, net: null }
        const tds = parseFloat(tdsAmount || "0") || 0
        const ssf = parseFloat(ssfAmount || "0") || 0
        const pf  = parseFloat(pfAmount  || "0") || 0
        const cit = parseFloat(citAmount || "0") || 0
        const net = (amt - tds - ssf - pf - cit).toFixed(2)
        return {
          input: buildPaySalary({
            ...common, gross: amount, employeeName: partyName, panNumber,
            tdsAmount, ssfAmount,
            pfAmount, pfEmployerAmount, citAmount, citEmployerAmount,
            salaryAccountId:     presets.salary,
            tdsPayableAccountId: presets.tdsPayable,
            ssfPayableAccountId: presets.ssfPayable,
            pfPayableAccountId:  presets.pfPayable,
            citPayableAccountId: presets.citPayable,
            employerContribAccountId: presets.employerContrib,
            sourceAccountId:     source,
          }),
          net,
        }
      }
      case "deposit-cash":
        if (!contraCashId || !contraBankId) return { input: null, net: null }
        return {
          input: buildDepositCash({ ...common, amount, cashAccountId: contraCashId, bankAccountId: contraBankId }),
          net: amount,
        }
      case "withdraw-cash":
        if (!contraCashId || !contraBankId) return { input: null, net: null }
        return {
          input: buildWithdrawCash({ ...common, amount, cashAccountId: contraCashId, bankAccountId: contraBankId }),
          net: amount,
        }
      default:
        // day-fee-collection and salary-payroll route to their own form components above.
        return { input: null, net: null }
    }
  }

  const { input, net } = compute()

  function handlePost() {
    if (!input) { toast.error("Fill in all required fields"); return }
    start(async () => {
      try {
        const res = await createAndPostQuickVoucher(input)
        toast.success(`Posted ${res.number}`)
        router.push(`/accounting/vouchers/${res.id}`)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  const Icon = ICON_MAP[template.id]
  const c = COLOR_MAP[template.color]

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4 max-w-3xl">
      <FormHeader template={template} fiscalYearName={fiscalYearName} Icon={Icon} c={c} />

      {/* Common fields */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date (BS)">
          <NepaliDateInput value={dateBS} onChange={setDateBS} />
        </Field>
        <Field label={template.id === "deposit-cash" && contraCashId
          ? `Amount (Rs.) * — Rs. ${cashBalances[contraCashId] ?? "0.00"} on hand`
          : "Amount (Rs.) *"}>
          <Input
            type="text" inputMode="decimal"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="font-mono text-right"
          />
        </Field>
      </div>

      {/* Party (where relevant) */}
      {(template.id === "fee-receipt" || template.id === "donation" ||
        template.id === "pay-salary" || template.id === "pay-rent" || template.id === "pay-expense") && (
        (template.id === "pay-rent" || template.id === "pay-salary") ? (
          <PartyAutocomplete
            name={partyName}
            pan={panNumber}
            onPick={({ name, pan }) => { setPartyName(name); setPanNumber(pan) }}
            onNameChange={setPartyName}
            onPanChange={setPanNumber}
            voucherType={template.type}
            nameLabel={template.id === "pay-rent" ? "Landlord name *" : "Employee name *"}
          />
        ) : (
          <Field label={
            template.id === "fee-receipt" ? "Student name" :
            template.id === "donation"    ? "Donor name" :
                                            "Payee name"
          }>
            <Input value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Name" />
          </Field>
        )
      )}

      {/* Template-specific extras */}
      {template.id === "fee-receipt" && (
        <Field label="Fee account">
          <AccountPicker value={feeAccountId} onChange={setFeeAccountId} accounts={incomeAccounts} placeholder="Select fee account…" />
        </Field>
      )}

      {template.id === "pay-expense" && (
        <Field label="Expense account *">
          <AccountPicker value={expenseId} onChange={setExpenseId} accounts={expenseAccounts} placeholder="Select expense account…" />
        </Field>
      )}

      {template.id === "pay-rent" && (
        <Field label="TDS %">
          <Input
            type="text" inputMode="decimal"
            value={tdsPercent} onChange={e => setTdsPercent(e.target.value)}
            placeholder="10" className="font-mono text-right"
          />
        </Field>
      )}

      {template.id === "pay-salary" && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="TDS (Rs.)">
            <Input type="text" inputMode="decimal" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
          <Field label="SSF (Rs.)">
            <Input type="text" inputMode="decimal" value={ssfAmount} onChange={e => setSsfAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
          <Field label="PF — employee (Rs.)">
            <Input type="text" inputMode="decimal" value={pfAmount} onChange={e => setPfAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
          <Field label="PF — employer (Rs.)">
            <Input type="text" inputMode="decimal" value={pfEmployerAmount} onChange={e => setPfEmployerAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
          <Field label="CIT — employee (Rs.)">
            <Input type="text" inputMode="decimal" value={citAmount} onChange={e => setCitAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
          <Field label="CIT — employer (Rs.)">
            <Input type="text" inputMode="decimal" value={citEmployerAmount} onChange={e => setCitEmployerAmount(e.target.value)} placeholder="0.00" className="font-mono text-right" />
          </Field>
        </div>
      )}

      {/* Cash/Bank source (skip for contra — both fixed) */}
      {template.id !== "deposit-cash" && template.id !== "withdraw-cash" && (
        <Field label={template.type === "RV" ? "Receive into *" : "Pay from *"}>
          <div className="grid grid-cols-2 gap-2">
            {cashOrBank.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSource(a.id)}
                className={cn(
                  "px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border",
                  source === a.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white/75 border-slate-200 text-slate-700 hover:border-primary/40",
                )}
              >
                <span className="font-mono text-[10px] text-current opacity-60 block">{a.code}</span>
                {a.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Contra (deposit/withdraw): pick the specific cash + bank accounts.
          Order follows the money flow — source on the left, destination on the right:
          deposit = Cash → Bank; withdraw = Bank → Cash. */}
      {(template.id === "deposit-cash" || template.id === "withdraw-cash") && (() => {
        const cashField = (
          <Field key="cash" label="Cash account *">
            <AccountPicker value={contraCashId} onChange={setContraCashId} accounts={cashAccounts} placeholder="Select cash account…" />
          </Field>
        )
        const bankField = (
          <Field key="bank" label="Bank account *">
            <AccountPicker value={contraBankId} onChange={setContraBankId} accounts={bankAccounts} placeholder="Select bank account…" />
          </Field>
        )
        return (
          <div className="grid sm:grid-cols-2 gap-3">
            {template.id === "withdraw-cash" ? [bankField, cashField] : [cashField, bankField]}
          </div>
        )
      })()}

      <Field label="Narration (optional)">
        <NarrationAutocomplete
          value={narration}
          onChange={setNarration}
          placeholder="Auto-generated if blank — type to search prior narrations"
          voucherType={template.type}
        />
      </Field>

      {/* Live preview */}
      {input && (
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Preview entries</p>
          {input.lines.map((l, i) => {
            const acc = accounts.find(a => a.id === l.accountId)
            const dr = parseFloat(l.debit  || "0")
            const cr = parseFloat(l.credit || "0")
            return (
              <div key={i} className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-700">
                  <span className="text-slate-400">{acc?.code}</span> · {acc?.name ?? "?"}
                </span>
                <span className={cn("tabular-nums font-bold", dr > 0 ? "text-emerald-700" : "text-rose-700")}>
                  {dr > 0 ? `Dr ${dr.toFixed(2)}` : `Cr ${cr.toFixed(2)}`}
                </span>
              </div>
            )
          })}
          {net && template.type === "PV" && net !== amount && (
            <p className="text-[11px] text-slate-500 pt-1 mt-1 border-t border-slate-200">
              Net cash out: <strong className="text-slate-700 font-mono">Rs. {net}</strong>
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
<Button onClick={handlePost} disabled={pending || !input} className="cursor-pointer gap-1.5 shadow-md shadow-primary/20">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Post Voucher
        </Button>
      </div>
    </div>
  )
}

// ─── Day's Fee Collection — multi-head split + cash/bank breakdown ─────────

function DayFeeCollectionForm({ template, presets, accounts, fiscalYearId, fiscalYearName }: TemplateFormProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dateBS,    setDateBS]    = useState(todayBS())
  const [cashAmt,   setCashAmt]   = useState("")
  const [bankAmt,   setBankAmt]   = useState("")
  const [bankAccountId, setBankAccountId] = useState("")  // which bank the bank/cheque portion lands in
  const [narration, setNarration] = useState("")
  // Per-head amounts keyed by preset code (tuition, admission, exam, transport, hostel)
  const [heads,     setHeads]     = useState<Record<string, string>>({})

  function updateHead(code: string, amount: string) {
    setHeads(prev => ({ ...prev, [code]: amount }))
  }

  const { bankAccounts } = useMemo(() => leafAccounts(accounts), [accounts])

  // All active income accounts become fee-head rows. Add / rename via the COA editor or inline dialog.
  const incomeAccounts = useMemo(
    () => accounts.filter(a => a.type === "INCOME").sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  )

  // Find the "4000 Income" group as the default parent for new fee heads
  const incomeParentId = useMemo(
    () => accounts.find(a => a.code === "4000" && a.type === "INCOME")?.id ?? null,
    [accounts],
  )

  // Suggest the next available 4xxx code (rounded up to next 100)
  const suggestedCode = useMemo(() => {
    const nums = incomeAccounts
      .map(a => parseInt(a.code, 10))
      .filter(n => Number.isFinite(n) && n >= 4000 && n < 5000)
    if (nums.length === 0) return "4100"
    const next = Math.ceil((Math.max(...nums) + 1) / 100) * 100
    return String(next < 5000 ? next : Math.max(...nums) + 10)
  }, [incomeAccounts])

  const cash = parseFloat(cashAmt || "0") || 0
  const bank = parseFloat(bankAmt || "0") || 0
  const totalSource = cash + bank
  const totalHeads  = Object.values(heads).reduce((a, v) => a + (parseFloat(v || "0") || 0), 0)
  const diff        = totalSource - totalHeads
  const balanced    = Math.abs(diff) < 0.005 && totalSource > 0

  const headsForBuild = incomeAccounts
    .filter(a => (parseFloat(heads[a.id] || "0") || 0) > 0)
    .map(a => ({ accountId: a.id, label: a.name, amount: heads[a.id] || "0" }))

  const canPost = balanced && headsForBuild.length > 0 && !!presets.cash && (bank <= 0 || !!bankAccountId)

  function handlePost() {
    if (!canPost) { toast.error("Cash + Bank totals must equal the sum of fee heads"); return }
    start(async () => {
      try {
        const input = buildDayFeeCollection({
          fiscalYearId, dateBS, narration,
          cashAmount:    cashAmt || "0",
          bankAmount:    bankAmt || "0",
          cashAccountId: presets.cash,
          bankAccountId: bankAccountId,
          heads:         headsForBuild,
        })
        const res = await createAndPostQuickVoucher(input)
        toast.success(`Posted ${res.number}`)
        router.push(`/accounting/vouchers/${res.id}`)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  const c = COLOR_MAP[template.color]
  const Icon = ICON_MAP[template.id]

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4 max-w-3xl">
      <FormHeader template={template} fiscalYearName={fiscalYearName} Icon={Icon} c={c} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Date (BS)">
          <NepaliDateInput value={dateBS} onChange={setDateBS} />
        </Field>
        <Field label="Cash collected (Rs.)">
          <Input type="text" inputMode="decimal" value={cashAmt} onChange={e => setCashAmt(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Bank/Cheque (Rs.)">
          <Input type="text" inputMode="decimal" value={bankAmt} onChange={e => setBankAmt(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
      </div>

      {bank > 0 && (
        <Field label="Deposit bank/cheque into *">
          <AccountPicker value={bankAccountId} onChange={setBankAccountId} accounts={bankAccounts} placeholder="Select bank account…" />
        </Field>
      )}

      <div className="bg-slate-50/60 border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Fee head breakdown</p>
          <p className="text-[10px] text-slate-500">Sum must equal Cash + Bank</p>
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {incomeAccounts.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No income accounts yet. <Link href="/accounting/accounts" className="text-primary font-bold hover:underline">Add one →</Link>
            </div>
          ) : (
            incomeAccounts.map(a => (
              <div key={a.id} className="grid grid-cols-[1fr_auto] items-center px-3 py-1.5 gap-2">
                <div className="text-sm">
                  {a.name}
                  <span className="ml-2 text-[10px] font-mono text-slate-400">{a.code}</span>
                </div>
                <input
                  type="text" inputMode="decimal"
                  value={heads[a.id] ?? ""}
                  onChange={e => updateHead(a.id, e.target.value)}
                  placeholder="0.00"
                  className="w-32 text-right font-mono text-sm px-2 py-1.5 bg-white border border-slate-200 rounded hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
                />
              </div>
            ))
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between text-[11px] gap-3 flex-wrap">
          <span className="text-slate-500">Need a new fee head?</span>
          <div className="inline-flex items-center gap-3">
            <AddFeeHeadDialog parentId={incomeParentId} suggestedCode={suggestedCode} />
            <span className="text-slate-300">·</span>
            <Link href="/accounting/accounts" className="text-slate-600 hover:text-primary hover:underline">Manage in Chart of Accounts →</Link>
          </div>
        </div>
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600">Σ Heads (Credit)</span>
          <span className="font-mono tabular-nums">Rs. {totalHeads.toFixed(2)}</span>
        </div>
        <div className="px-3 py-1 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600">Σ Cash + Bank (Debit)</span>
          <span className="font-mono tabular-nums">Rs. {totalSource.toFixed(2)}</span>
        </div>
        <div className={cn(
          "px-3 py-2 text-center text-xs font-bold",
          balanced ? "text-emerald-700 bg-emerald-50/60" : "text-rose-700 bg-rose-50/60",
        )}>
          {totalSource === 0
            ? "Enter cash / bank amounts to begin"
            : balanced
              ? `✓ Balanced (Rs. ${totalSource.toFixed(2)})`
              : `Off by Rs. ${Math.abs(diff).toFixed(2)} — Cash+Bank ${diff > 0 ? "exceeds" : "is less than"} sum of heads`}
        </div>
      </div>

      <Field label="Narration (optional)">
        <NarrationAutocomplete value={narration} onChange={setNarration} placeholder="Auto-generated if blank" voucherType="RV" />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
<Button onClick={handlePost} disabled={pending || !canPost} className="cursor-pointer gap-1.5 shadow-md shadow-primary/20">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Post Voucher
        </Button>
      </div>
    </div>
  )
}

// ─── Monthly Salary Payroll — lump sum gross + TDS + SSF + net ─────────────

function SalaryPayrollForm({ template, presets, accounts, fiscalYearId, fiscalYearName }: TemplateFormProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dateBS,     setDateBS]     = useState(todayBS())
  const [period,     setPeriod]     = useState("")
  const [totalGross, setTotalGross] = useState("")
  const [totalTds,   setTotalTds]   = useState("")
  const [totalSsf,   setTotalSsf]   = useState("")
  const [totalPf,          setTotalPf]          = useState("")
  const [totalPfEmployer,  setTotalPfEmployer]  = useState("")
  const [totalCit,         setTotalCit]         = useState("")
  const [totalCitEmployer, setTotalCitEmployer] = useState("")
  const [source,     setSource]     = useState("")  // pick pay-from explicitly (no group default)
  const [narration,  setNarration]  = useState("")

  const gross = parseFloat(totalGross || "0") || 0
  const tds   = parseFloat(totalTds   || "0") || 0
  const ssf   = parseFloat(totalSsf   || "0") || 0
  const pf    = parseFloat(totalPf    || "0") || 0
  const cit   = parseFloat(totalCit   || "0") || 0
  const net   = Math.max(0, gross - tds - ssf - pf - cit)

  const { cashOrBank } = useMemo(() => leafAccounts(accounts), [accounts])

  const canPost = gross > 0 && !!source
    && !!presets.salary && !!presets.tdsPayable && !!presets.ssfPayable

  function handlePost() {
    if (!canPost) { toast.error("Fill in gross salary and pay-from account"); return }
    start(async () => {
      try {
        const input = buildSalaryPayroll({
          fiscalYearId, dateBS, narration, period,
          totalGross,
          totalTds: totalTds || "0",
          totalSsf: totalSsf || "0",
          totalPf:  totalPf  || "0",
          totalPfEmployer:  totalPfEmployer  || "0",
          totalCit: totalCit || "0",
          totalCitEmployer: totalCitEmployer || "0",
          salaryAccountId:     presets.salary,
          tdsPayableAccountId: presets.tdsPayable,
          ssfPayableAccountId: presets.ssfPayable,
          pfPayableAccountId:  presets.pfPayable,
          citPayableAccountId: presets.citPayable,
          employerContribAccountId: presets.employerContrib,
          sourceAccountId:     source,
        })
        const res = await createAndPostQuickVoucher(input)
        toast.success(`Posted ${res.number}`)
        router.push(`/accounting/vouchers/${res.id}`)
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  const c = COLOR_MAP[template.color]
  const Icon = ICON_MAP[template.id]

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 space-y-4 max-w-3xl">
      <FormHeader template={template} fiscalYearName={fiscalYearName} Icon={Icon} c={c} />

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date (BS)">
          <NepaliDateInput value={dateBS} onChange={setDateBS} />
        </Field>
        <Field label="Period (optional label)">
          <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Baisakh 2082" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Total Gross Salary *">
          <Input type="text" inputMode="decimal" value={totalGross} onChange={e => setTotalGross(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Total TDS Deducted">
          <Input type="text" inputMode="decimal" value={totalTds} onChange={e => setTotalTds(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Total SSF Deducted">
          <Input type="text" inputMode="decimal" value={totalSsf} onChange={e => setTotalSsf(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Total PF (employee)">
          <Input type="text" inputMode="decimal" value={totalPf} onChange={e => setTotalPf(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Total PF (employer)">
          <Input type="text" inputMode="decimal" value={totalPfEmployer} onChange={e => setTotalPfEmployer(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Total CIT (employee)">
          <Input type="text" inputMode="decimal" value={totalCit} onChange={e => setTotalCit(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
        <Field label="Total CIT (employer)">
          <Input type="text" inputMode="decimal" value={totalCitEmployer} onChange={e => setTotalCitEmployer(e.target.value)} placeholder="0.00" className="font-mono text-right" />
        </Field>
      </div>

      <div className="text-xs text-slate-500 bg-slate-50/60 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
        <span>Net pay (gross − TDS − SSF − employee PF − employee CIT)</span>
        <span className="font-mono font-bold text-emerald-700">Rs. {net.toFixed(2)}</span>
      </div>

      <Field label="Pay from *">
        <div className="grid grid-cols-2 gap-2">
          {cashOrBank.map(a => (
            <button
              key={a.id} type="button" onClick={() => setSource(a.id)}
              className={cn(
                "px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border",
                source === a.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white/75 border-slate-200 text-slate-700 hover:border-primary/40",
              )}
            >
              <span className="font-mono text-[10px] opacity-60 block">{a.code}</span>
              {a.name}
            </button>
          ))}
        </div>
      </Field>

      {gross > 0 && (
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5">Preview entries</p>
          <PreviewLine label={`${presets.salary ? (accounts.find(a => a.id === presets.salary)?.code ?? "") : ""} · Salaries & Allowances`} debit={gross} />
          {tds > 0 && <PreviewLine label="TDS Payable" credit={tds} />}
          {ssf > 0 && <PreviewLine label="SSF Payable" credit={ssf} />}
          <PreviewLine label={accounts.find(a => a.id === source)?.name ?? "Cash / Bank"} credit={net} />
          <p className="text-[11px] text-slate-500 pt-1 mt-1 border-t border-slate-200">
            Net cash out: <strong className="text-slate-700 font-mono">Rs. {net.toFixed(2)}</strong>
          </p>
        </div>
      )}

      <Field label="Narration (optional)">
        <NarrationAutocomplete value={narration} onChange={setNarration} placeholder="Auto-generated from period if blank" voucherType="PV" />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
<Button onClick={handlePost} disabled={pending || !canPost} className="cursor-pointer gap-1.5 shadow-md shadow-primary/20">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Post Voucher
        </Button>
      </div>
    </div>
  )
}

// ─── Shared sub-bits ────────────────────────────────────────────────────────

function FormHeader({
  template, fiscalYearName, Icon, c,
}: {
  template: QuickTemplate; fiscalYearName: string
  Icon: React.ElementType; c: typeof COLOR_MAP[keyof typeof COLOR_MAP]
}) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", c.iconBg)}>
        <Icon className={cn("w-5 h-5", c.icon)} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-base tracking-tight">{template.title}</p>
        <p className="text-xs text-muted-foreground">{template.description}</p>
      </div>
      <span className="text-xs text-muted-foreground font-mono">FY {fiscalYearName}</span>
    </div>
  )
}

function PreviewLine({ label, debit, credit }: { label: string; debit?: number; credit?: number }) {
  return (
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-slate-700 truncate">{label}</span>
      <span className={cn("tabular-nums font-bold", debit ? "text-emerald-700" : "text-rose-700")}>
        {debit  !== undefined ? `Dr ${debit.toFixed(2)}`  : ""}
        {credit !== undefined ? `Cr ${credit.toFixed(2)}` : ""}
      </span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
