import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Point of Sale"
        description="Scan or search products, build a cart, take payment, and print receipts."
      />
      <ComingSoon milestone="Milestone 5" />
    </div>
  );
}
