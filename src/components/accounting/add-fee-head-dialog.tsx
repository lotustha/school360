"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { createAccount } from "@/actions/accounting/accounts"

interface Props {
  /** ID of the parent account to nest under (typically "4000 Income"). Optional. */
  parentId?:      string | null
  /** Suggested next code, e.g. "4800". */
  suggestedCode?: string
}

/**
 * Inline dialog for creating a new INCOME account (a.k.a. fee head) without
 * leaving the Quick Entry page. On success, calls router.refresh() so the
 * server component re-fetches and the new row appears in the breakdown.
 */
export function AddFeeHeadDialog({ parentId, suggestedCode }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")

  function openDialog() {
    setCode(suggestedCode ?? "")
    setName("")
    setOpen(true)
  }

  function handleCreate() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required")
      return
    }
    start(async () => {
      try {
        await createAccount({
          code:     code.trim(),
          name:     name.trim(),
          type:     "INCOME",
          subType:  "OPERATING_INCOME",
          parentId: parentId ?? null,
        })
        toast.success(`Added "${name.trim()}" (${code.trim()})`)
        setOpen(false)
        router.refresh()
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1 text-primary font-bold hover:underline cursor-pointer"
      >
        <Plus className="w-3 h-3" /> Add fee head
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new fee head</DialogTitle>
            <DialogDescription>
              Creates a new INCOME account in your Chart of Accounts. It appears in the Day&apos;s Fee Collection breakdown immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Code *</label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="e.g. 4800"
                  className="font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Name *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Library Fee"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Tip: use the 4xxx range to keep fee heads grouped under <span className="font-mono">4000 Income</span>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleCreate} disabled={pending || !code.trim() || !name.trim()} className="cursor-pointer gap-1.5">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create &amp; add to breakdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
