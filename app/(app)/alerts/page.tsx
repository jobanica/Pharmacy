import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Low-stock and expiry (30/60/90-day) alerts with one-click reorder."
      />
      <ComingSoon milestone="Milestone 6" />
    </div>
  );
}
