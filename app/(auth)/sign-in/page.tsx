import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your pharmacy account.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="ml-1 font-medium text-foreground underline">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}
