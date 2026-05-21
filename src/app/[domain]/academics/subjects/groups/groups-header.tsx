"use client"

import { useState } from "react"
import { GroupDrawer, type ClassOpt, type FacultyOpt, type YearOpt } from "./group-drawer"

interface Props {
  schoolId:  string
  faculties: FacultyOpt[]
  years:     YearOpt[]
  classes:   ClassOpt[]
}

export function GroupsHeader({ schoolId, faculties, years, classes }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <GroupDrawer
      schoolId={schoolId}
      faculties={faculties}
      years={years}
      classes={classes}
      editing={null}
      open={open}
      onOpenChange={setOpen}
      showTrigger
    />
  )
}
