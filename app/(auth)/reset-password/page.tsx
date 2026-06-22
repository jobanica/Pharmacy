"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/lib/auth/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

type State = { error: string } | { ok: true } | null;

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<State, FormData>(
    updatePasswordAction as (state: State, payload: FormData) => Promise<State>,
    null,
  );

  if (state && "ok" in state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password updated</CardTitle>
          <CardDescription>Your password has been changed. You can now sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground underline">
            Go to sign in
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a strong password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {state && "error" in state ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <SubmitButton>Update password</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
