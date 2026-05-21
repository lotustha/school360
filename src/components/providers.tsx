"use client"

import * as React from "react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { MotionConfig } from "framer-motion"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        forcedTheme="light"
        disableTransitionOnChange
      >
        <MotionConfig
          reducedMotion="user"
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
          <Toaster richColors closeButton />
        </MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  )
}
