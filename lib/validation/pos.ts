import { z } from "zod";

export const DISCOUNT_TYPES = ["none", "sc", "pwd", "manual"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

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
  discountType: z.enum(DISCOUNT_TYPES).default("none"),
  beneficiaryIdNo: z.string().max(50).optional().nullable(),
  beneficiaryName: z.string().max(200).optional().nullable(),
  prescriptionId: z.string().uuid().optional().nullable(),
});
export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;
