import Link from "next/link"
import { Metadata } from "next"
import { Plus, ReceiptText, Banknote, ArrowLeftRight, NotebookPen, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listVouchers } from "@/actions/accounting/vouchers"
import { VouchersTable } from "./vouchers-table"

export const metadata: Metadata = { title: "Vouchers" }

const TYPE_ICON = { RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen } as const

const VALID_TYPES = new Set(["RV", "PV", "CV", "JV"])
const VALID_STATUSES = new Set(["DRAFT", "POSTED", "REVERSED"])

export default async function VouchersListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const sp = await searchParams
  const typeFilter   = sp.type   && VALID_TYPES.has(sp.type)     ? (sp.type as "RV" | "PV" | "CV" | "JV") : undefined
  const statusFilter = sp.status && VALID_STATUSES.has(sp.status) ? (sp.status as "DRAFT" | "POSTED" | "REVERSED") : undefined
  const vouchers = await listVouchers({ type: typeFilter, status: statusFilter })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
        <div className="flex items-center gap-1.5">
          <Link href="/accounting/quick">
            <Button size="sm" className="gap-1.5 cursor-pointer shadow-sm shadow-primary/20">
              <Zap className="w-3.5 h-3.5" /> Quick Entry
            </Button>
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-2">or manual</span>
          {(["RV", "PV", "CV", "JV"] as const).map(t => {
            const Icon = TYPE_ICON[t]
            return (
              <Link key={t} href={`/accounting/vouchers/new/${t}`}>
                <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer text-xs">
                  <Icon className="w-3.5 h-3.5" />
                  {t}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Type</span>
          {["", "RV", "PV", "CV", "JV"].map(t => (
            <Link key={t || "ALL"} href={t ? `/accounting/vouchers?type=${t}${sp.status ? `&status=${sp.status}` : ""}` : `/accounting/vouchers${sp.status ? `?status=${sp.status}` : ""}`}>
              <Badge variant={(sp.type ?? "") === t ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {t || "ALL"}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Status</span>
          {["", "DRAFT", "POSTED", "REVERSED"].map(s => (
            <Link key={s || "ALL"} href={s ? `/accounting/vouchers?status=${s}${sp.type ? `&type=${sp.type}` : ""}` : `/accounting/vouchers${sp.type ? `?type=${sp.type}` : ""}`}>
              <Badge variant={(sp.status ?? "") === s ? "default" : "outline"} className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                {s || "ALL"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm overflow-hidden">
        {vouchers.length === 0 ? (
          <div className="p-16 text-center">
            <ReceiptText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-4">No vouchers yet.</p>
            <Link href="/accounting/vouchers/new/RV">
              <Button className="gap-1.5 cursor-pointer">
                <Plus className="w-4 h-4" /> Create First Voucher
              </Button>
            </Link>
          </div>
        ) : (
          <VouchersTable rows={vouchers} />
        )}
      </div>
    </div>
  )
}
