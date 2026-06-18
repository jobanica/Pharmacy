import { Badge } from "@/components/ui/badge";
import type { PoStatus } from "@/lib/supabase/types";

const VARIANT: Record<PoStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "" },
  sent: { label: "Sent", className: "text-blue-600 dark:text-blue-400" },
  received: { label: "Received", className: "text-emerald-600 dark:text-emerald-500" },
  cancelled: { label: "Cancelled", className: "text-muted-foreground" },
};

export function PoStatusBadge({ status }: { status: PoStatus }) {
  const v = VARIANT[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}
