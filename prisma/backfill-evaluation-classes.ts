/**
 * One-shot: populate EvaluationClass rows for every existing Evaluation
 * that still has classId set. Idempotent — safe to re-run.
 *
 * Usage:
 *   npx tsx prisma/backfill-evaluation-classes.ts
 */

import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  const legacy = await prisma.evaluation.findMany({
    where:  { classId: { not: null } },
    select: { id: true, classId: true },
  })

  if (legacy.length === 0) {
    console.log("No legacy single-class evaluations to backfill.")
    return
  }

  console.log(`Found ${legacy.length} legacy evaluation(s) with classId set.`)

  let inserted = 0
  let skipped  = 0
  for (const ev of legacy) {
    if (!ev.classId) continue
    const exists = await prisma.evaluationClass.findUnique({
      where: { evaluationId_classId: { evaluationId: ev.id, classId: ev.classId } },
    })
    if (exists) {
      skipped++
      continue
    }
    await prisma.evaluationClass.create({
      data: { evaluationId: ev.id, classId: ev.classId },
    })
    inserted++
  }

  console.log(`Backfill complete. Inserted: ${inserted}, already-present: ${skipped}.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
