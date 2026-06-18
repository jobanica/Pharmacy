import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization profile, branches, members, invitations, and billing."
      />
      <ComingSoon milestone="Milestone 2 & 9" />
    </div>
  );
}
