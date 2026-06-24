import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const loyaltySettingsSchema = z.object({
  pesoPerPoint: z.coerce
    .number({ error: "Enter a number" })
    .min(1, "Must be at least ₱1 per point")
    .max(100000, "That's too high"),
});
export type LoyaltySettingsInput = z.input<typeof loyaltySettingsSchema>;
