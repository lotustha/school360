"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { getColumns, type SectionColumn } from "./columns"
import { SectionDrawer } from "./section-drawer"
import { deleteSection } from "@/actions/academics"

interface Props {
  rows:     SectionColumn[]
  schoolId: string
  classes:  { id: string; name: string; facultyName: string | null }[]
}

export function SectionsTable({ rows, schoolId, classes }: Props) {
  const router = useRouter()
  const [editItem, setEditItem] = useState<SectionColumn | null>(null)

  async function handleDelete(row: SectionColumn) {
    if (!confirm(`Delete section "${row.name}" from ${row.className}?`)) return
    try {
      await deleteSection(row.id)
      toast.success(`Section "${row.name}" deleted`)
      router.refresh()
    } catch {
      toast.error("Failed to delete section")
    }
  }

  const columns = getColumns({
    onEdit:   (row) => setEditItem(row),
    onDelete: handleDelete,
  })

  return (
    <>
      <DataTable columns={columns} data={rows} searchKey="name" storageKey="sections" />
      {editItem && (
        <SectionDrawer
          schoolId={schoolId}
          classes={classes}
          editItem={{ id: editItem.id, name: editItem.name, classId: editItem.classId }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditItem(null) }}
        />
      )}
    </>
  )
}
