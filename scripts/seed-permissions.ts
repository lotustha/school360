/**
 * Idempotent permission registry sync. Upserts every code from SYSTEM_PERMISSIONS
 * into the Permission table, then grants any new code to SUPER_ADMIN. Safe to
 * re-run after adding new codes to src/lib/permissions.ts.
 *
 * Run:  npx tsx scripts/seed-permissions.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { prisma } from "../src/lib/prisma"
import { SYSTEM_PERMISSIONS } from "../src/lib/permissions"

async function main() {
  let upserted = 0
  for (const mod of SYSTEM_PERMISSIONS) {
    for (const perm of mod.permissions) {
      await prisma.permission.upsert({
        where:  { code: perm.code },
        update: { description: perm.description },
        create: { code: perm.code, description: perm.description },
      })
      upserted++
    }
  }
  console.log(`Upserted ${upserted} permission codes.`)

  // Grant every permission to all SUPER_ADMIN roles
  const superAdmins = await prisma.role.findMany({ where: { name: "SUPER_ADMIN" } })
  if (superAdmins.length === 0) {
    console.log("No SUPER_ADMIN role found; skipping role grant.")
    return
  }
  const allPerms = await prisma.permission.findMany({ select: { id: true } })
  for (const role of superAdmins) {
    for (const p of allPerms) {
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      })
    }
  }
  console.log(`Granted ${allPerms.length} permissions to ${superAdmins.length} SUPER_ADMIN role(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
