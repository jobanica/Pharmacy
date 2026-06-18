"use client";

import { useActionState } from "react";

import { signUpAction, type ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

export function SignUpForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    signUpAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Your name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="organizationName">Pharmacy name</Label>
        <Input id="organizationName" name="organizationName" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="branchName">First branch (optional)</Label>
        <Input id="branchName" name="branchName" placeholder="Main Branch" />
      </div>
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
          autoComplete="new-password"
          required
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
