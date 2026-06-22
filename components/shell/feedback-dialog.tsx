"use client";

import * as React from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback, type FeedbackInput } from "@/lib/feedback/actions";

type Category = NonNullable<FeedbackInput["category"]>;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "general", label: "General" },
  { value: "bug", label: "Report a bug" },
  { value: "feature", label: "Feature request" },
  { value: "billing", label: "Billing" },
];

/** "Send feedback" trigger + dialog. Feedback goes straight to the developers. */
export function FeedbackDialog({
  trigger,
}: {
  /** Custom trigger element. Defaults to a ghost button. */
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<Category>("general");
  const [message, setMessage] = React.useState("");
  const [pending, start] = React.useTransition();

  function send() {
    if (!message.trim()) {
      toast.error("Please write your feedback first");
      return;
    }
    start(async () => {
      const res = await submitFeedback({ category, message });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks! Your feedback was sent to the developers.");
      setMessage("");
      setCategory("general");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
            >
              <MessageSquarePlus className="size-4" />
              Send feedback
            </button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback to the developers</DialogTitle>
          <DialogDescription>
            Found a bug or have an idea? Let us know — we read every message.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fb-category">Topic</Label>
            <select
              id="fb-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fb-message">Message</Label>
            <Textarea
              id="fb-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's working, what's not, or what you'd like to see…"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            }
          />
          <Button type="button" onClick={send} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
