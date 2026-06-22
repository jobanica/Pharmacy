import { requirePlatformAdmin } from "@/lib/admin/auth";
import { CreateAccountForm } from "@/components/admin/create-account-form";

export const dynamic = "force-dynamic";

export default async function AdminCreateAccountPage() {
  await requirePlatformAdmin();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Manually onboard a new pharmacy. This creates the owner's login and their organization.
        </p>
      </div>
      <CreateAccountForm />
    </div>
  );
}
