import { z } from "zod";

export const completeSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Cart is empty"),
  discountCentavos: z.number().int().min(0).default(0),
  amountTenderedCentavos: z.number().int().min(0),
  customerId: z.string().uuid().optional().nullable(),
  redeemPoints: z.number().int().min(0).default(0),
});
export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;
