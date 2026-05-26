"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { cn } from "@/lib/utils"

export interface AuditRow {
  id:       string
  at:       string   // ISO string
  userName: string
  entity:   string
  entityId: string
  action:   string
  before:   unknown
  after:    unknown
}

const ACTION_COLOR: Record<string, string> = {
  CREATE:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE:      "bg-sky-50     text-sky-700     border-sky-200",
  DELETE:      "bg-rose-50    text-rose-700    border-rose-200",
  CANCEL:      "bg-amber-50   text-amber-700   border-amber-200",
  WRITE_OFF:   "bg-amber-50   text-amber-800   border-amber-300",
  APPROVE:     "bg-violet-50  text-violet-700  border-violet-200",
  POST:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVERSE:     "bg-rose-50    text-rose-700    border-rose-200",
  BILL_PERIOD: "bg-primary/10 text-primary     border-primary/20",
}

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<string | null>(null)

  const columns: ColumnDef<AuditRow>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => {
        const d = new Date(row.original.at)
        return (
          <div className="text-xs">
            <p className="font-mono">{d.toLocaleDateString()}</p>
            <p className="text-slate-400 text-[10px]">{d.toLocaleTimeString()}</p>
          </div>
        )
      },
    },
    {
      accessorKey: "entity",
      header: "Entity",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">
          {row.original.entity}
        </Badge>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className={cn(
          "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
          ACTION_COLOR[row.original.action] ?? "bg-slate-100 text-slate-600 border-slate-200",
        )}>{row.original.action}</span>
      ),
    },
    {
      id: "who",
      accessorFn: r => r.userName,
      header: "User",
      filterFn: (row, _, value) => {
        const v = String(value).toLowerCase()
        return row.original.userName.toLowerCase().includes(v)
          || row.original.entityId.toLowerCase().includes(v)
          || row.original.entity.toLowerCase().includes(v)
      },
      cell: ({ row }) => <span className="text-xs font-semibold">{row.original.userName}</span>,
    },
    {
      accessorKey: "entityId",
      header: "Entity ID",
      cell: ({ row }) => <span className="font-mono text-[10px] text-slate-500 truncate block max-w-[140px]">{row.original.entityId}</span>,
    },
    {
      id: "details",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const isOpen = open === row.original.id
        return (
          <button
            type="button"
            onClick={() => setOpen(o => o === row.original.id ? null : row.original.id)}
            aria-expanded={isOpen}
            aria-controls={`audit-detail-${row.original.id}`}
            aria-label={isOpen ? "Hide audit details" : "Show audit details"}
            className="text-xs text-primary hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")} />
            Details
          </button>
        )
      },
    },
  ]

  // Inject expanded panels by mapping over rows AFTER the table renders is awkward;
  // instead we render the DataTable normally and put a side-by-side panel under it.
  const selected = open ? rows.find(r => r.id === open) : null

  return (
    <div>
      <DataTable
        columns={columns}
        data={rows}
        searchKey="who"
        pageSize={25}
        storageKey="billing-audit"
      />
      {selected && (
        <div id={`audit-detail-${selected.id}`} role="region" aria-label="Audit entry details" className="border-t border-slate-100/80 px-5 py-4 bg-slate-50/40 grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">Before</p>
            <pre className="bg-white/70 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64 font-mono text-[11px]">
              {selected.before ? safeJson(selected.before) : <span className="text-slate-400 italic">— (no prior state recorded)</span>}
            </pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1.5">After</p>
            <pre className="bg-white/70 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64 font-mono text-[11px]">
              {selected.after ? safeJson(selected.after) : <span className="text-slate-400 italic">—</span>}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2) }
  catch { return "[unable to serialize — likely a circular reference]" }
}
