"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { ReceiptText, Banknote, ArrowLeftRight, NotebookPen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { VOUCHER_TYPE_LABEL } from "@/lib/accounting"
import { formatBS } from "@/lib/nepali-date"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<string, React.ElementType> = { RV: ReceiptText, PV: Banknote, CV: ArrowLeftRight, JV: NotebookPen }

export interface VoucherRowView {
  id:             string
  fiscalYearId:   string
  fiscalYearName: string
  type:           string
  number:         string | null
  dateBS:         string
  narration:      string
  status:         string
  partyName:      string | null
  totalAmount:    string
}

interface Props { rows: VoucherRowView[] }

export function VouchersTable({ rows }: Props) {
  const columns: ColumnDef<VoucherRowView>[] = [
    {
      id: "number",
      accessorFn: r => r.number ?? "",
      header: "Number",
      filterFn: (row, _, value) => {
        const v = String(value).toLowerCase()
        return (row.original.number?.toLowerCase().includes(v) ?? false)
          || (row.original.partyName?.toLowerCase().includes(v) ?? false)
          || row.original.narration.toLowerCase().includes(v)
      },
      cell: ({ row }) => (
        <Link href={`/accounting/vouchers/${row.original.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
          {row.original.number ?? <span className="text-amber-600">(draft)</span>}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const Icon = TYPE_ICON[row.original.type] ?? ReceiptText
        return (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            {VOUCHER_TYPE_LABEL[row.original.type as keyof typeof VOUCHER_TYPE_LABEL] ?? row.original.type}
          </span>
        )
      },
    },
    {
      accessorKey: "dateBS",
      header: "Date (BS)",
      cell: ({ row }) => <span className="text-xs">{formatBS(row.original.dateBS)}</span>,
    },
    {
      accessorKey: "narration",
      header: "Narration",
      cell: ({ row }) => <span className="text-xs text-slate-600 max-w-md truncate block">{row.original.narration}</span>,
    },
    {
      accessorKey: "partyName",
      header: "Party",
      cell: ({ row }) => <span className="text-xs">{row.original.partyName ?? <span className="text-slate-400">—</span>}</span>,
    },
    {
      accessorKey: "fiscalYearName",
      header: "FY",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.fiscalYearName}</span>,
    },
    {
      id: "amount",
      accessorFn: r => parseFloat(r.totalAmount),
      header: "Amount",
      cell: ({ row }) => <span className="font-mono tabular-nums text-xs font-semibold">{row.original.totalAmount}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn(
          "text-[10px] font-bold",
          row.original.status === "DRAFT"    && "bg-amber-50 text-amber-700 border-amber-200",
          row.original.status === "POSTED"   && "bg-emerald-50 text-emerald-700 border-emerald-200",
          row.original.status === "REVERSED" && "bg-slate-100 text-slate-600 border-slate-300",
        )}>{row.original.status}</Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="number"
      pageSize={25}
      storageKey="accounting-vouchers"
    />
  )
}
