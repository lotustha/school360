import Link from "next/link"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { BookOpen, Printer, FileSpreadsheet, ArrowDownRight, ArrowUpRight, Scale, ChevronRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { listAccounts } from "@/actions/accounting/accounts"
import { listFiscalYears, getCurrentFiscalYear } from "@/actions/accounting/fiscal-years"
import { getAccountLedger } from "@/actions/accounting/reports"
import { formatBS, todayBS } from "@/lib/nepali-date"
import { LedgerSwitcher } from "./ledger-switcher"
import { LedgerTable } from "./ledger-table"

export const metadata: Metadata = { title: "Ledger" }

const TYPE_COLOR: Record<string, string> = {
  ASSET:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  LIABILITY: "bg-rose-50    text-rose-700    border-rose-200",
  EQUITY:    "bg-violet-50  text-violet-700  border-violet-200",
  INCOME:    "bg-sky-50     text-sky-700     border-sky-200",
  EXPENSE:   "bg-amber-50   text-amber-700   border-amber-200",
}

const NORMAL_BALANCE: Record<string, "Dr" | "Cr"> = {
  ASSET: "Dr", EXPENSE: "Dr",
  LIABILITY: "Cr", EQUITY: "Cr", INCOME: "Cr",
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; fy?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")

  const fyId = sp.fy ?? current?.id ?? fys[0]?.id!
  const accounts = await listAccounts()
  const accountId = sp.account ?? null
  const activeFy = fys.find(f => f.id === fyId)

  const ledger = accountId
    ? await getAccountLedger(accountId, fyId, sp.from, sp.to).catch(() => null)
    : null

  const account = accountId ? accounts.find(a => a.id === accountId) : null

  // Derived: signed closing → labeled Dr/Cr
  const closingNum = ledger ? parseFloat(ledger.closingBalance) : 0
  const closingIsDr = closingNum >= 0
  const closingAbs = Math.abs(closingNum)
  const closingLabel = closingIsDr ? "Dr" : "Cr"
  const openingNum = ledger
    ? parseFloat(ledger.openingDebit) - parseFloat(ledger.openingCredit)
    : 0
  const periodDr = ledger ? ledger.rows.reduce((a, r) => a + (parseFloat(r.debit)  || 0), 0) : 0
  const periodCr = ledger ? ledger.rows.reduce((a, r) => a + (parseFloat(r.credit) || 0), 0) : 0
  const movement = periodDr - periodCr  // signed net change

  // Common-pick accounts: top 6 by sub-type / system flag for the empty-state quick-picks
  const popularAccounts = accounts
    .filter(a => a.isActive)
    .slice()
    .sort((a, b) => {
      // Cash / bank / receivables / common income heads first
      const score = (x: typeof a) => {
        if (x.subType === "CASH") return 0
        if (x.subType === "BANK") return 1
        if (x.subType === "RECEIVABLE") return 2
        if (x.type === "INCOME") return 3
        if (x.type === "EXPENSE") return 4
        return 5
      }
      return score(a) - score(b) || a.code.localeCompare(b.code)
    })
    .slice(0, 8)

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
            {ledger && (
              <>
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border-slate-200">
                  {ledger.code}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", TYPE_COLOR[ledger.type] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                  {ledger.type}
                </Badge>
              </>
            )}
            {activeFy && (
              <Badge variant="outline" className="text-[10px] font-bold bg-sky-50 text-sky-700 border-sky-200">
                FY {activeFy.name}
              </Badge>
            )}
          </div>
          {ledger ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
              <BookOpen className="w-3 h-3 text-slate-400" />
              {ledger.name}
              {account?.subType && <span className="text-slate-300">· {account.subType}</span>}
              <span className="text-slate-300">·</span>
              <span className="font-mono">
                {sp.from && sp.to
                  ? `${formatBS(sp.from)} → ${formatBS(sp.to)}`
                  : activeFy ? `${formatBS(activeFy.startBS)} → ${formatBS(activeFy.endBS)}` : ""}
              </span>
              <span className="text-slate-300">·</span>
              <span>{ledger.rows.length} entr{ledger.rows.length === 1 ? "y" : "ies"}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Pick an account to view its full ledger with running balance.</p>
          )}
        </div>
        {ledger && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled className="cursor-not-allowed gap-1.5 text-xs opacity-50" title="Coming in Phase 3">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" disabled className="cursor-not-allowed gap-1.5 text-xs opacity-50" title="Print view coming soon">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        )}
      </div>

      {/* ── Switcher ────────────────────────────────────────────── */}
      <LedgerSwitcher
        accounts={accounts.filter(a => a.isActive).map(a => ({
          id: a.id, code: a.code, name: a.name, type: a.type, subType: a.subType,
        }))}
        fiscalYears={fys.map(f => ({ id: f.id, name: f.name, isCurrent: f.isCurrent }))}
        selectedAccount={accountId}
        selectedFy={fyId}
        fromBS={sp.from ?? ""}
        toBS={sp.to ?? ""}
      />

      {/* ── Quick range presets ─────────────────────────────────── */}
      {accountId && (
        <div className="flex gap-1.5 flex-wrap items-center justify-end">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 mr-1">Quick range</span>
          {[
            { label: "Today",      from: todayBS(),         to: todayBS() },
            { label: "FY → today", from: activeFy?.startBS, to: todayBS() },
            { label: "Full FY",    from: undefined,         to: undefined },
          ].map(p => {
            const isActive =
              (sp.from ?? "") === (p.from ?? "") &&
              (sp.to   ?? "") === (p.to   ?? "")
            const qs = new URLSearchParams({ account: accountId, fy: fyId })
            if (p.from) qs.set("from", p.from)
            if (p.to)   qs.set("to",   p.to)
            return (
              <Link key={p.label} href={`/accounting/ledger?${qs.toString()}`}>
                <Badge variant={isActive ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                  {p.label}
                </Badge>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      {!ledger ? (
        <EmptyState accountId={accountId} accounts={popularAccounts} fyId={fyId} />
      ) : (
        <>
          {/* Hero KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Opening Balance"
              value={Math.abs(openingNum).toFixed(2)}
              suffix={openingNum >= 0 ? "Dr" : "Cr"}
              subtitle={`Dr ${ledger.openingDebit} · Cr ${ledger.openingCredit}`}
              icon={BookOpen}
              tone="slate"
            />
            <KpiCard
              label="Period Debit"
              value={periodDr.toFixed(2)}
              subtitle={`${ledger.rows.filter(r => parseFloat(r.debit) > 0).length} entries`}
              icon={ArrowDownRight}
              tone="emerald"
            />
            <KpiCard
              label="Period Credit"
              value={periodCr.toFixed(2)}
              subtitle={`${ledger.rows.filter(r => parseFloat(r.credit) > 0).length} entries`}
              icon={ArrowUpRight}
              tone="rose"
            />
            <ClosingKpiCard
              accountType={ledger.type}
              closingAbs={closingAbs}
              closingLabel={closingLabel}
              movement={movement}
            />
          </div>

          {/* Movement strip */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-5 grid md:grid-cols-3 gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1.5">Net Movement</p>
              <p className={cn("font-mono tabular-nums text-2xl font-black", movement >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {movement >= 0 ? "+" : ""}{movement.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {movement >= 0 ? "Net debit movement this period" : "Net credit movement this period"}
              </p>
            </div>
            <div className="md:col-span-2 space-y-2.5">
              <BarRow label="Debit"  amount={periodDr} max={Math.max(periodDr, periodCr, 1)} tone="emerald" />
              <BarRow label="Credit" amount={periodCr} max={Math.max(periodDr, periodCr, 1)} tone="rose" />
            </div>
          </div>

          {/* Normal balance hint */}
          {NORMAL_BALANCE[ledger.type] && (
            <div className={cn(
              "rounded-xl p-3 border text-xs flex items-start gap-2",
              NORMAL_BALANCE[ledger.type] === closingLabel
                ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                : "bg-amber-50/60 border-amber-200 text-amber-800",
            )}>
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                <strong>{ledger.type}</strong> accounts have a normal <strong>{NORMAL_BALANCE[ledger.type]}</strong> balance.
                {" "}This account currently shows <strong>Rs. {closingAbs.toFixed(2)} {closingLabel}</strong>
                {" "}— {NORMAL_BALANCE[ledger.type] === closingLabel
                  ? "this is expected for a healthy book."
                  : "this is unusual; worth investigating before reporting."}
              </p>
            </div>
          )}

          {/* Ledger table */}
          <LedgerTable
            rows={ledger.rows}
            openingDebit={ledger.openingDebit}
            openingCredit={ledger.openingCredit}
            closingBalance={ledger.closingBalance}
          />
        </>
      )}
    </div>
  )
}

// ─── Empty state with quick picks ────────────────────────────────────────────

function EmptyState({
  accountId, accounts, fyId,
}: {
  accountId: string | null
  accounts: Array<{ id: string; code: string; name: string; type: string; subType: string | null }>
  fyId: string
}) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-10">
      <div className="flex flex-col items-center text-center max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold tracking-tight mb-2">
          {accountId ? "No account selected" : "Pick an account to view its ledger"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose any account from your Chart of Accounts to see its opening balance, every transaction in the period, and the running balance after each entry.
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2 text-center">Quick picks</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 max-w-3xl mx-auto">
          {accounts.map(a => (
            <Link
              key={a.id}
              href={`/accounting/ledger?account=${a.id}&fy=${fyId}`}
              className="group flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white/60 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", TYPE_COLOR[a.type] ?? "")}>
                {a.code}
              </Badge>
              <span className="text-xs font-semibold truncate flex-1">{a.name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
            </Link>
          ))}
        </div>
        {accounts.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-3">No active accounts. <Link href="/accounting/accounts" className="text-primary font-bold hover:underline">Open Chart of Accounts →</Link></p>
        )}
      </div>
    </div>
  )
}

// ─── KPI helpers ─────────────────────────────────────────────────────────────

function KpiCard({
  label, value, suffix, subtitle, icon: Icon, tone,
}: {
  label: string
  value: string
  suffix?: string
  subtitle: string
  icon: React.ElementType
  tone: "emerald" | "rose" | "slate"
}) {
  const palette = {
    emerald: { ring: "border-emerald-500/20", grad: "from-emerald-50", chip: "bg-emerald-500/10 text-emerald-700", icon: "text-emerald-600" },
    rose:    { ring: "border-rose-500/20",    grad: "from-rose-50",    chip: "bg-rose-500/10 text-rose-700",       icon: "text-rose-600" },
    slate:   { ring: "border-slate-200",      grad: "from-slate-50",   chip: "bg-slate-500/10 text-slate-700",     icon: "text-slate-500" },
  }[tone]
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Icon className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className="font-mono tabular-nums text-2xl font-black tracking-tight">
        Rs. {value}
        {suffix && <span className="text-base font-bold ml-1.5 text-slate-500">{suffix}</span>}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>
    </div>
  )
}

function ClosingKpiCard({
  accountType, closingAbs, closingLabel, movement,
}: {
  accountType: string
  closingAbs: number
  closingLabel: "Dr" | "Cr"
  movement: number
}) {
  const normal = NORMAL_BALANCE[accountType]
  const aligned = normal === closingLabel
  const palette = aligned
    ? { ring: "border-primary/20",   grad: "from-primary/5",  chip: "bg-primary/10 text-primary",         icon: "text-primary",      value: "text-primary" }
    : { ring: "border-amber-500/20", grad: "from-amber-50",   chip: "bg-amber-500/10 text-amber-700",     icon: "text-amber-600",    value: "text-amber-700" }
  return (
    <div className={cn("bg-gradient-to-br to-white/0 rounded-2xl border p-5", palette.ring, palette.grad)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Closing Balance</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", palette.chip)}>
          <Scale className={cn("w-4 h-4", palette.icon)} />
        </div>
      </div>
      <p className={cn("font-mono tabular-nums text-2xl font-black tracking-tight", palette.value)}>
        Rs. {closingAbs.toFixed(2)}
        <span className="text-base font-bold ml-1.5">{closingLabel}</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-1">
        {movement >= 0 ? "+" : ""}{movement.toFixed(2)} this period
      </p>
    </div>
  )
}

function BarRow({
  label, amount, max, tone,
}: {
  label: string
  amount: number
  max: number
  tone: "emerald" | "rose"
}) {
  const pct = (amount / max) * 100
  const bar = tone === "emerald" ? "bg-emerald-500" : "bg-rose-500"
  const text = tone === "emerald" ? "text-emerald-700" : "text-rose-700"
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-[11px]">
        <span className={cn("font-bold", text)}>{label}</span>
        <span className="font-mono tabular-nums text-slate-700">{amount.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-700", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
