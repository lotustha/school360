import { ShieldAlert, Lock } from "lucide-react"
import Link from "next/link"

/** Shown when the caller lacks the required lms:* permission. */
export function LmsForbidden({ permission = "lms:view" }: { permission?: string }) {
  return (
    <div className="max-w-3xl mx-auto mt-16">
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">No access to Online Learning</h1>
        <p className="text-xs text-slate-500 mt-1">
          You need the <span className="font-mono font-bold">{permission}</span> permission.
          Ask your school administrator to grant it.
        </p>
      </div>
    </div>
  )
}

/** Shown when the ONLINE_LEARNING subscription module is not active. */
export function LmsModuleOff({ domain }: { domain: string }) {
  return (
    <div className="max-w-3xl mx-auto mt-16">
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-12 text-center">
        <Lock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h1 className="text-lg font-bold text-slate-800">Online Learning is not enabled</h1>
        <p className="text-xs text-slate-500 mt-1">
          The <span className="font-semibold">Online Learning (LMS)</span> module is not part of your
          current subscription. Contact School360 to add it to your plan.
        </p>
        <Link
          href={`/${domain}/settings`}
          className="inline-block mt-4 text-xs font-semibold text-primary hover:underline"
        >
          Go to Settings
        </Link>
      </div>
    </div>
  )
}

/**
 * Classify an error thrown by an LMS gate into the right access-state branch.
 * Returns the JSX to render, or null if the error is not a gate error (re-throw).
 */
export function lmsAccessState(err: unknown, domain: string, permission?: string) {
  const msg = (err as Error)?.message ?? ""
  if (msg === "FORBIDDEN") return <LmsForbidden permission={permission} />
  if (msg.startsWith("MODULE_NOT_ACTIVE")) return <LmsModuleOff domain={domain} />
  if (msg === "UNAUTHORIZED") return null // caller should redirect to login
  return undefined // not a gate error — caller re-throws
}
