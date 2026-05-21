"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { getColumns } from "./columns"
import { RoomDrawer } from "./room-drawer"
import { deleteRoom, updateRoom, duplicateRoom, type RoomRow } from "@/actions/rooms"

interface Props {
  rows:     RoomRow[]
  schoolId: string
}

export function RoomsTable({ rows, schoolId }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [editItem, setEditItem] = useState<RoomRow | null>(null)

  async function handleDelete(row: RoomRow) {
    if (row.classCount > 0 || row.examSeatCount > 0) {
      toast.error(
        `"${row.name}" is in use — ${row.classCount} class(es), ${row.examSeatCount} exam seat(s). Disable it instead.`,
      )
      return
    }
    if (!confirm(`Delete room "${row.name}"? This also removes its seat layout.`)) return
    try {
      await deleteRoom(row.id, schoolId)
      toast.success(`Room "${row.name}" deleted`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function handleToggleActive(row: RoomRow) {
    try {
      await updateRoom(row.id, schoolId, { isActive: !row.isActive })
      toast.success(`"${row.name}" ${row.isActive ? "disabled" : "re-enabled"}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  function handleDuplicate(row: RoomRow) {
    startT(async () => {
      try {
        const { id, name } = await duplicateRoom(row.id, schoolId)
        toast.success(`Created "${name}" — opening editor…`)
        router.push(`/settings/rooms/${id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Duplicate failed")
      }
    })
  }

  const columns = getColumns({
    onEdit:         (row) => setEditItem(row),
    onDelete:       handleDelete,
    onToggleActive: handleToggleActive,
    onDuplicate:    handleDuplicate,
  })

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchKey="name"
        storageKey="rooms"
      />
      {editItem && (
        <RoomDrawer
          schoolId={schoolId}
          editItem={{ id: editItem.id, name: editItem.name, notes: editItem.notes }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditItem(null) }}
        />
      )}
    </>
  )
}
