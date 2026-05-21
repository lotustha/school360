"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Edit, Trash, GraduationCap, DoorOpen, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar-img"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ClassColumn = {
  id:                     string
  name:                   string
  facultyId:              string | null
  facultyName:            string | null
  classTeacherId:         string | null
  classTeacherName:       string | null
  classTeacherAvatarUrl:  string | null
  classTeacherPhone:      string | null
  roomId:                 string | null
  roomName:               string | null
  classroom:              string | null   // legacy free-text fallback
  sectionsCount:          number
  subjectsCount:          number
  sections:               string[]
  subjects:               string[]
  workingDays:            number[]
}

export function getColumns({
  onEdit,
  onDelete,
}: {
  onEdit:   (row: ClassColumn) => void
  onDelete: (row: ClassColumn) => void
}): ColumnDef<ClassColumn>[] {
  return [
    {
      accessorKey: "name",
      header: "Class",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{row.getValue("name")}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
              {row.original.facultyName && <span>{row.original.facultyName}</span>}
              {row.original.roomName ? (
                <span className="flex items-center gap-0.5 text-amber-700 font-semibold">
                  <DoorOpen className="w-2.5 h-2.5" /> {row.original.roomName}
                </span>
              ) : row.original.classroom ? (
                <span className="flex items-center gap-0.5 italic" title="Legacy text — link a real Room from Settings">
                  <DoorOpen className="w-2.5 h-2.5" /> {row.original.classroom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "classTeacher",
      header: "Class Teacher",
      cell: ({ row }) => {
        const t = row.original
        if (!t.classTeacherName) {
          return <span className="text-xs text-slate-400 italic">Unassigned</span>
        }
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={t.classTeacherName} url={t.classTeacherAvatarUrl} size={32} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{t.classTeacherName}</p>
              {t.classTeacherPhone ? (
                <a
                  href={`tel:${t.classTeacherPhone}`}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 transition-colors font-medium"
                >
                  <Phone className="w-2.5 h-2.5" />
                  {t.classTeacherPhone}
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 italic">no phone</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "facultyName",
      header: "Stream",
      cell: ({ row }) => {
        const f = row.getValue("facultyName") as string | null
        return f ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />{f}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">General</span>
        )
      },
    },
    {
      accessorKey: "sectionsCount",
      header: "Sections",
      cell: ({ row }) => {
        const names = row.original.sections
        const n     = names.length
        if (n === 0) return <span className="text-xs text-slate-400 italic">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            <span className="lg:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {n} sec
            </span>
            <span className="hidden lg:contents">
              {names.map(s => (
                <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {s}
                </span>
              ))}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "subjectsCount",
      header: "Subjects",
      cell: ({ row }) => {
        const names   = row.original.subjects
        const n       = names.length
        const visible = names.slice(0, 4)
        const rest    = n - visible.length
        if (n === 0) return <span className="text-xs text-slate-400 italic">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            <span className="lg:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {n} subj
            </span>
            <span className="hidden lg:contents">
              {visible.map(s => (
                <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                  {s}
                </span>
              ))}
              {rest > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  +{rest}
                </span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-white/50 shadow-xl">
              <DropdownMenuItem onClick={() => onEdit(row.original)} className="cursor-pointer gap-2">
                <Edit className="w-3.5 h-3.5 text-slate-500" /> Edit Class
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(row.original)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer gap-2">
                <Trash className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]
}
