"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/auth/session";

export type FeedbackResult = { ok: true } | { error: string };

const feedbackSchema = z.object({
  category: z.enum(["general", "bug", "feature", "billing"]).default("general"),
  message: z.string().min(3, "Please write a little more").max(2000),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

/** Send feedback to the developers. Stored in the feedback table. */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await getAppContext();
  if (!ctx) return { error: "You must be signed in to send feedback" };

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    organization_id: ctx.organization.id,
    user_id: ctx.user.id,
    user_email: ctx.user.email,
    category: parsed.data.category,
    message: parsed.data.message,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
