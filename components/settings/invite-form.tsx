"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { createInviteAction, type ActionState } from "@/lib/settings/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";

const INVITABLE_ROLES = ROLES.filter((r) => r !== "owner");

type Branch = { id: string; name: string };

export function InviteForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createInviteAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      toast.success("Invitation created");
      formRef.current?.reset();
    } else if (state && "error" in state) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder="teammate@pharmacy.ph"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="cashier"
          className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
        >
          {INVITABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>
      {branches.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="invite-branch">Branch</Label>
          <select
            id="invite-branch"
            name="branch_id"
            defaultValue=""
            className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="sm:w-32">
        <SubmitButton>Invite</SubmitButton>
      </div>
    </form>
  );
}
