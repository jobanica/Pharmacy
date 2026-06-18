import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InviteError message="No invitation token was provided." />;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_details", {
    invite_token: token,
  });
  const invite = data?.[0];

  if (!invite) {
    return (
      <InviteError message="This invitation is invalid, already used, or has expired." />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invite.organization_name}</CardTitle>
        <CardDescription>
          You were invited as {ROLE_LABELS[invite.role as Role]}. Create your
          account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm token={token} email={invite.email} />
      </CardContent>
    </Card>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation problem</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}
