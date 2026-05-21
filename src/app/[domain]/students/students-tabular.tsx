"use client"

import { Suspense, useMemo } from "react"
import {
  StudentsTable, COLUMNS, useColumnOrder, type StudentRow, type ColumnKey,
} from "./students-table"
import { StudentsTableActions } from "./students-table-actions"

interface Props {
  schoolId:        string
  rows:            StudentRow[]
  pageOffset:      number
  narrowedToClass: boolean
}

export function StudentsTabular({ schoolId, rows, pageOffset, narrowedToClass }: Props) {
  const [columnOrder, setColumnOrder] = useColumnOrder()

  // Auto-drop classSection when scope is already a single class. Apply at
  // render time only; preserve stored preference for when filter is cleared.
  const effectiveOrder = useMemo(() => {
    return narrowedToClass ? columnOrder.filter(k => k !== "classSection") : columnOrder
  }, [columnOrder, narrowedToClass])

  // Visibility derived from the ordered list — toggling adds at end or removes.
  const visibleSet = useMemo(() => new Set(columnOrder), [columnOrder])

  function toggle(key: ColumnKey, visible: boolean) {
    if (visible) {
      if (!columnOrder.includes(key)) setColumnOrder([...columnOrder, key])
    } else {
      setColumnOrder(columnOrder.filter(k => k !== key))
    }
  }
  function reset() {
    setColumnOrder(COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] text-slate-400 italic mr-auto">
          Tip: drag column headers to reorder · shift-click header to add a secondary sort
        </span>
        <Suspense fallback={null}>
          <StudentsTableActions
            visibleColumns={visibleSet}
            onColumnToggle={toggle}
            onResetColumns={reset}
          />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <StudentsTable
          schoolId={schoolId}
          rows={rows}
          columnOrder={effectiveOrder}
          onReorder={setColumnOrder}
          pageOffset={pageOffset}
        />
      </Suspense>
    </div>
  )
}
