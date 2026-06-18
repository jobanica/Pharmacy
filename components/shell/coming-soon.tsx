import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Empty-state placeholder for screens that arrive in a later milestone. Keeps
 * navigation whole and communicates roadmap status during the MVP build.
 */
export function ComingSoon({ milestone }: { milestone: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </span>
        <p className="text-sm font-medium">This screen is coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Scheduled for {milestone}. The foundation (layout, navigation, data
          access, money &amp; date helpers) is in place.
        </p>
      </CardContent>
    </Card>
  );
}
