"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/data-table"
import { getColumns, type ClassColumn } from "./columns"
import { ClassDrawer } from "./class-drawer"
import { deleteClass } from "@/actions/academics"

interface Props {
  rows:              ClassColumn[]
  schoolId:          string
  schoolWorkingDays: number[]
  faculties:         { id: string; name: string; workingDays: number[] }[]
  teachers:          { id: string; fullName: string; role: string }[]
  rooms:             { id: string; name: string; capacity: number; isActive: boolean }[]
}

export function ClassesTable({ rows, schoolId, schoolWorkingDays, faculties, teachers, rooms }: Props) {
  const router = useRouter()
  const [editItem, setEditItem] = useState<ClassColumn | null>(null)

  async function handleDelete(row: ClassColumn) {
    if (!confirm(`Delete class "${row.name}"? Sections and subjects will also be removed.`)) return
    try {
      await deleteClass(row.id)
      toast.success(`Class "${row.name}" deleted`)
      router.refresh()
    } catch {
      toast.error("Failed to delete class")
    }
  }

  const columns = getColumns({
    onEdit:   (row) => setEditItem(row),
    onDelete: handleDelete,
  })

  return (
    <>
      <DataTable columns={columns} data={rows} searchKey="name" storageKey="classes" />
      {editItem && (
        <ClassDrawer
          schoolId={schoolId}
          schoolWorkingDays={schoolWorkingDays}
          faculties={faculties}
          teachers={teachers}
          rooms={rooms}
          editItem={{
            id:             editItem.id,
            name:           editItem.name,
            facultyId:      editItem.facultyId,
            classTeacherId: editItem.classTeacherId,
            roomId:         editItem.roomId,
            classroom:      editItem.classroom,
            workingDays:    editItem.workingDays,
          }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditItem(null) }}
        />
      )}
    </>
  )
}
