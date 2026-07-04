"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeMemberAction } from "@/lib/settings/actions";

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  return (
    <form
      action={removeMemberAction}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${name || "this member"}'s access to this pharmacy?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
        <Trash2 className="size-4" />
        Remove
      </Button>
    </form>
  );
}
