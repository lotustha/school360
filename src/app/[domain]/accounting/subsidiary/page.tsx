import { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { GraduationCap, Users, Truck, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { listPartiesSummary, type PartyKind } from "@/actions/accounting/subsidiary-ledger"
import { getCurrentFiscalYear, listFiscalYears } from "@/actions/accounting/fiscal-years"

export const metadata: Metadata = { title: "Subsidiary Ledger" }

const TYPES: { kind: PartyKind; label: string; icon: React.ElementType; color: string }[] = [
  { kind: "VENDOR",   label: "Vendors",   icon: Truck,         color: "violet" },
  { kind: "STUDENT",  label: "Students",  icon: GraduationCap, color: "emerald" },
  { kind: "EMPLOYEE", label: "Employees", icon: Users,         color: "amber" },
]

export default async function SubsidiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; fy?: string }>
}) {
  const sp = await searchParams
  const fys = await listFiscalYears()
  const current = await getCurrentFiscalYear()
  if (!current && fys.length === 0) redirect("/accounting/setup")
  const fyId = sp.fy ?? current?.id ?? fys[0]?.id

  const activeKind: PartyKind = (sp.type as PartyKind) || "VENDOR"
  const parties = await listPartiesSummary(activeKind, fyId)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Subsidiary Ledger</h1>
        <form className="flex items-center gap-2 text-xs">
          <select name="fy" defaultValue={fyId} className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white">
            {fys.map(f => <option key={f.id} value={f.id}>FY {f.name}</option>)}
          </select>
          <input type="hidden" name="type" value={activeKind} />
          <button type="submit" className="h-9 px-3 bg-primary text-white rounded-md font-bold cursor-pointer">Apply</button>
        </form>
      </div>

      {/* Party type tabs */}
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-xl p-1 inline-flex gap-0.5 max-w-full overflow-x-auto">
        {TYPES.map(t => {
          const isActive = t.kind === activeKind
          return (
            <Link key={t.kind} href={`/accounting/subsidiary?type=${t.kind}${fyId ? `&fy=${fyId}` : ""}`}>
              <span className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer",
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-slate-50",
              )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Party list */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {parties.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No postings with a {activeKind.toLowerCase()} party yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 text-[10px] uppercase tracking-widest text-slate-500 font-black">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center w-24">Entries</th>
                <th className="px-4 py-3 text-right w-32">Debit (Dr)</th>
                <th className="px-4 py-3 text-right w-32">Credit (Cr)</th>
                <th className="px-4 py-3 text-right w-32">Balance</th>
                <th className="px-4 py-3 text-right w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {parties.map(p => {
                const dr  = parseFloat(p.netDebit)
                const cr  = parseFloat(p.netCredit)
                const bal = dr > 0 ? dr.toFixed(2) : cr > 0 ? cr.toFixed(2) : "0.00"
                const balLabel = dr > 0 ? "Dr" : cr > 0 ? "Cr" : ""
                return (
                  <tr key={`${p.partyId ?? ""}|${p.partyName}`} className="hover:bg-primary/4">
                    <td className="px-4 py-2 font-semibold">{p.partyName}</td>
                    <td className="px-4 py-2 text-center text-xs">{p.count}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-700">{dr > 0 ? p.netDebit : ""}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{cr > 0 ? p.netCredit : ""}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant="outline" className={cn(
                        "font-mono tabular-nums text-xs",
                        dr > 0 && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        cr > 0 && "bg-rose-50 text-rose-700 border-rose-200",
                      )}>
                        {bal} {balLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/accounting/subsidiary/ledger?type=${activeKind}&name=${encodeURIComponent(p.partyName)}&fy=${fyId}`}
                        className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                      >
                        View ledger <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
