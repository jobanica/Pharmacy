import Link from "next/link";
import { cookies } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { REF_COOKIE, normalizeReferralCode } from "@/lib/agent-kit/ref";
import { lookupAgentCode } from "@/lib/agent-kit";
import { portalConfig } from "@/lib/portal/config";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);

  // ?ref= on this very request wins: the proxy sets the cookie on the
  // response, so it is not readable until the next request.
  const referralCode =
    normalizeReferralCode(params.ref) ??
    normalizeReferralCode(cookieStore.get(REF_COOKIE)?.value);

  // Nice-to-have only. A portal that cannot be reached simply means the field
  // shows the code without a name beside it.
  let agentName: string | null = null;
  if (referralCode) {
    const config = portalConfig();
    const lookup = config ? await lookupAgentCode(config, referralCode) : null;
    if (lookup?.active) agentName = lookup.agent_name;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your pharmacy</CardTitle>
        <CardDescription>
          Sets up your organization, first branch, and owner account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm referralCode={referralCode} agentName={agentName} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="ml-1 font-medium text-foreground underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
