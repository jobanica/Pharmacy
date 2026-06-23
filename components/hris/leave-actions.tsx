"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reviewLeave } from "@/lib/hris/employee-actions";

/** Approve / reject buttons shown on a pending leave request. */
export function LeaveReviewButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function review(status: "approved" | "rejected") {
    start(async () => {
      const res = await reviewLeave(id, status);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(status === "approved" ? "Approved" : "Rejected");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-emerald-300"
        disabled={pending}
        onClick={() => review("approved")}
      >
        <Check className="size-4" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        disabled={pending}
        onClick={() => review("rejected")}
      >
        <X className="size-4" />
        Reject
      </Button>
    </div>
  );
}
