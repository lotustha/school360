"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Undo2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { reverseVoucher } from "@/actions/accounting/vouchers"

export function VoucherActions({ voucherId, number }: { voucherId: string; number: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()

  function handleReverse() {
    start(async () => {
      try {
        const rev = await reverseVoucher(voucherId, reason.trim() || undefined)
        toast.success(`Reversed — new voucher ${rev.number}`)
        setOpen(false)
        router.push(`/accounting/vouchers/${rev.id}`)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer text-rose-700 border-rose-200 hover:bg-rose-50" onClick={() => setOpen(true)}>
        <Undo2 className="w-3.5 h-3.5" /> Reverse
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse voucher {number}?</DialogTitle>
            <DialogDescription>
              Creates a new voucher with opposite debits and credits.
              The original stays posted for audit; ledger balances net to zero.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reason (optional)</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this being reversed?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleReverse} disabled={pending} className="cursor-pointer gap-1.5">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              Reverse Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
