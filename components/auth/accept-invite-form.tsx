"use client";

import { useActionState } from "react";

import { acceptInviteAction, type ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    acceptInviteAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton>Join pharmacy</SubmitButton>
    </form>
  );
}
