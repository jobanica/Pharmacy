"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction } from "@/lib/auth/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

type State = { error: string } | { ok: true } | null;

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<State, FormData>(
    resetPasswordAction as (state: State, payload: FormData) => Promise<State>,
    null,
  );

  if (state && "ok" in state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a password reset link. Check your inbox and follow the instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {state && "error" in state ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <SubmitButton>Send reset link</SubmitButton>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="hover:text-foreground underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
