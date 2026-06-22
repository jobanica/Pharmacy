import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .optional()
    .or(z.literal(""));

export const CONTROLLED_LEVELS = ["dangerous", "regulated", "precursor"] as const;
export type ControlledLevel = (typeof CONTROLLED_LEVELS)[number];

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  genericName: optionalText(200),
  categoryId: z.string().uuid().optional().nullable(),
  sku: optionalText(64),
  barcode: optionalText(64),
  unit: z.string().min(1, "Unit is required").max(32).default("piece"),
  requiresPrescription: z.boolean().default(false),
  reorderPoint: z.coerce.number().int("Whole numbers only").min(0).default(0),
  // Selling price entered in pesos; converted to integer centavos at the action.
  price: z.coerce.number().min(0, "Price cannot be negative").default(0),
  isActive: z.boolean().default(true),
  // Clinical fields
  drugClass: optionalText(200),
  storageConditions: optionalText(500),
  contraindications: optionalText(2000),
  sideEffects: optionalText(2000),
  controlledLevel: z.enum(CONTROLLED_LEVELS).optional().nullable(),
});
export type ProductInput = z.output<typeof productSchema>;
export type ProductFormValues = z.input<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(200),
  contactPerson: optionalText(200),
  phone: optionalText(50),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: optionalText(500),
  notes: optionalText(1000),
});
export type SupplierInput = z.output<typeof supplierSchema>;
export type SupplierFormValues = z.input<typeof supplierSchema>;
