import { z } from "zod";

export const poItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantityOrdered: z.coerce.number().int().positive("Quantity must be at least 1"),
  unitCost: z.coerce.number().min(0).default(0), // pesos
});

export const createPoSchema = z.object({
  supplierId: z.string().uuid().optional().or(z.literal("")),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
  items: z.array(poItemInputSchema).min(1, "Add at least one item"),
});
export type CreatePoInput = z.input<typeof createPoSchema>;
export type CreatePoOutput = z.output<typeof createPoSchema>;

export const poHeaderSchema = z.object({
  supplierId: z.string().uuid().optional().or(z.literal("")),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});
export type PoHeaderInput = z.infer<typeof poHeaderSchema>;

export const receiveLineSchema = z.object({
  itemId: z.string().uuid(),
  quantityReceived: z.coerce.number().int().min(0),
  batchNumber: z.string().max(64).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});
export const receivePoSchema = z.object({
  lines: z.array(receiveLineSchema),
});
export type ReceivePoInput = z.input<typeof receivePoSchema>;
export type ReceivePoOutput = z.output<typeof receivePoSchema>;
