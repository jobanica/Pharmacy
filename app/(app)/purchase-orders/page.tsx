import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Draft, send, and receive purchase orders into stock batches."
      />
      <ComingSoon milestone="Milestone 7" />
    </div>
  );
}
