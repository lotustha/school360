import { prisma } from "@/lib/prisma"

export async function getActiveModules(schoolId: string): Promise<string[]> {
  const sub = await prisma.schoolSubscription.findUnique({
    where: { schoolId },
    include: { modules: { where: { isActive: true } } },
  })
  if (!sub) return []
  if (sub.plan === "TRIAL" && sub.trialEndsAt < new Date()) return []
  return sub.modules.map(m => m.moduleKey)
}

export async function requireModule(schoolId: string, moduleKey: string): Promise<void> {
  const active = await getActiveModules(schoolId)
  if (!active.includes(moduleKey)) {
    throw new Error(`MODULE_NOT_ACTIVE: ${moduleKey}`)
  }
}

export async function isModuleActive(schoolId: string, moduleKey: string): Promise<boolean> {
  const active = await getActiveModules(schoolId)
  return active.includes(moduleKey)
}

export async function getTrialStatus(schoolId: string) {
  const sub = await prisma.schoolSubscription.findUnique({ where: { schoolId } })
  if (!sub) return { isActive: false, daysLeft: 0, plan: "NONE", trialEndsAt: null }
  const now = new Date()
  const daysLeft = Math.max(
    0,
    Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
  )
  const isActive = sub.plan === "TRIAL" ? daysLeft > 0 : sub.plan === "ACTIVE"
  return { isActive, daysLeft, plan: sub.plan, trialEndsAt: sub.trialEndsAt }
}
