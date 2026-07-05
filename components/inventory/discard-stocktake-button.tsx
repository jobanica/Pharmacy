"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { discardStocktake } from "@/lib/stocktakes/actions";

export function DiscardStocktakeButton({ stocktakeId }: { stocktakeId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function discard() {
    if (
      !window.confirm(
        "Discard this draft stocktake? Any counts entered will be lost, and you can start a fresh one. (Inventory is not affected.)",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await discardStocktake(stocktakeId);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Draft discarded");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" size="sm" className="text-destructive" onClick={discard} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Discard draft
    </Button>
  );
}
