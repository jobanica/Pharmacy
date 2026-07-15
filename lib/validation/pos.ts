import { z } from "zod";

export const DISCOUNT_TYPES = ["none", "sc", "pwd", "manual"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const PAYMENT_METHODS = ["cash", "card", "gcash", "maya", "other"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const tenderSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amountCentavos: z.number().int().positive(),
  reference: z.string().max(200).optional().nullable(),
});
export type Tender = z.infer<typeof tenderSchema>;

export const completeSaleSchema = z.object({
  items: z
    .array(
      z
        .object({
          // Catalog line: productId set. Manual line: name + unitPriceCentavos.
          productId: z.string().uuid().optional(),
          name: z.string().max(200).optional(),
          unitPriceCentavos: z.number().int().min(0).optional(),
          quantity: z.number().int().positive(),
        })
        .refine(
          (i) => Boolean(i.productId) || (i.name?.trim().length ?? 0) > 0,
          { message: "Each line needs a product or a manual item name" },
        ),
    )
    .min(1, "Cart is empty"),
  discountCentavos: z.number().int().min(0).default(0),
  amountTenderedCentavos: z.number().int().min(0).default(0),
  customerId: z.string().uuid().optional().nullable(),
  redeemPoints: z.number().int().min(0).default(0),
  discountType: z.enum(DISCOUNT_TYPES).default("none"),
  beneficiaryIdNo: z.string().max(50).optional().nullable(),
  beneficiaryName: z.string().max(200).optional().nullable(),
  prescriptionId: z.string().uuid().optional().nullable(),
  tenders: z.array(tenderSchema).optional().nullable(),
});
export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;
