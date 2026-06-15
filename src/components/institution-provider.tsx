"use client"

import * as React from "react"

/**
 * Client-side carrier for the tenant's institution type (Phase 12).
 *
 * The [domain] layout resolves `School.institutionType` server-side and mounts
 * this provider so any client component (sidebar, header tabs, future HE
 * screens) can gate UI without its own fetch:
 *
 *   const { institutionType, isHE, hasThesis } = useInstitution()
 *
 * Routing rules (forward-looking — HE routes ship in Phases 24+):
 *   SCHOOL     → Class/Section/CAS/NEB routes only
 *   COLLEGE    → + Department/Programme/Semester/LMS
 *   UNIVERSITY → + Thesis/PhD/Research
 */

export type InstitutionType = "SCHOOL" | "COLLEGE" | "UNIVERSITY"

interface InstitutionContextValue {
  institutionType: InstitutionType
  /** COLLEGE or UNIVERSITY */
  isHE: boolean
  /** UNIVERSITY only */
  hasThesis: boolean
}

const InstitutionContext = React.createContext<InstitutionContextValue>({
  institutionType: "SCHOOL",
  isHE: false,
  hasThesis: false,
})

export function InstitutionProvider({
  institutionType,
  children,
}: {
  institutionType: InstitutionType
  children: React.ReactNode
}) {
  const value = React.useMemo<InstitutionContextValue>(
    () => ({
      institutionType,
      isHE: institutionType === "COLLEGE" || institutionType === "UNIVERSITY",
      hasThesis: institutionType === "UNIVERSITY",
    }),
    [institutionType]
  )
  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>
}

export function useInstitution(): InstitutionContextValue {
  return React.useContext(InstitutionContext)
}

/**
 * Convenience gate for HE-only UI sections.
 *   <InstitutionGate require="HE">…Programme nav…</InstitutionGate>
 *   <InstitutionGate require="THESIS">…Research nav…</InstitutionGate>
 */
export function InstitutionGate({
  require,
  children,
}: {
  require: "HE" | "THESIS"
  children: React.ReactNode
}) {
  const { isHE, hasThesis } = useInstitution()
  if (require === "HE" && !isHE) return null
  if (require === "THESIS" && !hasThesis) return null
  return <>{children}</>
}
