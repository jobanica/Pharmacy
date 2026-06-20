"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteCustomer } from "@/lib/loyalty/actions";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="outline"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
        start(async () => {
          const res = await deleteCustomer(id);
          if ("error" in res) {
            toast.error(res.error);
            return;
          }
          toast.success("Customer deleted");
          router.push("/customers");
        });
      }}
    >
      <Trash2 className="size-4" />
      Delete
    </Button>
  );
}
