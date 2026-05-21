// Shared schema constants for the student xlsx importer.
// Lives here (not in src/actions/students-bulk.ts) because Next.js
// `"use server"` files may only export async functions — runtime arrays
// and types must come from a regular module.

export const IMPORT_FIELDS = [
  "admissionNo",       // upsert key (blank = create)
  "fullName",
  "fullNameNepali",
  "email",
  "className",         // resolved to classId
  "sectionName",       // resolved to sectionId (optional)
  "rollNumber",
  "symbolNumber",
  "nebRegistrationNo",
  "dobBS",
  "gender",
  "bloodGroup",
  "status",
  "religion",
  "ethnicity",
  "motherTongue",
  "province",
  "district",
  "municipality",
  "wardNo",
  "street",
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]
export type ImportRow   = Partial<Record<ImportField, string>>

export interface ImportRowResult {
  rowIndex:     number
  action:       "create" | "update" | "skip"
  studentId?:   string
  admissionNo?: string
  errors:       string[]
  warnings:     string[]
}
