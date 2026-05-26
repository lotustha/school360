"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Undo2 } from "lucide-react"
import { reverseVoucher } from "@/actions/accounting/vouchers"

export function ReverseReceiptButton({
  voucherId,
  receiptNumber,
}: {
  voucherId: string
  receiptNumber: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function handleReverse() {
    const reason = prompt(
      `Reverse receipt ${receiptNumber}? This will:\n` +
      `• Post an offsetting voucher (GL stays balanced)\n` +
      `• Roll back the student's paidAmount and bill status\n` +
      `• Keep the original receipt as a voided audit record\n\n` +
      `Enter a reason (optional, will appear in the reversal narration):`,
    )
    if (reason === null) return  // user cancelled
    start(async () => {
      try {
        await reverseVoucher(voucherId, reason.trim() || undefined)
        toast.success(`Receipt ${receiptNumber} reversed`)
        router.refresh()
      } catch (e) { toast.error((e as Error).message) }
    })
  }

  return (
    <button
      type="button"
      onClick={handleReverse}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
      title="Reverse this receipt (proper accounting: never edit a posted voucher)"
    >
      <Undo2 className="w-3 h-3" /> {pending ? "Reversing…" : "Reverse"}
    </button>
  )
}
