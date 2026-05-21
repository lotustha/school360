"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { getColumns, type FacultyColumn } from "./columns"
import { FacultyDrawer } from "./faculty-drawer"
import { deleteFaculty } from "@/actions/academics"

interface Props {
  rows:              FacultyColumn[]
  schoolId:          string
  schoolWorkingDays: number[]
}

export const GENERAL_ROW_ID = "__general__"

export function FacultiesTable({ rows, schoolId, schoolWorkingDays }: Props) {
  const router = useRouter()
  const [editItem,    setEditItem]    = useState<FacultyColumn | null>(null)
  const [editGeneral, setEditGeneral] = useState<FacultyColumn | null>(null)

  async function handleDelete(row: FacultyColumn) {
    if (row.kind === "general") return    // never delete the synthetic row
    if (!confirm(`Delete faculty "${row.name}"? This may affect assigned classes.`)) return
    try {
      await deleteFaculty(row.id)
      toast.success(`Faculty "${row.name}" deleted`)
      router.refresh()
    } catch {
      toast.error("Failed to delete faculty")
    }
  }

  function handleEdit(row: FacultyColumn) {
    if (row.kind === "general") setEditGeneral(row)
    else                        setEditItem(row)
  }

  const columns = getColumns({
    onEdit:            handleEdit,
    onDelete:          handleDelete,
    schoolWorkingDays,
  })

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchKey="name"
        storageKey="faculties"
      />
      {editItem && (
        <FacultyDrawer
          schoolId={schoolId}
          schoolWorkingDays={schoolWorkingDays}
          editItem={{ id: editItem.id, name: editItem.name, workingDays: editItem.workingDays }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditItem(null) }}
        />
      )}
      {editGeneral && (
        <FacultyDrawer
          schoolId={schoolId}
          schoolWorkingDays={schoolWorkingDays}
          generalMode
          editItem={{ id: GENERAL_ROW_ID, name: editGeneral.name, workingDays: editGeneral.workingDays }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditGeneral(null) }}
        />
      )}
    </>
  )
}
