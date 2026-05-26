"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { formatBS } from "@/lib/nepali-date"
import type { FeePaymentRow } from "@/actions/accounting/fee-payments"

interface Props { rows: FeePaymentRow[] }

export function HistoryTable({ rows }: Props) {
  const columns: ColumnDef<FeePaymentRow>[] = [
    {
      accessorKey: "receiptNumber",
      header: "Receipt #",
      cell: ({ row }) => {
        const isReversed = row.original.voucherStatus === "REVERSED"
        const label = isReversed
          ? `Voided receipt ${row.original.receiptNumber}`
          : `Receipt ${row.original.receiptNumber}`
        return (
          <div className="inline-flex items-center gap-1.5">
            <Link
              href={`/finance/receipts/${row.original.id}/print`}
              aria-label={label}
              className={`font-mono text-xs font-bold text-primary hover:underline ${isReversed ? "line-through" : ""}`}
            >
              {row.original.receiptNumber}
            </Link>
            {isReversed && (
              <span aria-hidden className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">VOIDED</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "dateBS",
      header: "Date (BS)",
      cell: ({ row }) => <span className="text-xs">{formatBS(row.original.dateBS)}</span>,
    },
    {
      id: "student",
      accessorFn: r => r.studentName,
      header: "Student",
      filterFn: (row, _, value) => {
        const v = String(value).toLowerCase()
        return row.original.studentName.toLowerCase().includes(v)
          || row.original.receiptNumber.toLowerCase().includes(v)
          || (row.original.className?.toLowerCase().includes(v) ?? false)
      },
      cell: ({ row }) => (
        <div>
          <p className="font-semibold">{row.original.studentName}</p>
          {row.original.className && <p className="text-[11px] text-muted-foreground">{row.original.className}</p>}
        </div>
      ),
    },
    {
      id: "head",
      accessorFn: r => r.feeAccountName,
      header: "Fee head",
      cell: ({ row }) => (
        <span className="text-xs">
          <span className="font-mono text-slate-400">{row.original.feeAccountCode}</span>{" "}
          {row.original.feeAccountName}
          {row.original.lineCount > 1 && (
            <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              +{row.original.lineCount - 1} more
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => (
        <div>
          <Badge variant="outline" className="text-[10px] font-bold">{row.original.method}</Badge>
          {row.original.bankName && <p className="text-[10px] text-muted-foreground mt-0.5">{row.original.bankName}</p>}
        </div>
      ),
    },
    {
      id: "voucher",
      accessorFn: r => r.voucherNumber ?? "",
      header: "Voucher",
      cell: ({ row }) =>
        row.original.voucherId ? (
          <Link href={`/accounting/vouchers/${row.original.voucherId}`} className="font-mono text-xs text-primary hover:underline">
            {row.original.voucherNumber}
          </Link>
        ) : <span className="text-slate-400">—</span>,
    },
    {
      id: "amount",
      accessorFn: r => parseFloat(r.amount),
      header: "Amount",
      cell: ({ row }) => {
        const isReversed = row.original.voucherStatus === "REVERSED"
        return (
          <span className={`font-mono tabular-nums font-semibold ${isReversed ? "line-through text-slate-400" : ""}`}>
            {row.original.amount}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <Link href={`/finance/receipts/${row.original.id}/print`} target="_blank">
          <Button size="sm" variant="ghost" className="cursor-pointer text-xs h-7 gap-1">
            <Printer className="w-3 h-3" /> Print
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="student"
      pageSize={25}
      storageKey="finance-history"
    />
  )
}
