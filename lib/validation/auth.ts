import { z } from "zod";

import { ROLES } from "@/lib/auth/roles";

export const signUpSchema = z.object({
  fullName: z.string().min(1, "Your name is required").max(120),
  organizationName: z.string().min(1, "Pharmacy name is required").max(120),
  branchName: z.string().max(120).optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

// Owner/manager invite a teammate. Cannot invite a second owner via this flow.
export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(
    ROLES.filter((r) => r !== "owner") as [string, ...string[]],
  ),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1, "Your name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
