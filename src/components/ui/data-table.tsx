"use client"

import * as React from "react"
import {
  ColumnDef, ColumnFiltersState, SortingState, VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table"
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react"

interface DataTableProps<TData, TValue> {
  columns:   ColumnDef<TData, TValue>[]
  data:      TData[]
  searchKey?: string
  pageSize?: number
}

export function DataTable<TData, TValue>({
  columns, data, searchKey, pageSize = 15,
}: DataTableProps<TData, TValue>) {
  const [sorting,          setSorting]          = React.useState<SortingState>([])
  const [columnFilters,    setColumnFilters]    = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data, columns,
    initialState: { pagination: { pageSize } },
    getCoreRowModel:       getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    onSortingChange:          setSorting,
    onColumnFiltersChange:    setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const totalCount    = data.length
  const { pageIndex, pageSize: ps } = table.getState().pagination
  const start = filteredCount === 0 ? 0 : pageIndex * ps + 1
  const end   = Math.min((pageIndex + 1) * ps, filteredCount)

  return (
    <div className="flex flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/80">
        {searchKey && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder={`Search by ${searchKey}…`}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={e => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-white/70 border border-slate-200 rounded-lg text-sm
                transition-all outline-none placeholder:text-slate-400
                focus:border-primary focus:ring-2 focus:ring-primary/15 focus:bg-white"
            />
          </div>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium tabular-nums">
          {filteredCount < totalCount
            ? `${filteredCount} of ${totalCount}`
            : `${totalCount} ${totalCount === 1 ? "result" : "results"}`}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-slate-100/80">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap select-none"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-slate-100/60">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="hover:bg-primary/5 transition-colors duration-150 group"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-5 py-3.5 align-middle text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center">
                      <Inbox className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground/60">Try a different search term</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────── */}
      {(table.getCanPreviousPage() || table.getCanNextPage() || filteredCount > 0) && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100/80">
          <span className="text-xs text-slate-400 tabular-nums">
            {filteredCount === 0 ? "No results" : `Showing ${start}–${end} of ${filteredCount}`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7 rounded-lg border border-slate-200 bg-white/70 flex items-center justify-center
                hover:bg-white hover:border-slate-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {Array.from({ length: Math.min(table.getPageCount(), 5) }, (_, i) => {
              const pc   = table.getPageCount()
              const curr = pageIndex
              let page: number

              if (pc <= 5)            page = i
              else if (curr < 3)      page = i
              else if (curr > pc - 4) page = pc - 5 + i
              else                    page = curr - 2 + i

              return (
                <button
                  key={page}
                  onClick={() => table.setPageIndex(page)}
                  className={`h-7 min-w-[28px] px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    page === curr
                      ? "bg-primary text-white shadow-sm shadow-primary/25"
                      : "border border-slate-200 bg-white/70 text-slate-600 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  {page + 1}
                </button>
              )
            })}

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7 rounded-lg border border-slate-200 bg-white/70 flex items-center justify-center
                hover:bg-white hover:border-slate-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
