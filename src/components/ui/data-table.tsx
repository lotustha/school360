"use client"

import * as React from "react"
import {
  ColumnDef, ColumnFiltersState, ColumnOrderState, SortingState, VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, useReactTable, type Header,
} from "@tanstack/react-table"
import {
  Search, ChevronLeft, ChevronRight, Inbox, GripVertical,
  ArrowUp, ArrowDown, ArrowUpDown, Columns3,
} from "lucide-react"
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, horizontalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns:   ColumnDef<TData, TValue>[]
  data:      TData[]
  searchKey?: string
  pageSize?: number

  /** When set: persist columnOrder, visibility, and sort under this localStorage key. */
  storageKey?:             string
  /** Enable drag-to-reorder column headers. Defaults to true when storageKey is set. */
  enableColumnReorder?:    boolean
  /** Enable shift-click multi-column sort. Defaults to true when storageKey is set. */
  enableMultiSort?:        boolean
  /** Enable per-column visibility toggle UI. Defaults to true when storageKey is set. */
  enableColumnVisibility?: boolean
}

interface PersistedTableState {
  columnOrder?:      string[]
  columnVisibility?: Record<string, boolean>
  sorting?:          SortingState
}

function loadPersisted(key: string | undefined): PersistedTableState {
  if (!key || typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(`school360.dt.${key}`)
    if (!raw) return {}
    return JSON.parse(raw) as PersistedTableState
  } catch { return {} }
}

function savePersisted(key: string | undefined, state: PersistedTableState) {
  if (!key || typeof window === "undefined") return
  try {
    window.localStorage.setItem(`school360.dt.${key}`, JSON.stringify(state))
  } catch { /* ignore */ }
}

function colId<TData, TValue>(c: ColumnDef<TData, TValue>): string {
  if ("id" in c && c.id) return c.id
  if ("accessorKey" in c && c.accessorKey) return String(c.accessorKey)
  return ""
}

export function DataTable<TData, TValue>({
  columns, data, searchKey, pageSize = 15,
  storageKey,
  enableColumnReorder    = !!storageKey,
  enableMultiSort        = !!storageKey,
  enableColumnVisibility = !!storageKey,
}: DataTableProps<TData, TValue>) {
  // Default column order = declaration order.
  const defaultOrder = React.useMemo(
    () => columns.map(colId).filter(Boolean),
    [columns],
  )

  // ─── Persisted state: deferred to post-mount to avoid hydration mismatch ──
  // First render (server + client first pass) uses defaults so SSR/CSR agree.
  // After mount, we load localStorage and apply persisted order / sort / vis.
  const [sorting,          setSorting]          = React.useState<SortingState>([])
  const [columnFilters,    setColumnFilters]    = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnOrder,      setColumnOrder]      = React.useState<ColumnOrderState>(defaultOrder)
  const hydratedFromStorageRef = React.useRef(false)

  React.useEffect(() => {
    // Load once per storageKey on mount.
    hydratedFromStorageRef.current = false
    if (!storageKey) return
    const persisted = loadPersisted(storageKey)

    // Sanity-filter persisted column order against the current column set;
    // new columns get appended.
    if (persisted.columnOrder) {
      const known = new Set(defaultOrder)
      const fromStorage = persisted.columnOrder.filter(k => known.has(k))
      const seen = new Set(fromStorage)
      const appended = defaultOrder.filter(k => !seen.has(k))
      const merged = fromStorage.length > 0 ? [...fromStorage, ...appended] : defaultOrder
      setColumnOrder(merged)
    }
    if (persisted.columnVisibility) setColumnVisibility(persisted.columnVisibility)
    if (persisted.sorting)          setSorting(persisted.sorting)

    hydratedFromStorageRef.current = true
  }, [storageKey, defaultOrder])

  // ─── Persistence ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!storageKey) return
    // Don't overwrite localStorage with defaults during the brief window
    // before the load-effect runs.
    if (!hydratedFromStorageRef.current) return
    savePersisted(storageKey, {
      columnOrder:      enableColumnReorder    ? columnOrder      : undefined,
      columnVisibility: enableColumnVisibility ? columnVisibility : undefined,
      sorting:          (enableMultiSort || sorting.length > 0)   ? sorting          : undefined,
    })
  }, [storageKey, columnOrder, columnVisibility, sorting,
      enableColumnReorder, enableColumnVisibility, enableMultiSort])

  const table = useReactTable({
    data, columns,
    initialState: { pagination: { pageSize } },
    enableMultiSort,
    getCoreRowModel:       getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    onSortingChange:          setSorting,
    onColumnFiltersChange:    setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange:      setColumnOrder,
    state: { sorting, columnFilters, columnVisibility, columnOrder },
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const totalCount    = data.length
  const { pageIndex, pageSize: ps } = table.getState().pagination
  const start = filteredCount === 0 ? 0 : pageIndex * ps + 1
  const end   = Math.min((pageIndex + 1) * ps, filteredCount)

  // ─── DnD reorder ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // "actions" column convention is excluded from reorder by default.
  function isReorderable(id: string) {
    if (!enableColumnReorder) return false
    return id !== "actions" && id !== ""
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = columnOrder.indexOf(active.id as string)
    const newIdx = columnOrder.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    setColumnOrder(arrayMove(columnOrder, oldIdx, newIdx))
  }

  function resetTablePrefs() {
    setColumnOrder(defaultOrder)
    setColumnVisibility({})
    setSorting([])
  }

  // Header row's reorderable header IDs (used by SortableContext)
  const headerGroups = table.getHeaderGroups()
  const reorderableIds = enableColumnReorder
    ? headerGroups[0]?.headers
        .filter(h => isReorderable(h.column.id))
        .map(h => h.column.id) ?? []
    : []

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
        {enableColumnVisibility && (
          <ColumnsMenu table={table} onReset={resetTablePrefs} />
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium tabular-nums">
          {filteredCount < totalCount
            ? `${filteredCount} of ${totalCount}`
            : `${totalCount} ${totalCount === 1 ? "result" : "results"}`}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full border-collapse">
            <thead>
              {headerGroups.map(hg => (
                <tr key={hg.id} className="border-b border-slate-100/80">
                  <SortableContext items={reorderableIds} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map(header => (
                      <HeaderCell
                        key={header.id}
                        header={header}
                        sortable={enableMultiSort || header.column.getCanSort()}
                        reorderable={isReorderable(header.column.id)}
                      />
                    ))}
                  </SortableContext>
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
        </DndContext>
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

// ─── Header cell — drag handle + sort indicator + label ─────────────────────

function HeaderCell<TData, TValue>({
  header, sortable, reorderable,
}: {
  header:      Header<TData, TValue>
  sortable:    boolean
  reorderable: boolean
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: header.column.id, disabled: !reorderable })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 30 : undefined,
  }

  const canSort = sortable && header.column.getCanSort() && !header.isPlaceholder
  const sortDir = header.column.getIsSorted()
  const sortIdx = header.column.getSortIndex()
  const sortCount = header.getContext().table.getState().sorting.length

  return (
    <th
      ref={reorderable ? setNodeRef : undefined}
      style={reorderable ? style : undefined}
      onClick={canSort ? (e) => header.column.toggleSorting(undefined, e.shiftKey) : undefined}
      className={cn(
        "group/th px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap select-none",
        canSort && "cursor-pointer hover:text-slate-700 hover:bg-slate-50/60",
      )}
    >
      <div className="flex items-center gap-1.5">
        {reorderable && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary opacity-0 group-hover/th:opacity-100 transition-opacity flex-shrink-0"
          >
            <GripVertical className="w-3 h-3" />
          </button>
        )}
        <span>
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {canSort && (
          <span className={cn(
            "inline-flex items-center gap-0.5 ml-0.5",
            sortDir ? "text-primary" : "text-slate-300 opacity-0 group-hover/th:opacity-100",
          )}>
            {sortDir === "asc"  ? <ArrowUp   className="w-2.5 h-2.5" /> :
             sortDir === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> :
                                  <ArrowUpDown className="w-2.5 h-2.5" />}
            {sortDir && sortCount > 1 && (
              <span className="text-[9px] font-black tabular-nums">{sortIdx + 1}</span>
            )}
          </span>
        )}
      </div>
    </th>
  )
}

// ─── Columns visibility dropdown ───────────────────────────────────────────

function ColumnsMenu<TData>({
  table, onReset,
}: {
  table:   ReturnType<typeof useReactTable<TData>>
  onReset: () => void
}) {
  const cols = table.getAllLeafColumns().filter(c => c.getCanHide() && c.id !== "actions")
  if (cols.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer text-xs h-8 bg-white">
          <Columns3 className="w-3.5 h-3.5" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl"
      >
        <div className="px-2 py-1.5 flex items-center justify-between gap-3">
          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 p-0">
            Show columns
          </DropdownMenuLabel>
          <button onClick={onReset} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">
            Reset
          </button>
        </div>
        <DropdownMenuSeparator />
        {cols.map(c => {
          const header = c.columnDef.header
          const label =
            typeof header === "string" && header.length > 0
              ? header
              : c.id
          return (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.getIsVisible()}
              onCheckedChange={(v) => c.toggleVisibility(!!v)}
              className="cursor-pointer text-xs"
              onSelect={(e) => e.preventDefault()}
            >
              {label}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
