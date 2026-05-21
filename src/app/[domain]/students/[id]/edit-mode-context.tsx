"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type Ctx = { editing: boolean; setEditing: (v: boolean) => void }

const EditModeContext = createContext<Ctx | null>(null)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false)
  return (
    <EditModeContext.Provider value={{ editing, setEditing }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode(): Ctx {
  const ctx = useContext(EditModeContext)
  // Safe default when an EditableField is used outside a provider.
  if (!ctx) return { editing: false, setEditing: () => {} }
  return ctx
}
