"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { updateTransferItemQty } from "@/lib/transfers/actions";

export function TransferItemQty({
  itemId,
  transferId,
  quantity,
  unit,
}: {
  itemId: string;
  transferId: string;
  quantity: number;
  unit: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(quantity));
  const [pending, start] = React.useTransition();

  function commit() {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) {
      setValue(String(quantity));
      return;
    }
    if (n === quantity) return;
    start(async () => {
      const res = await updateTransferItemQty(itemId, transferId, value);
      if ("error" in res) {
        toast.error(res.error);
        setValue(String(quantity));
        return;
      }
      toast.success("Quantity updated");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Input
        type="number"
        min="0"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={pending}
        className="h-7 w-16 px-1 text-right"
        aria-label="Transfer quantity"
      />
      {pending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : (
        <span className="text-muted-foreground">{unit}</span>
      )}
    </span>
  );
}
