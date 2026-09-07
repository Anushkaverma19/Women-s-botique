import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number.");

export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code.");

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the recipient's full name.").max(120),
  customerEmail: emailSchema,
  customerPhone: indianPhoneSchema,
  shippingAddress: z.string().trim().min(5, "Enter a complete address.").max(300),
  shippingCity: z.string().trim().min(2, "Enter a city.").max(80),
  shippingState: z.string().trim().min(2, "Enter a state.").max(80),
  shippingPostalCode: postalCodeSchema,
  shippingCountry: z.string().trim().min(2).max(80).default("India"),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  paymentOutcome: z.enum(["success", "fail"]),
});

export const cartItemSchema = z.object({
  variantId: z.string().uuid("Invalid variant."),
  quantity: z.number().int().min(1).max(10, "Maximum 10 per item."),
});

export const cartItemUpdateSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10, "Maximum 10 per item."),
});

export const couponValidateSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code.").max(40),
  subtotal: z.number().min(0),
});

export const productFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  color: z.string().trim().max(60).optional(),
  size: z.string().trim().max(30).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc"]).default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  occasion: z.string().trim().max(40).optional(),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, "Type a message.").max(500, "Keep it under 500 characters."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, hyphen-separated."),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(10),
  shortDescription: z.string().trim().min(5).max(200),
  basePrice: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).nullable().optional(),
  material: z.string().trim().min(1).max(160),
  care: z.string().trim().min(1).max(160),
  colorFamily: z.string().trim().min(1).max(60),
  occasionTags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const variantFormSchema = z.object({
  productId: z.string().uuid(),
  color: z.string().trim().min(1).max(60),
  size: z.string().trim().min(1).max(30),
  sku: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9-]+$/, "SKU may only contain letters, numbers and hyphens."),
  price: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().int().min(0),
  active: z.boolean().default(true),
});

export const orderStatusUpdateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? first.message : "Invalid input.";
}
