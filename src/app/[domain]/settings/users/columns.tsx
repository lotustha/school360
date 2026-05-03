"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ShieldAlert, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export type UserColumn = {
  id: string
  fullName: string
  email: string
  role: string
  overridesCount: number
}

export const columns: ColumnDef<UserColumn>[] = [
  {
    accessorKey: "fullName",
    header: "Full Name",
    cell: ({ row }) => <div className="font-medium">{row.getValue("fullName")}</div>,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      return (
        <Badge variant={role === "SUPER_ADMIN" ? "destructive" : "default"}>
          {role}
        </Badge>
      )
    }
  },
  {
    accessorKey: "overridesCount",
    header: "Overrides",
    cell: ({ row }) => {
      const count = row.getValue("overridesCount") as number
      if (count === 0) return <span className="text-muted-foreground">None</span>
      return (
        <Badge variant="outline" className="flex w-fit items-center gap-1">
          <ShieldAlert className="size-3" />
          {count} Active
        </Badge>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <KeyRound className="mr-2 h-4 w-4" /> Manage Privileges
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
              Revoke Access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
