"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { receiveTransfer } from "@/lib/transfers/actions";

export function ReceiveTransferButton({ transferId }: { transferId: string }) {
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await receiveTransfer(transferId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Transfer received — stock updated");
    });
  }

  return (
    <Button onClick={confirm} disabled={pending}>
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      Confirm receipt
    </Button>
  );
}
