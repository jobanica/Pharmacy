"use client";

import { LogOut } from "lucide-react";

import { FeedbackDialog } from "@/components/shell/feedback-dialog";
import { signOutAction } from "@/lib/auth/actions";

/**
 * Always-visible footer actions for the app shell: Send feedback + Sign out.
 * Rendered in the desktop sidebar and the mobile nav drawer so signing out is
 * never more than one tap away.
 */
export function ShellFooter() {
  return (
    <div className="grid gap-1 border-t border-white/10 px-3 py-3">
      <FeedbackDialog />
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
