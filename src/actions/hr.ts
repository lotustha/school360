"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

export interface StaffRow {
  id:          string   // User.id
  employeeId:  string
  fullName:    string
  email:       string
  role:        string
  panNumber:   string | null
  ssfNumber:   string | null
  bankName:    string | null
  baseSalary:  number  | null
  ssfEnabled:  boolean | null
}

export async function getStaff(schoolId: string): Promise<StaffRow[]> {
  const employees = await prisma.employee.findMany({
    where: { schoolId },
    include: {
      user:    { select: { id: true, fullName: true, email: true, role: true } },
      payroll: { select: { baseSalary: true, ssfEnabled: true } },
    },
    orderBy: { user: { fullName: "asc" } },
  })

  return employees.map(e => ({
    id:         e.userId,
    employeeId: e.id,
    fullName:   e.user.fullName,
    email:      e.user.email,
    role:       e.user.role,
    panNumber:  e.panNumber,
    ssfNumber:  e.ssfNumber,
    bankName:   e.bankName,
    baseSalary: e.payroll?.baseSalary ?? null,
    ssfEnabled: e.payroll?.ssfEnabled ?? null,
  }))
}

export async function getHRStats(schoolId: string) {
  const [total, teachers, payrollCount, totalPayroll] = await Promise.all([
    prisma.employee.count({ where: { schoolId } }),
    prisma.employee.count({ where: { schoolId, user: { role: "TEACHER" } } }),
    prisma.payrollStructure.count({ where: { schoolId } }),
    prisma.payrollStructure.aggregate({
      where:  { schoolId },
      _sum:   { baseSalary: true },
    }),
  ])

  return {
    total,
    teachers,
    admin: total - teachers,
    payrollConfigured: payrollCount,
    totalMonthlyPayroll: totalPayroll._sum.baseSalary ?? 0,
  }
}

export async function createEmployee(
  schoolId: string,
  data: {
    fullName:   string
    email:      string
    password:   string
    role:       string
    panNumber?: string
    ssfNumber?: string
    bankName?:  string
    bankAccount?: string
    baseSalary?:  number
    ssfEnabled?:  boolean
    tdsPercentage?: number
  }
) {
  const hashed = await bcrypt.hash(data.password, 10)

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email:    data.email,
      password: hashed,
      role:     data.role,
      schoolId,
    },
  })

  const employee = await prisma.employee.create({
    data: {
      userId:      user.id,
      schoolId,
      panNumber:   data.panNumber   || null,
      ssfNumber:   data.ssfNumber   || null,
      bankName:    data.bankName    || null,
      bankAccount: data.bankAccount || null,
    },
  })

  if (data.baseSalary) {
    await prisma.payrollStructure.create({
      data: {
        employeeId:    employee.id,
        schoolId,
        baseSalary:    data.baseSalary,
        tdsPercentage: data.tdsPercentage ?? 0,
        ssfEnabled:    data.ssfEnabled    ?? false,
      },
    })
  }

  revalidatePath("/hr")
  revalidatePath("/hr/staff")
}
