"use client";

import { useActionState } from "react";

import { signInAction, type ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
