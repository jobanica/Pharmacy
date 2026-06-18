import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Supplier directory and contact details."
      />
      <ComingSoon milestone="Milestone 3" />
    </div>
  );
}
