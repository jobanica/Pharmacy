import { z } from "zod";

export const receiveStockSchema = z.object({
  productId: z.string().uuid(),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  batchNumber: z.string().max(64).optional(),
  // ISO date (yyyy-mm-dd) or empty when the product has no expiry.
  expiryDate: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().int("Whole units only").positive("Enter a quantity"),
  // Unit cost in pesos; converted to centavos at the action boundary.
  cost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
});
export type ReceiveStockInput = z.output<typeof receiveStockSchema>;
export type ReceiveStockFormValues = z.input<typeof receiveStockSchema>;

export const adjustBatchSchema = z.object({
  batchId: z.string().uuid(),
  newQuantity: z.coerce.number().int("Whole units only").min(0, "Cannot be negative"),
  reason: z.string().max(200).optional(),
});
export type AdjustBatchInput = z.output<typeof adjustBatchSchema>;
export type AdjustBatchFormValues = z.input<typeof adjustBatchSchema>;
