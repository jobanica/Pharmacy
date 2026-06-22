"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startStocktake } from "@/lib/stocktakes/actions";

export function StartStocktakeButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function start() {
    startTransition(async () => {
      const res = await startStocktake("");
      if ("error" in res) { toast.error(res.error); return; }
      router.push(`/inventory/stocktake/${res.stocktakeId}`);
    });
  }

  return (
    <Button size="sm" onClick={start} disabled={pending}>
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      Start count
    </Button>
  );
}
