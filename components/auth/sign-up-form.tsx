"use client";

import { useActionState, useState } from "react";

import { signUpAction, type ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

export function SignUpForm({
  referralCode = null,
  agentName = null,
}: {
  /** Prefilled from ?ref= or the referral cookie. Always editable. */
  referralCode?: string | null;
  /** "Referred by …", when the portal recognised the code. */
  agentName?: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    signUpAction,
    null,
  );
  // The mobile number is only required when a referral code is present, so the
  // field follows what is actually in the box, not what arrived prefilled.
  const [code, setCode] = useState(referralCode ?? "");
  const referred = code.trim().length > 0;

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
        <Label htmlFor="referralCode">Referral code (optional)</Label>
        <Input
          id="referralCode"
          name="referralCode"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          placeholder="If someone referred you"
          className="uppercase"
        />
        {agentName ? (
          <p className="text-xs text-muted-foreground">Referred by {agentName}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">
          Mobile number{referred ? "" : " (optional)"}
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="09XX XXX XXXX"
          required={referred}
        />
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
