// Notice targeting vocabulary. Plain lib so it can be imported from both the
// "use server" actions file (which may only export async functions) and client
// components.

export const NOTICE_TARGET_TYPES = [
  "SCHOOL", "STUDENTS_ALL", "STAFF_ALL",
  "CLASS", "SECTION", "FACULTY", "GROUP",
  "STUDENTS", "STAFF",
] as const

export type NoticeTargetType = (typeof NOTICE_TARGET_TYPES)[number]
