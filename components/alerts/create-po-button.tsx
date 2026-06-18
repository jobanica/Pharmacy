"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createPoFromLowStock } from "@/lib/purchase-orders/actions";

export function CreatePoButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createPoFromLowStock();
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
          toast.success("Draft PO created from low-stock items");
          router.push(`/purchase-orders/${res.id}`);
        })
      }
    >
      <FileSpreadsheet className="size-4" />
      Create PO
    </Button>
  );
}
