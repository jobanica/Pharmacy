"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deletePurchaseOrder } from "@/lib/purchase-orders/actions";

export function DeletePoButton({
  poId,
  poNumber,
  received,
}: {
  poId: string;
  poNumber: string;
  received: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function onDelete() {
    if (received) {
      toast.error("Can't delete a PO that already received stock. Cancel it instead.");
      return;
    }
    if (!window.confirm(`Delete ${poNumber}? This can't be undone.`)) return;
    start(async () => {
      const res = await deletePurchaseOrder(poId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`${poNumber} deleted`);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-destructive"
      onClick={onDelete}
      disabled={pending || received}
      title={received ? "Received POs can't be deleted" : "Delete PO"}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
