import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Products, batches, stock movements, and on-hand by branch."
      />
      <ComingSoon milestone="Milestone 3–4" />
    </div>
  );
}
