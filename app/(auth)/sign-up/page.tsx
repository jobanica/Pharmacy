import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your pharmacy</CardTitle>
        <CardDescription>
          Sets up your organization, first branch, and owner account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
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
