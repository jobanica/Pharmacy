"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { voidSale } from "@/lib/pos/actions";

export function VoidSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    if (!window.confirm("Void this sale? Stock will be restored to inventory.")) {
      return;
    }
    startTransition(async () => {
      const res = await voidSale(saleId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Sale voided");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" className="text-destructive" disabled={pending} onClick={onClick}>
      <Ban className="size-4" />
      Void sale
    </Button>
  );
}
