import { SetupForm } from "./setup-form";
import { requireAppContext } from "@/lib/auth/session";

export default async function SetupPage() {
  const ctx = await requireAppContext();
  const isPending = ctx.user.email?.endsWith("@placeholder.reseta.ph") ?? false;

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Complete your account setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your email and password to secure your pharmacy account.
        </p>
      </div>
      <SetupForm currentEmail={ctx.user.email ?? ""} isPending={isPending} />
    </div>
  );
}
